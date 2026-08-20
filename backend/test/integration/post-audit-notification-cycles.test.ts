import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../../src/db/prisma.js';
import {
  AdminRole,
  PaymentStatus,
  ReservationStatus,
} from '../../src/generated/prisma/client.js';
import {
  processNotificationEvent,
  queueCancellationNotifications,
  queuePaymentStatusNotifications,
  queueReservationStatusNotification,
  queueRescheduleRequestNotifications,
} from '../../src/emails/notifications.js';
import {
  executeCancellationDecision,
  executePaymentDecision,
  executeRefundDecision,
  executeReservationDecision,
} from '../../src/services/payment-reservation-commands.js';
import {
  executeCreateRescheduleRequest,
  executeRescheduleRequestDecision,
} from '../../src/services/reservation-rescheduling.js';

const HOUR = 60 * 60 * 1000;

const resetDatabase = async () => {
  await prisma.dataIntegrityIncident.deleteMany();
  await prisma.calendarSyncLog.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.financialTask.deleteMany();
  await prisma.adminCommand.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.package.deleteMany();
  await prisma.adminUser.deleteMany();
};

const seedReservation = async ({
  reservationStatus = ReservationStatus.PENDING_CONFIRMATION,
  paymentStatus = PaymentStatus.PENDING,
}: {
  reservationStatus?: ReservationStatus;
  paymentStatus?: PaymentStatus;
} = {}) => {
  const suffix = randomUUID().slice(0, 8);
  const admin = await prisma.adminUser.create({
    data: {
      email: `post-01-owner-${suffix}@example.test`,
      name: 'Post-audit Owner',
      passwordHash: 'not-used-by-integration-test',
      role: AdminRole.OWNER,
    },
  });
  const pack = await prisma.package.create({
    data: {
      slug: `post-01-${suffix}`,
      name: 'Post-audit Notifications',
      category: 'Tests',
      price: 20000,
      durationMin: 60,
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
    },
  });
  const customer = await prisma.customer.create({
    data: {
      firstName: 'Aline',
      lastName: 'Post-audit',
      phone: '+237699555555',
      email: `post-01-customer-${suffix}@example.test`,
    },
  });
  const capturedAt = new Date('2026-08-09T08:00:00.000Z');
  const startAt = new Date('2030-03-10T10:00:00.000Z');
  const endAt = new Date(startAt.getTime() + HOUR);
  const reservation = await prisma.reservation.create({
    data: {
      reference: `GSP-POST01-${suffix.toUpperCase()}`,
      customerId: customer.id,
      packageId: pack.id,
      packageVersionId: packageVersion.id,
      startAt,
      endAt,
      status: reservationStatus,
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
        create: {
          amount: pack.price,
          method: 'mtn_momo',
          transactionRef: `POST01-${suffix}`,
          status: paymentStatus,
          verifiedAt: paymentStatus === PaymentStatus.VERIFIED ? capturedAt : null,
          verifiedById: paymentStatus === PaymentStatus.VERIFIED ? admin.id : null,
        },
      },
    },
    include: { payments: true },
  });
  return { admin, reservation, payment: reservation.payments[0] };
};

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('POST-01 I-03 payment decision cycles', () => {
  it('delivers once per immutable payment cycle under concurrent workers and allows a second cycle', async () => {
    const { admin, reservation, payment } = await seedReservation();
    const firstCommandId = randomUUID();
    const firstInput = {
      paymentId: payment.id,
      commandId: firstCommandId,
      expectedVersion: payment.version,
      status: PaymentStatus.VERIFICATION_BLOCKED,
      internalReason: 'Contrôle opérateur temporairement bloqué',
      customerReasonCode: 'PAYMENT_REVIEW_DELAYED',
      admin,
    };
    const first = await executePaymentDecision(firstInput);
    const replay = await executePaymentDecision(firstInput);
    expect(replay.replayed).toBe(true);
    expect(replay.value.payment.id).toBe(first.value.payment.id);

    const firstNow = new Date('2026-08-09T09:00:00.000Z');
    await Promise.all([
      queuePaymentStatusNotifications(reservation.id, first.value.payment.status, { now: firstNow, commandId: firstCommandId }),
      queuePaymentStatusNotifications(reservation.id, first.value.payment.status, { now: firstNow, commandId: firstCommandId }),
    ]);
    const firstEvent = await prisma.notificationEvent.findFirstOrThrow({
      where: { reservationId: reservation.id, templateCode: 'I-03' },
    });
    expect(firstEvent.idempotencyKey).toBe(
      `payment:${payment.id}:v${first.value.payment.version}:${first.value.payment.status}:I-03:email`,
    );

    const sendEmail = vi.fn(async () => ({
      providerMessageId: `post-01-i03-${randomUUID()}`,
      providerStatus: 'accepted',
    }));
    const firstDelivery = await Promise.all([
      processNotificationEvent(firstEvent.id, {
        now: () => new Date(firstNow.getTime() + 31 * 60 * 1000),
        sendEmail,
      }),
      processNotificationEvent(firstEvent.id, {
        now: () => new Date(firstNow.getTime() + 31 * 60 * 1000),
        sendEmail,
      }),
    ]);
    expect(firstDelivery.sort()).toEqual(['sent', 'skipped']);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const resumed = await executePaymentDecision({
      paymentId: payment.id,
      commandId: randomUUID(),
      expectedVersion: first.value.payment.version,
      status: PaymentStatus.PENDING,
      reason: 'Contrôle opérateur repris',
      admin,
    });
    const second = await executePaymentDecision({
      paymentId: payment.id,
      commandId: randomUUID(),
      expectedVersion: resumed.value.payment.version,
      status: PaymentStatus.VERIFICATION_BLOCKED,
      internalReason: 'Nouveau blocage constaté',
      customerReasonCode: 'PAYMENT_REVIEW_DELAYED',
      admin,
    });
    const secondNow = new Date('2026-08-09T11:00:00.000Z');
    await Promise.all([
      queuePaymentStatusNotifications(reservation.id, second.value.payment.status, { now: secondNow }),
      queuePaymentStatusNotifications(reservation.id, second.value.payment.status, { now: secondNow }),
    ]);

    const events = await prisma.notificationEvent.findMany({
      where: { reservationId: reservation.id, templateCode: 'I-03' },
      orderBy: { createdAt: 'asc' },
    });
    expect(events).toHaveLength(2);
    expect(new Set(events.map((event) => event.idempotencyKey)).size).toBe(2);
    const secondEvent = events.find((event) => event.id !== firstEvent.id);
    expect(secondEvent?.idempotencyKey).toBe(
      `payment:${payment.id}:v${second.value.payment.version}:${second.value.payment.status}:I-03:email`,
    );
    expect(secondEvent?.metadata).toMatchObject({
      paymentId: payment.id,
      expectedPaymentStatus: PaymentStatus.VERIFICATION_BLOCKED,
      expectedPaymentVersion: second.value.payment.version,
    });

    const secondDelivery = await Promise.all([
      processNotificationEvent(secondEvent!.id, {
        now: () => new Date(secondNow.getTime() + 31 * 60 * 1000),
        sendEmail,
      }),
      processNotificationEvent(secondEvent!.id, {
        now: () => new Date(secondNow.getTime() + 31 * 60 * 1000),
        sendEmail,
      }),
    ]);
    expect(secondDelivery.sort()).toEqual(['sent', 'skipped']);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('cancels a delayed alert when the same payment status belongs to a newer version', async () => {
    const { admin, reservation, payment } = await seedReservation();
    const first = await executePaymentDecision({
      paymentId: payment.id,
      commandId: randomUUID(),
      expectedVersion: payment.version,
      status: PaymentStatus.VERIFICATION_BLOCKED,
      internalReason: 'Premier blocage',
      customerReasonCode: 'PAYMENT_REVIEW_DELAYED',
      admin,
    });
    const firstNow = new Date('2026-08-09T09:00:00.000Z');
    await queuePaymentStatusNotifications(reservation.id, first.value.payment.status, { now: firstNow });
    const obsolete = await prisma.notificationEvent.findFirstOrThrow({
      where: { reservationId: reservation.id, templateCode: 'I-03' },
    });

    const resumed = await executePaymentDecision({
      paymentId: payment.id,
      commandId: randomUUID(),
      expectedVersion: first.value.payment.version,
      status: PaymentStatus.PENDING,
      reason: 'Reprise du contrôle',
      admin,
    });
    const second = await executePaymentDecision({
      paymentId: payment.id,
      commandId: randomUUID(),
      expectedVersion: resumed.value.payment.version,
      status: PaymentStatus.VERIFICATION_BLOCKED,
      internalReason: 'Blocage du nouveau cycle',
      customerReasonCode: 'PAYMENT_REVIEW_DELAYED',
      admin,
    });
    await queuePaymentStatusNotifications(reservation.id, second.value.payment.status, {
      now: new Date('2026-08-09T11:00:00.000Z'),
    });

    const sendEmail = vi.fn(async () => ({ providerMessageId: 'must-not-send', providerStatus: 'accepted' }));
    await expect(processNotificationEvent(obsolete.id, {
      now: () => new Date(firstNow.getTime() + 31 * 60 * 1000),
      sendEmail,
    })).resolves.toBe('skipped');
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await prisma.notificationEvent.findUniqueOrThrow({ where: { id: obsolete.id } })).toMatchObject({
      status: 'CANCELLED',
      resolutionNote: 'PAYMENT_CYCLE_CHANGED',
    });
  });
});

describe('POST-01 I-04 reschedule request identity', () => {
  it('deduplicates a command replay and concurrent producers but alerts for a new business request', async () => {
    const { admin, reservation } = await seedReservation({ reservationStatus: ReservationStatus.CONFIRMED });
    const commandId = randomUUID();
    const firstInput = {
      reservationId: reservation.id,
      commandId,
      expectedReservationVersion: reservation.version,
      requestedStartAt: new Date('2030-03-12T10:00:00.000Z'),
      reason: 'Premier report demandé',
      admin,
      now: new Date('2030-03-01T10:00:00.000Z'),
    };
    const first = await executeCreateRescheduleRequest(firstInput);
    expect((await executeCreateRescheduleRequest(firstInput)).replayed).toBe(true);
    await Promise.all([
      queueRescheduleRequestNotifications(first.value.request.id, { commandId }),
      queueRescheduleRequestNotifications(first.value.request.id, { commandId }),
    ]);
    expect(await prisma.notificationEvent.count({
      where: { reservationId: reservation.id, templateCode: 'I-04' },
    })).toBe(1);

    await executeRescheduleRequestDecision({
      requestId: first.value.request.id,
      commandId: randomUUID(),
      expectedVersion: first.value.request.version,
      decision: 'REJECTED',
      internalReason: 'Premier créneau indisponible',
      customerReasonCode: 'RESCHEDULE_UNAVAILABLE',
      admin,
    });
    const second = await executeCreateRescheduleRequest({
      ...firstInput,
      commandId: randomUUID(),
      requestedStartAt: new Date('2030-03-14T10:00:00.000Z'),
      reason: 'Deuxième demande métier',
      now: new Date('2030-03-02T10:00:00.000Z'),
    });
    await Promise.all([
      queueRescheduleRequestNotifications(second.value.request.id),
      queueRescheduleRequestNotifications(second.value.request.id),
    ]);

    const events = await prisma.notificationEvent.findMany({
      where: { reservationId: reservation.id, templateCode: 'I-04' },
      orderBy: { createdAt: 'asc' },
    });
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.idempotencyKey)).toEqual([
      `reschedule-request:${first.value.request.id}:I-04:email`,
      `reschedule-request:${second.value.request.id}:I-04:email`,
    ]);
  });
});

