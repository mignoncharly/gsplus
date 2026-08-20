import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import {
  AdminRole,
  ReservationScheduleKind,
  ReservationStatus,
} from '../../src/generated/prisma/client.js';
import { getAvailability } from '../../src/services/availability.js';
import { createOrRefreshReservationIntent } from '../../src/services/reservation-intents.js';
import {
  executeCreateRescheduleRequest,
  executeRescheduleRequestDecision,
} from '../../src/services/reservation-rescheduling.js';
import {
  addBusinessDays,
  businessDateKey,
  businessDayOfWeek,
  businessLocalToInstant,
} from '../../src/utils/business-time.js';

const app = createApp();
const adminPassword = 'phase-2-admin-password';

const resetDatabase = async () => {
  await prisma.dataRightsRequest.deleteMany();
  await prisma.dataIntegrityIncident.deleteMany();
  await prisma.calendarSyncLog.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.financialTask.deleteMany();
  await prisma.adminCommand.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.reservationIntent.deleteMany();
  await prisma.mediaConsentUsage.deleteMany();
  await prisma.mediaItem.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.availabilityBlock.deleteMany();
  await prisma.businessHour.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.package.deleteMany();
  await prisma.adminUser.deleteMany();
};

const nextHappyHoursDate = () => {
  let date = addBusinessDays(businessDateKey(), 30);
  while (![3, 4].includes(businessDayOfWeek(date))) date = addBusinessDays(date, 1);
  return date;
};

const seedScheduling = async (happyHours = false) => {
  const admin = await prisma.adminUser.create({
    data: {
      email: 'phase-2-owner@example.test',
      name: 'Phase 2 Owner',
      passwordHash: await bcrypt.hash(adminPassword, 4),
      role: AdminRole.OWNER,
    },
  });
  const pack = await prisma.package.create({
    data: {
      slug: happyHours ? 'phase-2-happy-hours' : 'phase-2-custom-proposal',
      name: happyHours ? 'Phase 2 Happy Hours' : 'Phase 2 Custom Proposal',
      category: 'Phase 2',
      price: happyHours ? 4_000 : 20_000,
      durationMin: happyHours ? 15 : 60,
      options: happyHours
        ? {
            bookingRules: {
              allowedWeekdays: [3, 4],
              opensAt: '10:00',
              closesAt: '14:00',
              maxReservationsPerDay: 6,
              requiresFullPayment: true,
              combinable: false,
            },
          }
        : undefined,
    },
  });
  await prisma.businessHour.createMany({
    data: Array.from({ length: 7 }, (_item, dayOfWeek) => ({
      dayOfWeek,
      opensAt: '09:00',
      closesAt: '18:00',
      isClosed: false,
    })),
  });
  return { admin, pack };
};

