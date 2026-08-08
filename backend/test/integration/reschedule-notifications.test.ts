import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../../src/db/prisma.js';
import { AdminRole, ReservationStatus } from '../../src/generated/prisma/client.js';
import {
  queueRescheduleRequestDecisionNotification,
  queueRescheduleRequestNotifications,
} from '../../src/emails/notifications.js';
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
  await prisma.reservationIntent.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.businessHour.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.package.deleteMany();
  await prisma.adminUser.deleteMany();
};

const seedReservation = async () => {
  const admin = await prisma.adminUser.create({
    data: {
      email: 'report-owner@example.test',
      name: 'Report Owner',
      passwordHash: await bcrypt.hash('report-test-password', 4),
      role: AdminRole.OWNER,
    },
  });
  const pack = await prisma.package.create({
    data: { slug: 'report-test', name: 'Report Test', category: 'Tests', price: 20000, durationMin: 60 },
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
  await prisma.businessHour.createMany({
    data: Array.from({ length: 7 }, (_item, dayOfWeek) => ({
      dayOfWeek,
      opensAt: '08:00',
      closesAt: '18:00',
      isClosed: false,
    })),
  });
  const customer = await prisma.customer.create({
    data: {
      firstName: 'Aline',
      lastName: 'Report',
      phone: '+237699666666',
      email: 'aline.report@example.test',
    },
  });
  const capturedAt = new Date('2026-08-01T20:00:00.000Z');
  const startAt = new Date('2030-03-10T10:00:00.000Z');
  const endAt = new Date(startAt.getTime() + HOUR);
  const reservation = await prisma.reservation.create({
    data: {
      reference: `GSP-REPORT-${randomUUID().slice(0, 8)}`,
      customerId: customer.id,
      packageId: pack.id,
      packageVersionId: packageVersion.id,
      startAt,
      endAt,
      status: ReservationStatus.CONFIRMED,
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
    },
  });
  return { admin, reservation };
};

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('NOTIF-01 durable reschedule workflow', () => {
  it('records E-08/I-04 idempotently and accepts at exactly 48 hours with E-09', async () => {
    const { admin, reservation } = await seedReservation();
    const commandId = randomUUID();
    const now = new Date(reservation.startAt.getTime() - 48 * HOUR);
    const requestedStartAt = new Date('2030-03-12T10:00:00.000Z');
    const input = {
      reservationId: reservation.id,
      commandId,
      expectedReservationVersion: reservation.version,
      requestedStartAt,
      reason: 'Demande client enregistrée',
      admin,
      now,
    };
    const created = await executeCreateRescheduleRequest(input);
    const replay = await executeCreateRescheduleRequest({ ...input, now: new Date(now.getTime() + 1000) });
    expect(replay.replayed).toBe(true);
    expect(replay.value.request.id).toBe(created.value.request.id);
    await queueRescheduleRequestNotifications(created.value.request.id);
    await queueRescheduleRequestNotifications(created.value.request.id);

    const accepted = await executeRescheduleRequestDecision({
      requestId: created.value.request.id,
      commandId: randomUUID(),
      expectedVersion: created.value.request.version,
      decision: 'ACCEPTED',
      reason: 'Créneau disponible',
      admin,
    });
    await queueRescheduleRequestDecisionNotification(created.value.request.id);
    expect(accepted.value).toMatchObject({
      request: { status: 'ACCEPTED', version: 2 },
      reservation: { startAt: requestedStartAt },
    });
    expect(await prisma.notificationEvent.findMany({
      where: { reservationId: reservation.id },
      orderBy: { templateCode: 'asc' },
      select: { templateCode: true },
    })).toEqual([{ templateCode: 'E-08' }, { templateCode: 'E-09' }, { templateCode: 'I-04' }]);
  });

  it('cannot accept below 48 hours and sends E-10 only after a rejection fact', async () => {
    const { admin, reservation } = await seedReservation();
    const originalStartAt = reservation.startAt;
    const created = await executeCreateRescheduleRequest({
      reservationId: reservation.id,
      commandId: randomUUID(),
      expectedReservationVersion: reservation.version,
      requestedStartAt: new Date('2030-03-12T10:00:00.000Z'),
      reason: 'Demande tardive',
      admin,
      now: new Date(reservation.startAt.getTime() - 48 * HOUR + 1),
    });
    await queueRescheduleRequestNotifications(created.value.request.id);
    await expect(executeRescheduleRequestDecision({
      requestId: created.value.request.id,
      commandId: randomUUID(),
      expectedVersion: 1,
      decision: 'ACCEPTED',
      reason: 'Ne doit pas passer',
      admin,
    })).rejects.toMatchObject({ code: 'RESCHEDULE_NOTICE_TOO_SHORT' });
    expect(await prisma.notificationEvent.count({
      where: { reservationId: reservation.id, templateCode: 'E-10' },
    })).toBe(0);

    await executeRescheduleRequestDecision({
      requestId: created.value.request.id,
      commandId: randomUUID(),
      expectedVersion: 1,
      decision: 'REJECTED',
      reason: 'Demande reçue à moins de 48 heures',
      admin,
    });
    await queueRescheduleRequestDecisionNotification(created.value.request.id);
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } })).startAt)
      .toEqual(originalStartAt);
    expect(await prisma.notificationEvent.count({
      where: { reservationId: reservation.id, templateCode: 'E-10' },
    })).toBe(1);
  });

  it('enforces one accepted report while allowing the second request to be rejected', async () => {
    const { admin, reservation } = await seedReservation();
    const first = await executeCreateRescheduleRequest({
      reservationId: reservation.id,
      commandId: randomUUID(),
      expectedReservationVersion: 1,
      requestedStartAt: new Date('2030-03-12T10:00:00.000Z'),
      reason: 'Premier report',
      admin,
      now: new Date('2030-03-01T10:00:00.000Z'),
    });
    const firstAccepted = await executeRescheduleRequestDecision({
      requestId: first.value.request.id,
      commandId: randomUUID(),
      expectedVersion: 1,
      decision: 'ACCEPTED',
      reason: 'Premier report accordé',
      admin,
    });
    const second = await executeCreateRescheduleRequest({
      reservationId: reservation.id,
      commandId: randomUUID(),
      expectedReservationVersion: firstAccepted.value.reservation.version,
      requestedStartAt: new Date('2030-03-14T10:00:00.000Z'),
      reason: 'Deuxième report',
      admin,
      now: new Date('2030-03-02T10:00:00.000Z'),
    });
    await expect(executeRescheduleRequestDecision({
      requestId: second.value.request.id,
      commandId: randomUUID(),
      expectedVersion: 1,
      decision: 'ACCEPTED',
      reason: 'Ne doit pas être accordé',
      admin,
    })).rejects.toMatchObject({ code: 'RESCHEDULE_LIMIT_REACHED' });
    const rejected = await executeRescheduleRequestDecision({
      requestId: second.value.request.id,
      commandId: randomUUID(),
      expectedVersion: 1,
      decision: 'REJECTED',
      reason: 'Un report a déjà été accordé',
      admin,
    });
    expect(rejected.value.request.status).toBe('REJECTED');
  });
});