describe('POST-01 I-05 cancellation decision identity', () => {
  it.each([
    { origin: 'CUSTOMER' as const, leadTimeMs: 48 * HOUR + 1, expectedRefund: 10000, expectedAlerts: 1 },
    { origin: 'CUSTOMER' as const, leadTimeMs: 48 * HOUR, expectedRefund: null, expectedAlerts: 0 },
    { origin: 'CUSTOMER' as const, leadTimeMs: 48 * HOUR - 1, expectedRefund: null, expectedAlerts: 0 },
    { origin: 'STUDIO' as const, leadTimeMs: HOUR, expectedRefund: 20000, expectedAlerts: 1 },
  ])(
    'covers $origin at lead time $leadTimeMs without replay or producer duplicates',
    async ({ origin, leadTimeMs, expectedRefund, expectedAlerts }) => {
      const { admin, reservation } = await seedReservation({
        reservationStatus: ReservationStatus.CONFIRMED,
        paymentStatus: PaymentStatus.VERIFIED,
      });
      const commandId = randomUUID();
      const input = {
        reservationId: reservation.id,
        commandId,
        expectedVersion: reservation.version,
        origin,
        internalReason: origin === 'STUDIO' ? 'TEST-AUDIT Incident technique Studio' : 'Demande confirmée du client',
        ...(origin === 'STUDIO' ? { customerReasonCode: 'STUDIO_UNAVAILABLE' as const } : {}),
        admin,
        now: new Date(reservation.startAt.getTime() - leadTimeMs),
      };
      const outcome = await executeCancellationDecision(input);
      expect((await executeCancellationDecision(input)).replayed).toBe(true);
      expect(outcome.value.financialTask?.amount ?? null).toBe(expectedRefund);
      await Promise.all([
        queueCancellationNotifications(reservation.id, { commandId }),
        queueCancellationNotifications(reservation.id, { commandId }),
      ]);
      expect(await prisma.notificationEvent.count({
        where: { reservationId: reservation.id, templateCode: 'I-05' },
      })).toBe(expectedAlerts);
    },
  );

  it('allows only one of two concurrent cancellation decisions for the same version', async () => {
    const { admin, reservation } = await seedReservation({
      reservationStatus: ReservationStatus.CONFIRMED,
      paymentStatus: PaymentStatus.VERIFIED,
    });
    const common = {
      reservationId: reservation.id,
      expectedVersion: reservation.version,
      origin: 'CUSTOMER' as const,
      internalReason: 'Annulation concurrente contrôlée',
      admin,
      now: new Date(reservation.startAt.getTime() - 49 * HOUR),
    };
    const inputs = [
      { ...common, commandId: randomUUID() },
      { ...common, commandId: randomUUID() },
    ];
    const decisions = await Promise.allSettled(inputs.map(executeCancellationDecision));
    expect(decisions.filter((decision) => decision.status === 'fulfilled')).toHaveLength(1);
    expect(decisions.filter((decision) => decision.status === 'rejected')).toHaveLength(1);
    const winner = decisions.findIndex((decision) => decision.status === 'fulfilled');
    expect((await executeCancellationDecision(inputs[winner])).replayed).toBe(true);

    await Promise.all([
      queueCancellationNotifications(reservation.id),
      queueCancellationNotifications(reservation.id),
    ]);
    expect(await prisma.financialTask.count({ where: { reservationId: reservation.id } })).toBe(1);
    expect(await prisma.notificationEvent.count({
      where: { reservationId: reservation.id, templateCode: 'I-05' },
    })).toBe(1);
  });
});

