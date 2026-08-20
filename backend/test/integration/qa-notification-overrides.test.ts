import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../../src/db/prisma.js';
import { queueReservationDeliveryNotification } from '../../src/emails/delivery-notifications.js';
import { queueReservationStatusNotification } from '../../src/emails/notifications.js';
import { NotificationStatus, PaymentStatus, ReservationStatus } from '../../src/generated/prisma/client.js';
import { executeQaNotificationOverride } from '../../src/services/reservation-notification-overrides.js';

const oldEmail = 'old-qa@invalid.example';
const overrideEmail = 'controlled-qa@example.test';
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const resetDatabase = async () => {
  await prisma.emailDeliveryReport.deleteMany();
  await prisma.reservationDelivery.deleteMany();
  await prisma.reservationNotificationOverride.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.adminCommand.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.package.deleteMany();
  await prisma.adminUser.deleteMany();
};

const seed = async (suffix: string, qa = true) => {
  const owner = await prisma.adminUser.create({ data: { email: `owner-${suffix}@example.test`, name: 'Owner', role: 'OWNER', passwordHash: 'x' } });
  const staff = await prisma.adminUser.create({ data: { email: `staff-${suffix}@example.test`, name: 'Staff', role: 'STAFF', passwordHash: 'x' } });
  const pack = await prisma.package.create({ data: { slug: `qa-override-${suffix}`, name: 'QA Override', category: 'Tests', price: 18000, durationMin: 60, deliveryLabel: 'Livraison sous 48 à 72 heures' } });
  const packageVersion = await prisma.packageVersion.create({ data: { packageId: pack.id, version: 3, name: pack.name, category: pack.category, price: pack.price, currency: pack.currency, durationMin: 60, deliveryLabel: pack.deliveryLabel, status: 'PUBLISHED' } });
  const customer = await prisma.customer.create({ data: { firstName: qa ? 'POST04-QA-A' : 'Cliente', lastName: qa ? 'GSPLUS-QA' : 'Normale', phone: '+237699111222', email: oldEmail } });
  const startAt = new Date('2026-08-12T08:00:00.000Z');
  const endAt = new Date('2026-08-12T09:00:00.000Z');
  const reservation = await prisma.reservation.create({
    data: {
      reference: `GSP-QA-${suffix}`,
      customerId: customer.id,
      packageId: pack.id,
      packageVersionId: packageVersion.id,
      startAt,
      endAt,
      status: ReservationStatus.CONFIRMED,
      version: 2,
      extraInfo: qa ? 'POST-04 A — scénario QA contrôlé.' : 'Réservation client normale',
      consentImage: false,
      acceptedTermsAt: startAt,
      snapshot: { create: {
        firstName: customer.firstName, lastName: customer.lastName, phoneRaw: customer.phone, phoneE164: customer.phone,
        email: oldEmail, notificationEmail: oldEmail, notificationPhoneE164: customer.phone,
        packageId: pack.id, packageVersionId: packageVersion.id, packageVersion: 3, packageName: pack.name,
        startAt, endAt, durationMin: 60, amount: 18000, currency: 'XAF', termsAccepted: true,
        termsVersion: '2026-08-11', termsAcceptedAt: startAt, privacyAccepted: true,
        privacyVersion: '2026-08-11', privacyAcceptedAt: startAt, whatsappConsent: false,
        imageConsent: false, imageAuthorizationVersion: '2026-08-11', source: 'PUBLIC_BOOKING',
      } },
      payments: { create: { amount: 18000, method: 'mtn_momo', transactionRef: `QA-${suffix}-PAY`, status: PaymentStatus.VERIFIED } },
    },
    include: { snapshot: true },
  });
  return { owner, staff, packageVersion, reservation };
};

