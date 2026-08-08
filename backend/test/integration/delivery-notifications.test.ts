import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../../src/db/prisma.js';
import { NotificationStatus, PaymentStatus, ReservationStatus } from '../../src/generated/prisma/client.js';
import { handleEmailDeliveryReport } from '../../src/emails/email-delivery-reports.js';
import {
  processNotificationEvent,
  queueReservationStatusNotification,
} from '../../src/emails/notifications.js';
import { publishReservationDeliverables } from '../../src/services/reservation-deliveries.js';

const resetDatabase = async () => {
  await prisma.emailDeliveryReport.deleteMany();
  await prisma.reservationDelivery.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.adminCommand.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.package.deleteMany();
  await prisma.adminUser.deleteMany();
};

const seedReservation = async (status = ReservationStatus.CONFIRMED) => {
  const owner = await prisma.adminUser.create({
    data: {
      email: 'delivery-owner@example.test',
      name: 'Delivery Owner',
      role: 'OWNER',
      passwordHash: 'not-used',
    },
  });
  const pack = await prisma.package.create({
    data: {
      slug: 'delivery-notification',
      name: 'Portrait livraison',
      category: 'Tests',
      price: 20000,
      durationMin: 60,
      deliveryLabel: '48 heures ouvrées',
    },
  });
  const packageVersion = await prisma.packageVersion.create({
    data: {
      packageId: pack.id,
      version: 1,
      name: pack.name,
      category: pack.category,
      price: pack.price,
      currency: pack.currency,
      durationMin: pack.durationMin,
      deliveryLabel: pack.deliveryLabel,
    },
  });
  const customer = await prisma.customer.create({
    data: {
      firstName: 'Aline',
      lastName: 'Livraison',
      phone: '+237699333333',
      email: 'aline.delivery@example.test',
    },
  });
  const startAt = new Date('2026-07-30T09:00:00.000Z');
  const endAt = new Date('2026-07-30T10:00:00.000Z');
  const reservation = await prisma.reservation.create({
    data: {
      reference: 'GSP-260730-LIVR',
      customerId: customer.id,
      packageId: pack.id,
      packageVersionId: packageVersion.id,
      startAt,
      endAt,
      status,
      snapshot: {
        create: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          phoneRaw: customer.phone,
          phoneE164: customer.phone,
          email: customer.email,
          notificationEmail: customer.email,
          notificationPhoneE164: customer.phone,
          packageId: pack.id,
          packageVersionId: packageVersion.id,
          packageVersion: 1,
          packageName: pack.name,
          startAt,
          endAt,
          durationMin: pack.durationMin,
          amount: pack.price,
          currency: pack.currency,
          termsAccepted: true,
          termsVersion: 'TEST',
          termsAcceptedAt: startAt,
          privacyAccepted: true,
          privacyVersion: 'TEST',
          privacyAcceptedAt: startAt,
          whatsappConsent: false,
          imageConsent: false,
          imageAuthorizationVersion: 'TEST',
          source: 'TEST',
        },
      },
      payments: {
        create: {
          amount: pack.price,
          method: 'mtn_momo',
          transactionRef: 'DELIVERY-TEST-001',
          status: PaymentStatus.PAID,
        },
      },
    },
  });
  return { owner, reservation };
};

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('NOTIF-01 completion, deliverables and permanent bounces', () => {
  it('queues E-18 only after COMPLETED and uses the immutable package delivery promise', async () => {
    const { reservation } = await seedReservation();

    await queueReservationStatusNotification(reservation.id, ReservationStatus.CONFIRMED);
    expect(await prisma.notificationEvent.count({ where: { templateCode: 'E-18' } })).toBe(0);

    const completed = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.COMPLETED, version: { increment: 1 } },
    });
    await queueReservationStatusNotification(completed.id, completed.status);
    await queueReservationStatusNotification(completed.id, completed.status);

    const events = await prisma.notificationEvent.findMany({ where: { templateCode: 'E-18' } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      reservationId: reservation.id,
      type: 'booking_completed_followup_customer',
      templateVersion: '2026-07-30',
    });
    expect(events[0].renderedContent).toMatchObject({ code: 'E-18', audience: 'customer' });
    expect((events[0].renderedContent as { text: string }).text).toContain('48 heures ouvrées');
  });

  it('publishes E-19 only after a completed reservation and a successful live-link verification', async () => {
    const { owner, reservation } = await seedReservation(ReservationStatus.COMPLETED);
    const inaccessible = vi.fn(async () => ({ accessible: false, statusCode: 404, checkedAt: new Date() }));

    await expect(publishReservationDeliverables({
      reservationId: reservation.id,
      commandId: '11111111-1111-4111-8111-111111111111',
      expectedReservationVersion: reservation.version,
      deliveryUrl: 'https://delivery.example.test/missing',
      accessInstruction: 'Utilisez le code communiqué séparément.',
      expiresAt: new Date('2026-09-30T22:59:59.000Z'),
      admin: owner,
      verifyLink: inaccessible,
    })).rejects.toMatchObject({ code: 'DELIVERY_LINK_INACCESSIBLE' });
    expect(await prisma.reservationDelivery.count()).toBe(0);
    expect(await prisma.notificationEvent.count({ where: { templateCode: 'E-19' } })).toBe(0);

    const verifyLink = vi.fn(async () => ({ accessible: true, statusCode: 200, checkedAt: new Date('2026-08-02T10:00:00.000Z') }));
    const input = {
      reservationId: reservation.id,
      commandId: '22222222-2222-4222-8222-222222222222',
      expectedReservationVersion: reservation.version,
      deliveryUrl: 'https://delivery.example.test/gallery/gsp-260730-livr',
      accessInstruction: 'Utilisez le code communiqué séparément.',
      expiresAt: new Date('2026-09-30T22:59:59.000Z'),
      admin: owner,
      verifyLink,
    };
    const first = await publishReservationDeliverables(input);
    const replay = await publishReservationDeliverables(input);

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(verifyLink).toHaveBeenCalledOnce();
    expect(await prisma.reservationDelivery.count()).toBe(1);
    const events = await prisma.notificationEvent.findMany({ where: { templateCode: 'E-19' } });
    expect(events).toHaveLength(1);
    expect(events[0].renderedContent).toMatchObject({ code: 'E-19', audience: 'customer' });
  });

  it('retries temporary SMTP feedback and creates one I-09 only for a permanent client bounce', async () => {
    const { reservation } = await seedReservation(ReservationStatus.COMPLETED);
    await queueReservationStatusNotification(reservation.id, ReservationStatus.COMPLETED);
    const customerEvent = await prisma.notificationEvent.findFirstOrThrow({ where: { templateCode: 'E-18' } });
    await processNotificationEvent(customerEvent.id, {
      sendEmail: async () => ({ providerMessageId: 'smtp-delivery-001', providerStatus: 'accepted' }),
    });
    expect(await prisma.notificationEvent.findUniqueOrThrow({ where: { id: customerEvent.id } })).toMatchObject({
      status: NotificationStatus.SENT,
      providerStatus: 'accepted',
      deliveredAt: null,
    });

    await handleEmailDeliveryReport({
      providerEventId: 'provider-event-temporary-001',
      providerMessageId: 'smtp-delivery-001',
      status: 'TEMPORARY_FAILURE',
      smtpCode: '421',
      occurredAt: new Date('2026-08-02T10:01:00.000Z'),
    });
    expect(await prisma.notificationEvent.findUniqueOrThrow({ where: { id: customerEvent.id } })).toMatchObject({
      status: NotificationStatus.PENDING,
      providerStatus: 'temporary_failure',
      error: 'SMTP_421',
    });
    expect(await prisma.notificationEvent.count({ where: { templateCode: 'I-09' } })).toBe(0);

    await prisma.notificationEvent.update({
      where: { id: customerEvent.id },
      data: { status: NotificationStatus.SENT, providerStatus: 'accepted', providerMessageId: 'smtp-delivery-002' },
    });
    const permanent = {
      providerEventId: 'provider-event-permanent-001',
      providerMessageId: 'smtp-delivery-002',
      status: 'PERMANENT_FAILURE' as const,
      smtpCode: '550',
      occurredAt: new Date('2026-08-02T10:05:00.000Z'),
    };
    await handleEmailDeliveryReport(permanent);
    await handleEmailDeliveryReport(permanent);

    expect(await prisma.notificationEvent.findUniqueOrThrow({ where: { id: customerEvent.id } })).toMatchObject({
      status: NotificationStatus.FAILED,
      providerStatus: 'permanent_failure',
      error: 'SMTP_550',
      deliveredAt: null,
    });
    const alerts = await prisma.notificationEvent.findMany({ where: { templateCode: 'I-09' } });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].renderedContent).toMatchObject({ code: 'I-09', audience: 'admin' });
    expect((alerts[0].renderedContent as { text: string }).text).toContain('SMTP_550');
    expect(await prisma.emailDeliveryReport.count()).toBe(2);
  });
});
