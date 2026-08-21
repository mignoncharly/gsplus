import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../../src/db/prisma.js';
import { recordMissingReservationSnapshot } from '../../src/services/integrity-incidents.js';
import { NotificationStatus, PaymentStatus, ReservationStatus } from '../../src/generated/prisma/client.js';
import {
  processNotificationEvent,
  scheduleDailyOperationsDigest,
  scheduleReservationReminderNotifications,
  queuePaymentStatusNotifications,
  queuePaymentVerifiedNotification,
  queueReservationCreatedNotifications,
  queueReservationRescheduledNotification,
  queueReservationStatusNotification,
} from '../../src/emails/notifications.js';

const resetDatabase = async () => {
  await prisma.dataIntegrityIncident.deleteMany();
  await prisma.calendarSyncLog.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.package.deleteMany();
};

const seedReservation = async () => {
  const pack = await prisma.package.create({
    data: { slug: 'notif-email', name: 'Portrait Notification', category: 'Tests', price: 15000, durationMin: 60 },
  });
  const packageVersion = await prisma.packageVersion.create({
    data: {
      packageId: pack.id,
      version: 1,
      name: pack.name,
      category: pack.category,
      description: pack.description,
      price: pack.price,
      currency: pack.currency,
      durationMin: pack.durationMin,
    },
  });
  const customer = await prisma.customer.create({
    data: { firstName: 'Aline', lastName: 'Normative', phone: '+237699222222', email: 'aline.normative@example.test' },
  });
  const startAt = new Date('2030-02-04T09:00:00.000Z');
  const endAt = new Date('2030-02-04T10:00:00.000Z');
  const capturedAt = new Date('2026-08-01T18:00:00.000Z');
  return prisma.reservation.create({
    data: {
      reference: 'GSP-300204-MAIL',
      customerId: customer.id,
      packageId: pack.id,
      packageVersionId: packageVersion.id,
      startAt,
      endAt,
      paymentChoice: 'base',
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
          termsAcceptedAt: capturedAt,
          privacyAccepted: true,
          privacyVersion: 'TEST',
          privacyAcceptedAt: capturedAt,
          whatsappConsent: false,
          imageConsent: false,
          imageAuthorizationVersion: 'TEST',
          source: 'TEST',
        },
      },
      payments: {
        create: { amount: pack.price, method: 'mtn_momo', transactionRef: 'NOTIF-TEST-001', status: PaymentStatus.PENDING },
      },
    },
    include: { payments: true },
  });
};

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('NOTIF-01 immutable normative e-mails', () => {
  it('freezes E-01 and I-01 at enqueue time and delivers the stored render', async () => {
    const reservation = await seedReservation();
    await queueReservationCreatedNotifications(reservation.id);

    const customer = await prisma.notificationEvent.findFirstOrThrow({
      where: { reservationId: reservation.id, channel: 'email', type: 'booking_received_customer' },
    });
    expect(customer).toMatchObject({ templateCode: 'E-01', templateVersion: '2026-08-20-phase4' });
    expect(customer.renderedContent).toMatchObject({ code: 'E-01', version: '2026-08-20-phase4', audience: 'customer' });
    const stored = customer.renderedContent as { subject: string; text: string; html: string };
    expect(stored.subject).toContain(reservation.reference);
    expect(stored.text).toContain('n’est pas encore définitivement confirmée');

    const sendEmail = vi.fn(async (_event, message) => {
      expect(message).toEqual({ subject: stored.subject, text: stored.text, html: stored.html });
      return { providerMessageId: 'notif-email-1', providerStatus: 'accepted' };
    });
    await expect(processNotificationEvent(customer.id, { sendEmail })).resolves.toBe('sent');
    expect(sendEmail).toHaveBeenCalledOnce();

    const admin = await prisma.notificationEvent.findFirstOrThrow({
      where: { reservationId: reservation.id, channel: 'email', type: 'booking_received_admin' },
    });
    expect(admin).toMatchObject({ templateCode: 'I-01', templateVersion: '2026-08-20-phase4' });
    expect(admin.renderedContent).toMatchObject({ code: 'I-01', audience: 'admin' });
  });

  it('freezes delayed E-03, cancels it on confirmation, and queues E-05', async () => {
    const reservation = await seedReservation();
    const payment = reservation.payments[0];
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.VERIFIED, version: { increment: 1 }, verifiedAt: new Date() },
    });
    await queuePaymentVerifiedNotification(reservation.id, { now: new Date('2026-08-01T18:00:00.000Z') });
    const delayed = await prisma.notificationEvent.findFirstOrThrow({
      where: { reservationId: reservation.id, channel: 'email', type: 'payment_verified_customer' },
    });
    expect(delayed).toMatchObject({ templateCode: 'E-03', templateVersion: '2026-08-20-phase4' });
    expect(delayed.renderedContent).toMatchObject({ code: 'E-03', audience: 'customer' });

    const confirmed = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.CONFIRMED, version: { increment: 1 } },
    });
    await queueReservationStatusNotification(confirmed.id, confirmed.status);

    expect(await prisma.notificationEvent.findUniqueOrThrow({ where: { id: delayed.id } })).toMatchObject({
      status: NotificationStatus.CANCELLED,
      providerStatus: 'cancelled_by_confirmation',
    });
    const confirmation = await prisma.notificationEvent.findFirstOrThrow({
      where: { reservationId: reservation.id, channel: 'email', type: 'booking_confirmed_customer' },
    });
    expect(confirmation).toMatchObject({ templateCode: 'E-05', templateVersion: '2026-08-20-phase4' });
    expect(confirmation.renderedContent).toMatchObject({ code: 'E-05', audience: 'customer' });
  });

  it.each([
    { status: PaymentStatus.REJECTED, code: 'E-04', delayed: false, overdue: false },
    { status: PaymentStatus.PAYMENT_INFO_REQUIRED, code: 'E-04A', delayed: false, overdue: true },
    { status: PaymentStatus.VERIFICATION_BLOCKED, code: 'E-04B', delayed: true, overdue: true },
  ])('queues normative $code for $status without semantic overlap', async ({ status, code, delayed, overdue }) => {
    const reservation = await seedReservation();
    const payment = await prisma.payment.update({
      where: { id: reservation.payments[0].id },
      data: { status, statusReason: `Motif ${status}`, version: { increment: 1 } },
    });
    const now = new Date('2026-08-01T18:00:00.000Z');
    await queuePaymentStatusNotifications(reservation.id, payment.status, { now });

    const clientEvent = await prisma.notificationEvent.findFirstOrThrow({
      where: { reservationId: reservation.id, channel: 'email', templateCode: code },
    });
    expect(clientEvent).toMatchObject({ templateCode: code, templateVersion: '2026-08-20-phase4' });
    expect(clientEvent.renderedContent).toMatchObject({ code, audience: 'customer' });
    expect(clientEvent.nextAttemptAt?.toISOString() ?? null).toBe(
      delayed ? '2026-08-01T18:30:00.000Z' : null,
    );
    expect(await prisma.notificationEvent.count({
      where: { reservationId: reservation.id, channel: 'email', templateCode: 'I-03' },
    })).toBe(overdue ? 1 : 0);
  });

  it('cancels delayed E-04B and I-03 when the payment state changes before delivery', async () => {
    const reservation = await seedReservation();
    const payment = await prisma.payment.update({
      where: { id: reservation.payments[0].id },
      data: { status: PaymentStatus.VERIFICATION_BLOCKED, statusReason: 'Opérateur indisponible', version: { increment: 1 } },
    });
    const now = new Date('2026-08-01T18:00:00.000Z');
    await queuePaymentStatusNotifications(reservation.id, payment.status, { now });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.PENDING, statusReason: null, version: { increment: 1 } },
    });
    const events = await prisma.notificationEvent.findMany({
      where: { reservationId: reservation.id, templateCode: { in: ['E-04B', 'I-03'] } },
    });
    const sendEmail = vi.fn(async () => ({ providerMessageId: 'must-not-send', providerStatus: 'accepted' }));
    for (const event of events) {
      await expect(processNotificationEvent(event.id, {
        now: () => new Date('2026-08-01T18:30:00.000Z'),
        sendEmail,
      })).resolves.toBe('skipped');
    }
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await prisma.notificationEvent.count({
      where: { id: { in: events.map((event) => event.id) }, status: NotificationStatus.CANCELLED },
    })).toBe(2);
  });

  it('freezes E-09 from the persisted old and new reschedule slots', async () => {
    const reservation = await seedReservation();
    const oldStartAt = reservation.startAt;
    const oldEndAt = reservation.endAt;
    const newStartAt = new Date('2030-02-05T13:00:00.000Z');
    const newEndAt = new Date('2030-02-05T14:00:00.000Z');
    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { startAt: newStartAt, endAt: newEndAt, version: { increment: 1 } },
    });
    await prisma.reservationTransition.create({
      data: {
        reservationId: reservation.id,
        fromStatus: reservation.status,
        toStatus: reservation.status,
        reason: 'Report accepté',
        oldStartAt,
        oldEndAt,
        newStartAt,
        newEndAt,
      },
    });
    await queueReservationRescheduledNotification(updated.id);
    const event = await prisma.notificationEvent.findFirstOrThrow({
      where: { reservationId: reservation.id, channel: 'email', type: 'booking_rescheduled_customer' },
    });
    expect(event).toMatchObject({ templateCode: 'E-09', templateVersion: '2026-08-20-phase4' });
    expect(event.renderedContent).toMatchObject({ code: 'E-09', audience: 'customer' });
    const render = event.renderedContent as { text: string };
    expect(render.text).toContain('4 février 2030');
    expect(render.text).toContain('5 février 2030');
  });

  it.each([
    { status: ReservationStatus.REJECTED, code: 'E-06' },
    { status: ReservationStatus.EXPIRED, code: 'E-14' },
    { status: ReservationStatus.NO_SHOW, code: 'E-17' },
  ])('queues normative $code only after the corresponding reservation fact', async ({ status, code }) => {
    const reservation = await seedReservation();
    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status, statusReason: `Motif ${status}`, version: { increment: 1 } },
    });
    await queueReservationStatusNotification(updated.id, updated.status);
    const event = await prisma.notificationEvent.findFirstOrThrow({
      where: { reservationId: reservation.id, channel: 'email', templateCode: code },
    });
    expect(event).toMatchObject({ templateCode: code, templateVersion: '2026-08-20-phase4' });
    expect(event.renderedContent).toMatchObject({ code, audience: 'customer' });
  });

  it('does not announce E-07 when a paid refusal has no durable financial task', async () => {
    const reservation = await seedReservation();
    await prisma.payment.update({
      where: { id: reservation.payments[0].id },
      data: { status: PaymentStatus.VERIFIED, verifiedAt: new Date(), version: { increment: 1 } },
    });
    const rejected = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.REJECTED, statusReason: 'Indisponibilité', version: { increment: 1 } },
    });
    await queueReservationStatusNotification(rejected.id, rejected.status);
    expect(await prisma.notificationEvent.count({
      where: { reservationId: reservation.id, channel: 'email', templateCode: { in: ['E-06', 'E-07'] } },
    })).toBe(0);
  });

  it('schedules E-15/E-16 once at 72h/24h and cancels them when no longer confirmed', async () => {
    const reservation = await seedReservation();
    const startAt = reservation.startAt;
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.CONFIRMED,
        createdAt: new Date(startAt.getTime() - 80 * 60 * 60 * 1000),
        version: { increment: 1 },
      },
    });
    await scheduleReservationReminderNotifications(new Date(startAt.getTime() - 72 * 60 * 60 * 1000));
    expect(await prisma.notificationEvent.count({
      where: { reservationId: reservation.id, templateCode: 'E-15' },
    })).toBe(1);
    expect(await prisma.notificationEvent.count({
      where: { reservationId: reservation.id, templateCode: 'E-16' },
    })).toBe(0);

    const at24h = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
    await scheduleReservationReminderNotifications(at24h);
    await scheduleReservationReminderNotifications(at24h);
    const reminders = await prisma.notificationEvent.findMany({
      where: { reservationId: reservation.id, templateCode: { in: ['E-15', 'E-16'] } },
    });
    expect(reminders).toHaveLength(2);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.CANCELLED, version: { increment: 1 } },
    });
    const sendEmail = vi.fn(async () => ({ providerMessageId: 'must-not-send', providerStatus: 'accepted' }));
    for (const reminder of reminders) {
      await expect(processNotificationEvent(reminder.id, { now: () => at24h, sendEmail })).resolves.toBe('skipped');
    }
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await prisma.notificationEvent.count({
      where: { id: { in: reminders.map((event) => event.id) }, status: NotificationStatus.CANCELLED },
    })).toBe(2);
  });

  it('does not send the E-15 change-deadline reminder after the 48-hour deadline', async () => {
    const reservation = await seedReservation();
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.CONFIRMED,
        createdAt: new Date(reservation.startAt.getTime() - 80 * 60 * 60 * 1000),
        version: { increment: 1 },
      },
    });
    await scheduleReservationReminderNotifications(
      new Date(reservation.startAt.getTime() - 32 * 60 * 60 * 1000),
    );
    expect(await prisma.notificationEvent.count({
      where: { reservationId: reservation.id, templateCode: { in: ['E-15', 'E-16'] } },
    })).toBe(0);
  });

  it('sends I-11 once at 18h Douala only when useful work exists', async () => {
    const before18 = new Date('2026-08-01T16:59:00.000Z');
    const at18 = new Date('2026-08-01T17:00:00.000Z');
    await expect(scheduleDailyOperationsDigest(before18)).resolves.toBeNull();
    await expect(scheduleDailyOperationsDigest(at18)).resolves.toBeNull();

    await seedReservation();
    await scheduleDailyOperationsDigest(at18);
    await scheduleDailyOperationsDigest(at18);
    const digests = await prisma.notificationEvent.findMany({
      where: { channel: 'email', templateCode: 'I-11' },
    });
    expect(digests).toHaveLength(1);
    expect(digests[0]).toMatchObject({ templateVersion: '2026-08-20-phase4', type: 'daily_operations_digest_admin' });
    expect(digests[0].renderedContent).toMatchObject({ code: 'I-11', audience: 'admin' });
  });

  it('queues one deliverable I-10 from the durable missing-snapshot incident', async () => {
    const seeded = await seedReservation();
    const anomalous = await prisma.reservation.create({
      data: {
        reference: 'GSP-300204-I10X',
        customerId: seeded.customerId,
        packageId: seeded.packageId,
        packageVersionId: seeded.packageVersionId,
        startAt: new Date('2030-02-05T09:00:00.000Z'),
        endAt: new Date('2030-02-05T10:00:00.000Z'),
      },
    });

    await recordMissingReservationSnapshot(anomalous.id, 'test_first_detection');
    await recordMissingReservationSnapshot(anomalous.id, 'test_repeated_detection');

    const events = await prisma.notificationEvent.findMany({
      where: { templateCode: 'I-10' },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      reservationId: null,
      templateVersion: '2026-08-20-phase4',
      type: 'data_integrity_incident_admin',
    });
    expect(events[0].renderedContent).toMatchObject({ code: 'I-10', audience: 'admin' });
    expect(await prisma.dataIntegrityIncident.findFirstOrThrow({ where: { reservationId: anomalous.id } }))
      .toMatchObject({ occurrenceCount: 2 });

    const sendEmail = vi.fn(async () => ({ providerMessageId: 'i10-delivered', providerStatus: 'accepted' }));
    await expect(processNotificationEvent(events[0].id, { sendEmail })).resolves.toBe('sent');
    expect(sendEmail).toHaveBeenCalledOnce();
  });
});