const applyOverride = async (reservationId: string, reservationVersion: number, owner: Awaited<ReturnType<typeof seed>>['owner'], commandId = randomUUID()) => executeQaNotificationOverride({
  reservationId,
  commandId,
  expectedReservationVersion: reservationVersion,
  expectedOverrideVersion: 0,
  recipientEmail: overrideEmail,
  reason: 'POST-04 : nouvelle boîte QA contrôlée pour les futurs envois uniquement.',
  admin: owner,
  authorizedReservationIds: [reservationId],
});

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('audited POST-04 QA notification override', () => {
  it('preserves the snapshot, creates one audited override and replays idempotently', async () => {
    const { owner, reservation, packageVersion } = await seed('AUDIT');
    const before = await prisma.reservationSnapshot.findUniqueOrThrow({ where: { reservationId: reservation.id } });
    const beforeHash = fingerprint(before);
    const legalCount = await prisma.legalDocumentVersion.count();
    const commandId = randomUUID();

    const first = await applyOverride(reservation.id, reservation.version, owner, commandId);
    const replay = await applyOverride(reservation.id, reservation.version, owner, commandId);

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.value.id).toBe(first.value.id);
    expect(await prisma.reservationNotificationOverride.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'reservation.qa_notification_override.create' } })).toBe(1);
    expect(await prisma.notificationEvent.count()).toBe(0);
    const after = await prisma.reservationSnapshot.findUniqueOrThrow({ where: { reservationId: reservation.id } });
    expect(fingerprint(after)).toBe(beforeHash);
    expect(after.notificationEmail).toBe(oldEmail);
    const unchanged = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(unchanged.packageVersionId).toBe(packageVersion.id);
    expect(unchanged.consentImage).toBe(false);
    expect(await prisma.legalDocumentVersion.count()).toBe(legalCount);
    expect(first.value.recipientEmail).toBe(overrideEmail);
  });

  it('requires OWNER, allowlist, QA markers and current versions', async () => {
    const qa = await seed('GUARDS');
    await expect(executeQaNotificationOverride({ reservationId: qa.reservation.id, commandId: randomUUID(), expectedReservationVersion: 2, expectedOverrideVersion: 0, recipientEmail: overrideEmail, reason: 'Tentative STAFF interdite sur une réservation QA.', admin: qa.staff, authorizedReservationIds: [qa.reservation.id] })).rejects.toMatchObject({ code: 'ADMIN_PERMISSION_REQUIRED' });
    await expect(executeQaNotificationOverride({ reservationId: qa.reservation.id, commandId: randomUUID(), expectedReservationVersion: 2, expectedOverrideVersion: 0, recipientEmail: overrideEmail, reason: 'Tentative hors allowlist interdite pour la réservation.', admin: qa.owner, authorizedReservationIds: [] })).rejects.toMatchObject({ code: 'QA_NOTIFICATION_OVERRIDE_NOT_ALLOWLISTED' });
    await expect(executeQaNotificationOverride({ reservationId: qa.reservation.id, commandId: randomUUID(), expectedReservationVersion: 99, expectedOverrideVersion: 0, recipientEmail: overrideEmail, reason: 'Tentative avec une version de réservation périmée.', admin: qa.owner, authorizedReservationIds: [qa.reservation.id] })).rejects.toMatchObject({ code: 'RESERVATION_VERSION_CONFLICT' });
    const normal = await seed('NORMAL', false);
    await expect(executeQaNotificationOverride({ reservationId: normal.reservation.id, commandId: randomUUID(), expectedReservationVersion: 2, expectedOverrideVersion: 0, recipientEmail: overrideEmail, reason: 'Tentative interdite sur une réservation client normale.', admin: normal.owner, authorizedReservationIds: [normal.reservation.id] })).rejects.toMatchObject({ code: 'QA_RESERVATION_MARKER_REQUIRED' });
    await applyOverride(qa.reservation.id, 2, qa.owner);
    await expect(executeQaNotificationOverride({ reservationId: qa.reservation.id, commandId: randomUUID(), expectedReservationVersion: 2, expectedOverrideVersion: 0, recipientEmail: 'other@example.test', reason: 'Tentative concurrente avec une version d’override périmée.', admin: qa.owner, authorizedReservationIds: [qa.reservation.id] })).rejects.toMatchObject({ code: 'QA_NOTIFICATION_OVERRIDE_VERSION_CONFLICT' });
  });

  it('keeps old E-01/E-05/E-16 recipients and routes future E-17 to the override', async () => {
    const { owner, reservation } = await seed('E17');
    for (const code of ['E-01', 'E-05', 'E-16']) {
      await prisma.notificationEvent.create({ data: { reservationId: reservation.id, channel: 'email', type: `old-${code}`, recipient: oldEmail, idempotencyKey: `old-${code}`, templateCode: code, templateVersion: 'test', status: NotificationStatus.SENT } });
    }
    await applyOverride(reservation.id, 2, owner);
    const closed = await prisma.reservation.update({ where: { id: reservation.id }, data: { status: ReservationStatus.NO_SHOW, version: { increment: 1 } } });
    await queueReservationStatusNotification(closed.id, closed.status);
    const oldEvents = await prisma.notificationEvent.findMany({ where: { templateCode: { in: ['E-01', 'E-05', 'E-16'] } } });
    expect(oldEvents.every((event) => event.recipient === oldEmail)).toBe(true);
    expect(await prisma.notificationEvent.findFirstOrThrow({ where: { templateCode: 'E-17' } })).toMatchObject({ recipient: overrideEmail });
  });

  it('routes future E-18 and E-19 to the override without changing the snapshot', async () => {
    const { owner, reservation } = await seed('E1819');
    const snapshotBefore = await prisma.reservationSnapshot.findUniqueOrThrow({ where: { reservationId: reservation.id } });
    await applyOverride(reservation.id, 2, owner);
    const completed = await prisma.reservation.update({ where: { id: reservation.id }, data: { status: ReservationStatus.COMPLETED, version: { increment: 1 } } });
    await queueReservationStatusNotification(completed.id, completed.status);
    const delivery = await prisma.reservationDelivery.create({ data: { reservationId: reservation.id, commandId: randomUUID(), publishedById: owner.id, reservationVersionAtPublish: completed.version, deliveryUrl: 'https://example.test/qa', accessInstruction: 'Ouvrir le lien QA.', expiresAt: new Date(Date.now() + 86_400_000), verificationStatusCode: 200, verifiedAt: new Date() } });
    await queueReservationDeliveryNotification(delivery.id);
    expect(await prisma.notificationEvent.findFirstOrThrow({ where: { templateCode: 'E-18' } })).toMatchObject({ recipient: overrideEmail });
    expect(await prisma.notificationEvent.findFirstOrThrow({ where: { templateCode: 'E-19' } })).toMatchObject({ recipient: overrideEmail });
    expect((await prisma.reservationSnapshot.findUniqueOrThrow({ where: { reservationId: reservation.id } })).notificationEmail).toBe(snapshotBefore.notificationEmail);
    expect(await prisma.emailDeliveryReport.count()).toBe(0);
  });
});
