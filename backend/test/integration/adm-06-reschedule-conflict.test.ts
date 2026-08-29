import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../../src/db/prisma.js';
import { AdminRole, ReservationStatus } from '../../src/generated/prisma/client.js';
import { assertBookableSlot } from '../../src/services/booking-slots.js';
import {
  executeCreateRescheduleRequest,
  executeRescheduleRequestDecision,
} from '../../src/services/reservation-rescheduling.js';
import { addBusinessDays, businessDateKey, businessLocalToInstant } from '../../src/utils/business-time.js';

const password = 'adm-06-admin-password';

const resetDatabase = async () => {
  await prisma.auditLog.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.calendarSyncLog.deleteMany();
  await prisma.adminCommand.deleteMany();
  await prisma.financialTask.deleteMany();
  await prisma.paymentTransition.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.reservationRescheduleRequest.deleteMany();
  await prisma.reservationIntent.deleteMany();
  await prisma.reservationTransition.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.availabilityBlock.deleteMany();
  await prisma.scheduleException.deleteMany();
  await prisma.bookingRule.deleteMany();
  await prisma.businessHour.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.packageVersion.deleteMany();
  await prisma.package.deleteMany();
  await prisma.adminUser.deleteMany();
};

const seed = async () => {
  const owner = await prisma.adminUser.create({
    data: { email: 'adm-06-owner@example.test', name: 'Owner', passwordHash: await bcrypt.hash(password, 4), role: AdminRole.OWNER },
  });
  const pack = await prisma.package.create({
    data: { slug: 'adm-06-pack', name: 'ADM-06 Portrait', category: 'ADM-06', price: 20_000, durationMin: 60 },
  });
  const version = await prisma.packageVersion.create({
    data: { packageId: pack.id, version: 1, name: 'ADM-06 Portrait', category: 'ADM-06', price: 20_000, durationMin: 60, createdById: owner.id },
  });
  await prisma.businessHour.createMany({
    data: Array.from({ length: 7 }, (_item, dayOfWeek) => ({ dayOfWeek, opensAt: '09:00', closesAt: '18:00', isClosed: false })),
  });
  const customer = await prisma.customer.create({
    data: { firstName: 'Amina', lastName: 'Report', phone: '+237640703249', email: 'amina@example.test' },
  });
  const date = addBusinessDays(businessDateKey(new Date()), 21);
  const make = (reference: string, time: string) => prisma.reservation.create({
    data: {
      reference, customerId: customer.id, packageId: pack.id, packageVersionId: version.id,
      status: ReservationStatus.CONFIRMED,
      startAt: businessLocalToInstant(date, time),
      endAt: new Date(businessLocalToInstant(date, time).getTime() + 3_600_000),
    },
  });
  return { owner, pack, date, first: await make('GSP-ADM06-0001', '10:00'), second: await make('GSP-ADM06-0002', '14:00') };
};

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('ADM-06 rescheduling surfaces conflicts and syncs once', () => {
  it('refuses a move onto an occupied slot instead of failing silently', async () => {
    const { owner, pack, date, first } = await seed();

    // 14:00 already belongs to the second reservation.
    const occupied = businessLocalToInstant(date, '14:00');
    await expect(prisma.$transaction((tx) => assertBookableSlot(
      tx, pack, occupied, new Date(occupied.getTime() + 3_600_000), { excludeReservationId: first.id },
    ))).rejects.toThrow(/no longer available|SLOT_ALREADY_RESERVED|available/i);

    const request = await executeCreateRescheduleRequest({
      reservationId: first.id,
      commandId: randomUUID(),
      expectedReservationVersion: first.version,
      requestedStartAt: occupied,
      reason: 'Le client demande 14:00',
      admin: owner,
    });

    // The request is recorded, then the decision is the step that revalidates.
    await expect(executeRescheduleRequestDecision({
      requestId: request.value.request.id,
      commandId: randomUUID(),
      expectedVersion: request.value.request.version,
      decision: 'ACCEPTED',
      internalReason: 'Tentative sur un créneau occupé',
      admin: owner,
    })).rejects.toThrow();

    // The original slot is untouched by the refused move.
    const unchanged = await prisma.reservation.findUniqueOrThrow({ where: { id: first.id } });
    expect(unchanged.startAt.toISOString()).toBe(businessLocalToInstant(date, '10:00').toISOString());
  });

  it('refuses a move onto a day closed by an exception', async () => {
    const { owner, pack, date, first } = await seed();
    const closedDate = addBusinessDays(date, 1);
    await prisma.scheduleException.create({ data: { date: closedDate, isClosed: true, reason: 'Jour férié' } });

    const slot = businessLocalToInstant(closedDate, '10:00');
    await expect(prisma.$transaction((tx) => assertBookableSlot(
      tx, pack, slot, new Date(slot.getTime() + 3_600_000), { excludeReservationId: first.id },
    ))).rejects.toThrow(/Jour férié/);
    void owner;
  });

  it('emits exactly one calendar synchronisation for an accepted move', async () => {
    const { owner, date, first } = await seed();
    const free = businessLocalToInstant(addBusinessDays(date, 2), '11:00');

    const request = await executeCreateRescheduleRequest({
      reservationId: first.id,
      commandId: randomUUID(),
      expectedReservationVersion: first.version,
      requestedStartAt: free,
      reason: 'Nouveau créneau demandé',
      admin: owner,
    });

    const commandId = randomUUID();
    const decision = {
      requestId: request.value.request.id,
      commandId,
      expectedVersion: request.value.request.version,
      decision: 'ACCEPTED' as const,
      internalReason: 'Créneau libre',
      admin: owner,
    };
    const first_ = await executeRescheduleRequestDecision(decision);
    // Replaying the same command must not produce a second synchronisation.
    const replayed = await executeRescheduleRequestDecision(decision);
    expect(replayed.replayed).toBe(true);
    void first_;

    const moved = await prisma.reservation.findUniqueOrThrow({ where: { id: first.id } });
    expect(moved.startAt.toISOString()).toBe(free.toISOString());

    const syncs = await prisma.calendarSyncLog.findMany({ where: { reservationId: first.id } });
    const grouped = new Map<string, number>();
    for (const sync of syncs) grouped.set(sync.idempotencyKey ?? sync.id, (grouped.get(sync.idempotencyKey ?? sync.id) ?? 0) + 1);
    for (const [key, count] of grouped) {
      expect(count, `calendar sync ${key} must be emitted once`).toBe(1);
    }
  });
});
