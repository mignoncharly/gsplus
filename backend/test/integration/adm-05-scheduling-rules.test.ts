import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { AdminRole } from '../../src/generated/prisma/client.js';
import { getAvailability } from '../../src/services/availability.js';
import { assertBookableSlot } from '../../src/services/booking-slots.js';
import { addBusinessDays, businessDateKey, businessLocalToInstant } from '../../src/utils/business-time.js';

const app = createApp();
const password = 'adm-05-admin-password';

const resetDatabase = async () => {
  await prisma.auditLog.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.financialTask.deleteMany();
  await prisma.calendarSyncLog.deleteMany();
  await prisma.paymentTransition.deleteMany();
  await prisma.payment.deleteMany();
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
    data: { email: 'adm-05-owner@example.test', name: 'Owner', passwordHash: await bcrypt.hash(password, 4), role: AdminRole.OWNER },
  });
  const pack = await prisma.package.create({
    data: { slug: 'adm-05-pack', name: 'ADM-05 Portrait', category: 'ADM-05', price: 20_000, durationMin: 60 },
  });
  await prisma.businessHour.createMany({
    data: Array.from({ length: 7 }, (_item, dayOfWeek) => ({ dayOfWeek, opensAt: '09:00', closesAt: '18:00', isClosed: false })),
  });
  return { owner, pack };
};

const signInAsStaff = async () => {
  const email = 'adm-05-staff@example.test';
  await prisma.adminUser.create({
    data: { email, name: 'Staff', passwordHash: await bcrypt.hash(password, 4), role: AdminRole.STAFF },
  });
  const agent = request.agent(app);
  await agent.post('/api/admin/login').send({ email, password }).expect(200);
  return agent;
};

const signIn = async () => {
  const agent = request.agent(app);
  await agent.post('/api/admin/login').send({ email: 'adm-05-owner@example.test', password }).expect(200);
  return agent;
};

