import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../../src/db/prisma.js';
import { AdminRole, PaymentStatus, ReservationStatus } from '../../src/generated/prisma/client.js';
import {
  queueCancellationNotifications,
  queueRefundStatusNotifications,
  queueReservationStatusNotification,
} from '../../src/emails/notifications.js';
import {
  executeCancellationDecision,
  executeRefundDecision,
  executeReservationDecision,
} from '../../src/services/payment-reservation-commands.js';

const resetDatabase = async () => {
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

const seedPaidReservation = async () => {
  const admin = await prisma.adminUser.create({
    data: {
      email: 'finance-owner@example.test',
      name: 'Finance Owner',
      passwordHash: await bcrypt.hash('finance-test-password', 4),
      role: AdminRole.OWNER,
    },
  });
  const pack = await prisma.package.create({
    data: { slug: 'finance-notif', name: 'Portrait Finance', category: 'Tests', price: 20000, durationMin: 60 },
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
    data: { firstName: 'Aline', lastName: 'Finance', phone: '+237699777777', email: 'aline.finance@example.test' },
  });
  const capturedAt = new Date('2026-08-01T20:00:00.000Z');
  const startAt = new Date('2030-03-10T10:00:00.000Z');
  const endAt = new Date('2030-03-10T11:00:00.000Z');
  const reservation = await prisma.reservation.create({
    data: {
      reference: 'GSP-300310-FIN1',
      customerId: customer.id,
      packageId: pack.id,
      packageVersionId: packageVersion.id,
      startAt,
      endAt,
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
          durationMin: 60,
          amount: 20000,
          currency: 'XAF',
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
          amount: 20000,
          method: 'mtn_momo',
          transactionRef: 'PAID-FIN-001',
          status: PaymentStatus.VERIFIED,
          verifiedAt: capturedAt,
          verifiedById: admin.id,
        },
      },
    },
    include: { payments: true },
  });
  return { admin, reservation, payment: reservation.payments[0] };
};

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('NOTIF-01 durable financial workflow', () => {
  const cancelPaidReservation = async (
    origin: 'CUSTOMER' | 'STUDIO',
    leadTimeMs: number,
  ) => {
    const fixture = await seedPaidReservation();
    const now = new Date(fixture.reservation.startAt.getTime() - leadTimeMs);
    const outcome = await executeCancellationDecision({
      reservationId: fixture.reservation.id,
      commandId: randomUUID(),
      expectedVersion: fixture.reservation.version,
      origin,
      reason: origin === 'STUDIO' ? 'Incident technique Studio' : 'Demande du client',
      admin: fixture.admin,
      now,
    });
    await queueCancellationNotifications(fixture.reservation.id, { now });
    return { ...fixture, outcome, now };
  };

  it('applies a 50% refund strictly more than 48 hours before a customer cancellation', async () => {
    const { admin, reservation, payment, outcome } = await cancelPaidReservation(
      'CUSTOMER',
      48 * 60 * 60 * 1000 + 1,
    );
    expect(outcome.value.financialTask).toMatchObject({
      paymentId: payment.id,
      type: 'PARTIAL_REFUND',
      status: 'PENDING',
      amount: 10000,
    });
    expect(await prisma.notificationEvent.findMany({
      where: { reservationId: reservation.id },
      orderBy: { templateCode: 'asc' },
      select: { templateCode: true },
    })).toEqual([{ templateCode: 'E-11' }, { templateCode: 'I-05' }]);
    const refund = await executeRefundDecision({
      paymentId: payment.id,
      commandId: randomUUID(),
      expectedVersion: payment.version,
      status: PaymentStatus.REFUND_PENDING,
      refundAmount: 10000,
      channel: 'MTN Mobile Money',
      providerReference: 'PARTIAL-REFUND-10000',
      reason: 'Remboursement partiel engagé',
      admin,
    });
    expect(refund.value).toMatchObject({
      payment: { status: PaymentStatus.REFUND_PENDING, refundAmount: 10000 },
      financialTask: { type: 'PARTIAL_REFUND', status: 'IN_PROGRESS', amount: 10000 },
    });
  });

  it('applies no refund exactly 48 hours before a customer cancellation', async () => {
    const { reservation, outcome } = await cancelPaidReservation('CUSTOMER', 48 * 60 * 60 * 1000);
    expect(outcome.value.financialTask).toBeNull();
    expect(await prisma.financialTask.count({ where: { reservationId: reservation.id } })).toBe(0);
    expect(await prisma.notificationEvent.findMany({
      where: { reservationId: reservation.id },
      select: { templateCode: true },
    })).toEqual([{ templateCode: 'E-12' }]);
  });

  it('applies no refund less than 48 hours before a customer cancellation', async () => {
    const { reservation, outcome } = await cancelPaidReservation(
      'CUSTOMER',
      48 * 60 * 60 * 1000 - 1,
    );
    expect(outcome.value.financialTask).toBeNull();
    expect(await prisma.notificationEvent.findMany({
      where: { reservationId: reservation.id },
      select: { templateCode: true },
    })).toEqual([{ templateCode: 'E-12' }]);
  });

  it('opens a full refund and E-13/I-05 for a Studio cancellation at any lead time', async () => {
    const { reservation, payment, outcome } = await cancelPaidReservation('STUDIO', 60 * 60 * 1000);
    expect(outcome.value.financialTask).toMatchObject({
      paymentId: payment.id,
      type: 'FULL_REFUND',
      status: 'PENDING',
      amount: 20000,
    });
    expect(await prisma.notificationEvent.findMany({
      where: { reservationId: reservation.id },
      orderBy: { templateCode: 'asc' },
      select: { templateCode: true },
    })).toEqual([{ templateCode: 'E-13' }, { templateCode: 'I-05' }]);
  });

  it('atomically creates one full-refund task before E-07 and I-06', async () => {
    const { admin, reservation, payment } = await seedPaidReservation();
    const outcome = await executeReservationDecision({
      reservationId: reservation.id,
      commandId: randomUUID(),
      expectedVersion: reservation.version,
      status: ReservationStatus.REJECTED,
      reason: 'Créneau finalement indisponible',
      admin,
    });
    await queueReservationStatusNotification(reservation.id, outcome.value.status);
    await queueReservationStatusNotification(reservation.id, outcome.value.status);

    const task = await prisma.financialTask.findFirstOrThrow({ where: { reservationId: reservation.id } });
    expect(task).toMatchObject({
      paymentId: payment.id,
      type: 'FULL_REFUND',
      status: 'PENDING',
      amount: 20000,
      currency: 'XAF',
    });
    const events = await prisma.notificationEvent.findMany({
      where: { reservationId: reservation.id, templateCode: { in: ['E-07', 'I-06'] } },
    });
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.templateCode).sort()).toEqual(['E-07', 'I-06']);
  });

  it('queues E-20 only after engagement and E-21 only after proved finalization', async () => {
    const { admin, reservation, payment } = await seedPaidReservation();
    const rejected = await executeReservationDecision({
      reservationId: reservation.id,
      commandId: randomUUID(),
      expectedVersion: reservation.version,
      status: ReservationStatus.REJECTED,
      reason: 'Annulation Studio',
      admin,
    });
    await queueReservationStatusNotification(reservation.id, rejected.value.status);

    const pending = await executeRefundDecision({
      paymentId: payment.id,
      commandId: randomUUID(),
      expectedVersion: payment.version,
      status: PaymentStatus.REFUND_PENDING,
      refundAmount: 20000,
      channel: 'MTN Mobile Money',
      providerReference: 'REFUND-ENGAGED-7294',
      reason: 'Remboursement intégral engagé',
      admin,
    });
    await queueRefundStatusNotifications(payment.id, pending.value.payment.status);
    expect(await prisma.notificationEvent.count({ where: { reservationId: reservation.id, templateCode: 'E-20' } })).toBe(1);
    expect(await prisma.notificationEvent.count({ where: { reservationId: reservation.id, templateCode: 'E-21' } })).toBe(0);

    const completed = await executeRefundDecision({
      paymentId: payment.id,
      commandId: randomUUID(),
      expectedVersion: pending.value.payment.version,
      status: PaymentStatus.REFUNDED,
      refundAmount: 20000,
      channel: 'MTN Mobile Money',
      providerReference: 'REFUND-FINAL-7294',
      reason: 'Preuve opérateur confirmée',
      admin,
    });
    await queueRefundStatusNotifications(payment.id, completed.value.payment.status);
    const finalNotice = await prisma.notificationEvent.findFirstOrThrow({
      where: { reservationId: reservation.id, templateCode: 'E-21' },
    });
    expect(finalNotice.renderedContent).toMatchObject({ code: 'E-21', audience: 'customer' });
    expect((finalNotice.renderedContent as { text: string }).text).toContain('•••• 7294');
    expect(await prisma.financialTask.findFirstOrThrow({ where: { reservationId: reservation.id } })).toMatchObject({
      status: 'COMPLETED',
      providerReference: 'REFUND-FINAL-7294',
    });
  });
});