const loginAdmin = async () => {
  const agent = request.agent(app);
  await agent
    .post('/api/admin/login')
    .send({ email: 'phase-2-owner@example.test', password: adminPassword })
    .expect(200);
  return agent;
};

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('Phase 2 scheduling contract', () => {
  it('persists a custom proposal without blocking and revalidates it atomically on acceptance', async () => {
    const { pack } = await seedScheduling();
    const date = addBusinessDays(businessDateKey(), 30);
    const startAt = businessLocalToInstant(date, '10:00');
    const endAt = new Date(startAt.getTime() + 60 * 60_000);
    const block = await prisma.availabilityBlock.create({
      data: { startAt, endAt, reason: 'Phase 2 conflict proof' },
    });
    const idempotencyKey = randomUUID();

    const intentResponse = await request(app)
      .post('/api/reservation-intents')
      .send({
        idempotencyKey,
        packageId: pack.id,
        startAt: startAt.toISOString(),
        scheduleKind: ReservationScheduleKind.CUSTOM_PROPOSAL,
      })
      .expect(201);

    expect(intentResponse.body.data).toMatchObject({
      scheduleKind: ReservationScheduleKind.CUSTOM_PROPOSAL,
      timeZone: 'Africa/Douala',
    });
    await expect(createOrRefreshReservationIntent({
      idempotencyKey: randomUUID(),
      packageId: pack.id,
      startAt,
      scheduleKind: ReservationScheduleKind.STANDARD_HOLD,
    })).rejects.toMatchObject({ code: 'AVAILABILITY_BLOCKED' });

    const created = await request(app)
      .post('/api/reservations')
      .send({
        intentId: intentResponse.body.data.id,
        idempotencyKey,
        locale: 'en',
        customer: {
          firstName: 'Custom',
          lastName: 'Proposal',
          phone: '+237699111222',
          email: 'custom-proposal@example.test',
          gender: 'Other',
        },
        consentImage: false,
        whatsappConsent: false,
        whatsappMarketingConsent: false,
        acceptedTerms: true,
        acceptedPrivacy: true,
        paymentChoice: 'quote',
      })
      .expect(201);

    expect(created.body.data).toMatchObject({
      status: ReservationStatus.PENDING_CONFIRMATION,
      scheduleKind: ReservationScheduleKind.CUSTOM_PROPOSAL,
      requestedTimeZone: 'Africa/Douala',
    });
    const stored = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.body.data.id },
      include: { snapshot: true },
    });
    expect(stored.snapshot).toMatchObject({
      scheduleKind: ReservationScheduleKind.CUSTOM_PROPOSAL,
      requestedStartAt: startAt,
      requestedEndAt: endAt,
      requestedTimeZone: 'Africa/Douala',
      source: 'PUBLIC_CUSTOM_PROPOSAL',
    });

    const agent = await loginAdmin();
    const blockedConfirmation = await agent
      .patch(`/api/admin/reservations/${stored.id}`)
      .send({
        commandId: randomUUID(),
        expectedVersion: stored.version,
        status: ReservationStatus.CONFIRMED,
      })
      .expect(409);
    expect(blockedConfirmation.body.error.code).toBe('AVAILABILITY_BLOCKED');
    expect(await prisma.reservation.findUniqueOrThrow({ where: { id: stored.id } }))
      .toMatchObject({
        status: ReservationStatus.PENDING_CONFIRMATION,
        scheduleKind: ReservationScheduleKind.CUSTOM_PROPOSAL,
        scheduleConfirmedAt: null,
      });

    await prisma.availabilityBlock.delete({ where: { id: block.id } });
    const beforeAcceptance = await getAvailability({ from: date, to: date, packageId: pack.id });
    expect(beforeAcceptance.days[0].slots.find((slot) => slot.time === '10:00'))
      .toMatchObject({ available: true, reason: null });

    const accepted = await agent
      .patch(`/api/admin/reservations/${stored.id}`)
      .send({
        commandId: randomUUID(),
        expectedVersion: stored.version,
        status: ReservationStatus.CONFIRMED,
      })
      .expect(200);
    expect(accepted.body.data).toMatchObject({
      status: ReservationStatus.CONFIRMED,
      scheduleKind: ReservationScheduleKind.STANDARD_HOLD,
    });
    expect(accepted.body.data.scheduleConfirmedAt).toBeTruthy();
    const unchangedSnapshot = await prisma.reservationSnapshot.findUniqueOrThrow({
      where: { reservationId: stored.id },
    });
    expect(unchangedSnapshot.scheduleKind).toBe(ReservationScheduleKind.CUSTOM_PROPOSAL);

    const afterAcceptance = await getAvailability({ from: date, to: date, packageId: pack.id });
    expect(afterAcceptance.days[0].slots.find((slot) => slot.time === '10:00'))
      .toMatchObject({ available: false, reason: 'reservation' });
  });

  it('enforces the Happy Hours quota under races and releases capacity after expiry and reschedule', async () => {
    const { admin, pack } = await seedScheduling(true);
    const date = nextHappyHoursDate();
    const otherDate = addBusinessDays(date, 7);
    const times = ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30'];
    const intents = [];
    for (const time of times) {
      intents.push(await createOrRefreshReservationIntent({
        idempotencyKey: randomUUID(),
        packageId: pack.id,
        startAt: businessLocalToInstant(date, time),
        scheduleKind: ReservationScheduleKind.STANDARD_HOLD,
      }));
    }

    const fullDay = await getAvailability({ from: date, to: date, packageId: pack.id });
    expect(fullDay.days[0].slots.every((slot) => slot.reason === 'package_daily_quota')).toBe(true);
    const overflow = await Promise.allSettled(['13:00', '13:30'].map((time) =>
      createOrRefreshReservationIntent({
        idempotencyKey: randomUUID(),
        packageId: pack.id,
        startAt: businessLocalToInstant(date, time),
        scheduleKind: ReservationScheduleKind.STANDARD_HOLD,
      })));
    expect(overflow.filter((result) => result.status === 'fulfilled')).toHaveLength(0);
    expect(overflow.every((result) =>
      result.status === 'rejected' && result.reason?.code === 'PACKAGE_DAILY_QUOTA_REACHED')).toBe(true);
    const otherDay = await getAvailability({ from: otherDate, to: otherDate, packageId: pack.id });
    expect(otherDay.days[0].slots.some((slot) => slot.available)).toBe(true);

    await prisma.reservationIntent.update({
      where: { id: intents[0].id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const afterExpiry = await getAvailability({ from: date, to: date, packageId: pack.id });
    expect(afterExpiry.days[0].slots.find((slot) => slot.time === '13:00'))
      .toMatchObject({ available: true, reason: null });
    const replacement = await createOrRefreshReservationIntent({
      idempotencyKey: randomUUID(),
      packageId: pack.id,
      startAt: businessLocalToInstant(date, '13:00'),
      scheduleKind: ReservationScheduleKind.STANDARD_HOLD,
    });

    const movableIntent = await prisma.reservationIntent.findUniqueOrThrow({
      where: { id: intents[1].id },
    });
    const customer = await prisma.customer.create({
      data: { firstName: 'Quota', lastName: 'Move', phone: '+237699333444' },
    });
    const reservation = await prisma.reservation.create({
      data: {
        reference: movableIntent.reference,
        customerId: customer.id,
        packageId: pack.id,
        packageVersionId: movableIntent.packageVersionId!,
        startAt: movableIntent.startAt,
        endAt: movableIntent.endAt,
        scheduleKind: ReservationScheduleKind.STANDARD_HOLD,
        requestedStartAt: movableIntent.startAt,
        requestedEndAt: movableIntent.endAt,
        requestedTimeZone: 'Africa/Douala',
        scheduleConfirmedAt: new Date(),
        status: ReservationStatus.CONFIRMED,
        paymentChoice: 'quote',
      },
    });
    await prisma.reservationIntent.update({
      where: { id: movableIntent.id },
      data: { reservationId: reservation.id, consumedAt: new Date() },
    });
    const now = new Date(Date.now() + 60_000);
    const requestedStartAt = businessLocalToInstant(otherDate, '10:30');
    const requestOutcome = await executeCreateRescheduleRequest({
      reservationId: reservation.id,
      commandId: randomUUID(),
      expectedReservationVersion: reservation.version,
      requestedStartAt,
      reason: 'Release Happy Hours capacity',
      admin,
      now,
    });
    await executeRescheduleRequestDecision({
      requestId: requestOutcome.value.request.id,
      commandId: randomUUID(),
      expectedVersion: requestOutcome.value.request.version,
      decision: 'ACCEPTED',
      internalReason: 'Capacity release concurrency proof',
      admin,
      now,
    });

    const afterMove = await getAvailability({ from: date, to: date, packageId: pack.id });
    expect(afterMove.days[0].slots.find((slot) => slot.time === '10:30'))
      .toMatchObject({ available: true, reason: null });
    await expect(createOrRefreshReservationIntent({
      idempotencyKey: randomUUID(),
      packageId: pack.id,
      startAt: businessLocalToInstant(date, '10:30'),
      scheduleKind: ReservationScheduleKind.STANDARD_HOLD,
    })).resolves.toMatchObject({ scheduleKind: ReservationScheduleKind.STANDARD_HOLD });
    expect(replacement.scheduleKind).toBe(ReservationScheduleKind.STANDARD_HOLD);
    await expect(createOrRefreshReservationIntent({
      idempotencyKey: randomUUID(),
      packageId: pack.id,
      startAt: businessLocalToInstant(date, '13:30'),
      scheduleKind: ReservationScheduleKind.STANDARD_HOLD,
    })).rejects.toMatchObject({ code: 'PACKAGE_DAILY_QUOTA_REACHED' });
  });
});