/** A weekday far enough ahead to sit clear of any notice rule under test. */
const targetDate = () => addBusinessDays(businessDateKey(new Date()), 21);

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('ADM-05 the studio can change its own schedule', () => {
  it('reserves every planning setting and availability mutation for the owner', async () => {
    await seed();
    const date = targetDate();
    const agent = await signInAsStaff();

    await agent.get('/api/admin/schedule/business-hours').expect(403);
    await agent.get('/api/admin/schedule/exceptions').expect(403);
    await agent.get('/api/admin/schedule/booking-rules').expect(403);
    await agent.get('/api/admin/schedule/planning').query({ from: date, to: date }).expect(403);
    await agent.get('/api/admin/calendar/sync-logs').expect(403);
    await agent.get('/api/admin/calendar/health').expect(403);
    await agent.get('/api/admin/availability-blocks').expect(403);

    await agent.put('/api/admin/schedule/business-hours/1')
      .send({ dayOfWeek: 1, opensAt: '09:00', closesAt: '18:00', isClosed: false })
      .expect(403);
    await agent.put('/api/admin/schedule/exceptions')
      .send({ date, isClosed: true, reason: 'Tentative équipe' })
      .expect(403);
    await agent.put('/api/admin/schedule/booking-rules')
      .send({ packageId: null, minNoticeMinutes: 60, horizonDays: null, dailyCapacity: null, bufferMinutes: null })
      .expect(403);
    await agent.post('/api/admin/availability-blocks')
      .send({
        startAt: businessLocalToInstant(date, '10:00').toISOString(),
        endAt: businessLocalToInstant(date, '11:00').toISOString(),
        reason: 'Tentative équipe',
      })
      .expect(403);

  });
  it('records exactly one Cal.com schedule-sync outcome for an accepted planning mutation', async () => {
    await seed();
    const agent = await signIn();
    const response = await agent.put('/api/admin/schedule/business-hours/1')
      .send({ dayOfWeek: 1, opensAt: '10:00', closesAt: '18:00', isClosed: false })
      .expect(200);
    expect(response.body.meta.calendarSync.action).toBe('SCHEDULE_UPDATE');
    expect(await prisma.calendarSyncLog.count({ where: { action: 'SCHEDULE_UPDATE' } })).toBe(1);
  });
  it('changes an opening hour through the API and the public grid follows', async () => {
    const { pack } = await seed();
    const date = targetDate();

    const before = await getAvailability({ from: date, to: date, packageId: pack.id });
    expect(before.days[0].opensAt).toBe('09:00');

    const agent = await signIn();
    await agent.put(`/api/admin/schedule/business-hours/${before.days[0].dayOfWeek}`)
      .send({ dayOfWeek: before.days[0].dayOfWeek, opensAt: '11:00', closesAt: '16:00', isClosed: false })
      .expect(200);

    const after = await getAvailability({ from: date, to: date, packageId: pack.id });
    expect(after.days[0].opensAt).toBe('11:00');
    expect(after.days[0].closesAt).toBe('16:00');
    expect(after.days[0].slots[0].time).toBe('11:00');

    const audit = await prisma.auditLog.findFirst({ where: { action: 'schedule.business_hour.update' } });
    expect(audit).not.toBeNull();
  });

  it('closes a single day with a dated exception without touching the weekly pattern', async () => {
    const { pack } = await seed();
    const closedDate = targetDate();
    const nextDate = addBusinessDays(closedDate, 1);

    const agent = await signIn();
    await agent.put('/api/admin/schedule/exceptions')
      .send({ date: closedDate, isClosed: true, reason: 'Jour férié' })
      .expect(200);

    const availability = await getAvailability({ from: closedDate, to: nextDate, packageId: pack.id });
    expect(availability.days[0].isClosed).toBe(true);
    expect(availability.days[0].closureReason).toBe('Jour férié');
    expect(availability.days[0].slots).toHaveLength(0);
    // The following day, governed by the unchanged weekly pattern, is still open.
    expect(availability.days[1].isClosed).toBe(false);
  });

  it('keeps the public grid and the booking check in agreement about a break', async () => {
    const { pack } = await seed();
    const date = targetDate();
    const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();

    const agent = await signIn();
    await agent.put(`/api/admin/schedule/business-hours/${dayOfWeek}`)
      .send({ dayOfWeek, opensAt: '09:00', closesAt: '18:00', isClosed: false, breaks: [{ start: '12:00', end: '14:00' }] })
      .expect(200);

    const availability = await getAvailability({ from: date, to: date, packageId: pack.id });
    const paused = availability.days[0].slots.filter((slot) => slot.reason === 'schedule_break');
    expect(paused.length).toBeGreaterThan(0);

    // Every slot the grid marks unavailable must also be refused by the booking check,
    // and every slot it offers must be accepted. A disagreement here is the failure
    // mode that shows a customer a slot the booking then rejects.
    for (const slot of availability.days[0].slots) {
      const start = new Date(slot.startAt);
      const end = new Date(slot.endAt);
      const attempt = prisma.$transaction((tx) => assertBookableSlot(tx, pack, start, end));
      if (slot.available) await expect(attempt).resolves.toBeUndefined();
      else await expect(attempt).rejects.toThrow();
    }
  });

  it('enforces a minimum notice and a booking horizon once configured', async () => {
    const { pack } = await seed();
    const agent = await signIn();
    await agent.put('/api/admin/schedule/booking-rules')
      .send({ packageId: null, minNoticeMinutes: 2880, horizonDays: 10, dailyCapacity: null, bufferMinutes: null })
      .expect(200);

    const soon = addBusinessDays(businessDateKey(new Date()), 1);
    const far = addBusinessDays(businessDateKey(new Date()), 40);
    const soonSlot = businessLocalToInstant(soon, '10:00');
    const farSlot = businessLocalToInstant(far, '10:00');

    await expect(prisma.$transaction((tx) => assertBookableSlot(tx, pack, soonSlot, new Date(soonSlot.getTime() + 3_600_000))))
      .rejects.toThrow(/trop proche/);
    await expect(prisma.$transaction((tx) => assertBookableSlot(tx, pack, farSlot, new Date(farSlot.getTime() + 3_600_000))))
      .rejects.toThrow(/horizon/);
  });

  it('lets a package override extend the public booking horizon without changing other formulas', async () => {
    const { pack } = await seed();
    const agent = await signIn();
    await agent.put('/api/admin/schedule/booking-rules')
      .send({ packageId: null, minNoticeMinutes: null, horizonDays: 5, dailyCapacity: null, bufferMinutes: null })
      .expect(200);
    await agent.put('/api/admin/schedule/booking-rules')
      .send({ packageId: pack.id, minNoticeMinutes: null, horizonDays: 20, dailyCapacity: null, bufferMinutes: null })
      .expect(200);

    const date = addBusinessDays(businessDateKey(new Date()), 10);
    const slot = businessLocalToInstant(date, '10:00');
    const availability = await getAvailability({ from: date, to: date, packageId: pack.id });
    expect(availability.days[0].slots.some((item) => item.startAt === slot.toISOString() && item.available)).toBe(true);
    await expect(prisma.$transaction((tx) => assertBookableSlot(tx, pack, slot, new Date(slot.getTime() + 3_600_000))))
      .resolves.toBeUndefined();
  });

  it('leaves booking unchanged when no rule is configured', async () => {
    const { pack } = await seed();
    // No BookingRule row at all: a slot years ahead must still be bookable, because
    // nothing restricted it before this phase.
    const far = addBusinessDays(businessDateKey(new Date()), 900);
    const slot = businessLocalToInstant(far, '10:00');
    await expect(prisma.$transaction((tx) => assertBookableSlot(tx, pack, slot, new Date(slot.getTime() + 3_600_000))))
      .resolves.toBeUndefined();
  });

  it('refuses an incoherent schedule instead of producing a day with no slots', async () => {
    await seed();
    const agent = await signIn();
    await agent.put('/api/admin/schedule/business-hours/1')
      .send({ dayOfWeek: 1, opensAt: '18:00', closesAt: '09:00', isClosed: false })
      .expect(400);
    await agent.put('/api/admin/schedule/business-hours/1')
      .send({ dayOfWeek: 1, opensAt: '09:00', closesAt: '18:00', isClosed: false, breaks: [{ start: '08:00', end: '10:00' }] })
      .expect(400);
  });

  it('keeps one global booking rule however many times it is saved', async () => {
    await seed();
    const agent = await signIn();
    for (const notice of [60, 120, 180]) {
      await agent.put('/api/admin/schedule/booking-rules')
        .send({ packageId: null, minNoticeMinutes: notice, horizonDays: null, dailyCapacity: null, bufferMinutes: null })
        .expect(200);
    }
    expect(await prisma.bookingRule.count({ where: { packageId: null } })).toBe(1);
  });

  it('serves the planning window and the Cal.com health panel', async () => {
    const { pack } = await seed();
    const date = targetDate();
    await prisma.availabilityBlock.create({
      data: { startAt: businessLocalToInstant(date, '10:00'), endAt: businessLocalToInstant(date, '11:00'), reason: 'Maintenance' },
    });
    void pack;

    const agent = await signIn();
    const planning = await agent.get('/api/admin/schedule/planning').query({ from: date, to: date }).expect(200);
    expect(planning.body.data.days).toHaveLength(1);
    expect(planning.body.data.blocks).toHaveLength(1);

    const health = await agent.get('/api/admin/calendar/health').expect(200);
    expect(health.body.data).toHaveProperty('healthy');
    expect(health.body.data).toHaveProperty('pendingCount');
  });
});