describe('POST-01 I-06 financial task lifecycle', () => {
  it('requires the task, rejects a stale version, and never duplicates through completion', async () => {
    const { admin, reservation, payment } = await seedReservation({ paymentStatus: PaymentStatus.VERIFIED });
    await Promise.all([
      queueReservationStatusNotification(reservation.id, ReservationStatus.REJECTED),
      queueReservationStatusNotification(reservation.id, ReservationStatus.REJECTED),
    ]);
    expect(await prisma.notificationEvent.count({
      where: { reservationId: reservation.id, templateCode: 'I-06' },
    })).toBe(0);

    const commandId = randomUUID();
    const decisionInput = {
      reservationId: reservation.id,
      commandId,
      expectedVersion: reservation.version,
      status: ReservationStatus.REJECTED,
      internalReason: 'Créneau indisponible après paiement',
      customerReasonCode: 'SLOT_UNAVAILABLE',
      admin,
    };
    const rejected = await executeReservationDecision(decisionInput);
    expect((await executeReservationDecision(decisionInput)).replayed).toBe(true);
    await expect(executeReservationDecision({
      ...decisionInput,
      commandId: randomUUID(),
      status: ReservationStatus.REJECTED,
    })).rejects.toMatchObject({ code: 'RESERVATION_VERSION_CONFLICT' });

    await Promise.all([
      queueReservationStatusNotification(reservation.id, rejected.value.status, { commandId }),
      queueReservationStatusNotification(reservation.id, rejected.value.status, { commandId }),
    ]);
    const task = await prisma.financialTask.findFirstOrThrow({ where: { reservationId: reservation.id } });
    const alert = await prisma.notificationEvent.findFirstOrThrow({
      where: { reservationId: reservation.id, templateCode: 'I-06' },
    });
    expect(alert.idempotencyKey).toBe(`financial-task:${task.id}:I-06:email`);
    expect(alert.metadata).toMatchObject({ financialTaskId: task.id });

    const sendEmail = vi.fn(async () => ({
      providerMessageId: `post-01-i06-${randomUUID()}`,
      providerStatus: 'accepted',
    }));
    const delivery = await Promise.all([
      processNotificationEvent(alert.id, { sendEmail }),
      processNotificationEvent(alert.id, { sendEmail }),
    ]);
    expect(delivery.sort()).toEqual(['sent', 'skipped']);
    expect(sendEmail).toHaveBeenCalledOnce();

    const engageCommandId = randomUUID();
    const engageInput = {
      paymentId: payment.id,
      commandId: engageCommandId,
      expectedVersion: payment.version,
      status: PaymentStatus.REFUND_PENDING,
      refundAmount: task.amount,
      channel: 'MTN Mobile Money',
      providerReference: 'POST01-REFUND-ENGAGED',
      reason: 'Remboursement engagé',
      admin,
    };
    const engaged = await executeRefundDecision(engageInput);
    expect((await executeRefundDecision(engageInput)).replayed).toBe(true);
    const completeInput = {
      ...engageInput,
      commandId: randomUUID(),
      expectedVersion: engaged.value.payment.version,
      status: PaymentStatus.REFUNDED,
      providerReference: 'POST01-REFUND-COMPLETED',
      reason: 'Remboursement finalisé avec preuve',
    };
    const completed = await executeRefundDecision(completeInput);
    expect((await executeRefundDecision(completeInput)).replayed).toBe(true);
    expect(completed.value.financialTask).toMatchObject({ status: 'COMPLETED' });

    await Promise.all([
      queueReservationStatusNotification(reservation.id, ReservationStatus.REJECTED),
      queueReservationStatusNotification(reservation.id, ReservationStatus.REJECTED),
    ]);
    expect(await prisma.notificationEvent.count({
      where: { reservationId: reservation.id, templateCode: 'I-06' },
    })).toBe(1);
  });
});
