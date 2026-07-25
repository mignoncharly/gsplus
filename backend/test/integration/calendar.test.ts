import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

const resetDatabase = async () => {
  const { prisma } = await import('../../src/db/prisma.js');
  await prisma.calendarSyncLog.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.availabilityBlock.deleteMany();
  await prisma.mediaItem.deleteMany();
  await prisma.businessHour.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.package.deleteMany();
  await prisma.adminUser.deleteMany();
};

const seedConfirmedReservation = async () => {
  const { prisma } = await import('../../src/db/prisma.js');
  const { ReservationStatus } = await import('../../src/generated/prisma/client.js');

  const pack = await prisma.package.create({
    data: {
      slug: 'calendar-package',
      name: 'Calendar Package',
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
      description: pack.description,
      price: pack.price,
      currency: pack.currency,
      durationMin: pack.durationMin,
    },
  });
  const customer = await prisma.customer.create({
    data: {
      firstName: 'Calendar',
      lastName: 'Client',
      phone: '+237699333333',
      email: 'calendar@example.test',
    },
  });

  return prisma.reservation.create({
    data: {
      reference: `GSPCAL${Date.now()}`,
      customerId: customer.id,
      packageId: pack.id,
      packageVersionId: packageVersion.id,
      startAt: new Date('2030-01-15T10:00:00.000Z'),
      endAt: new Date('2030-01-15T11:00:00.000Z'),
      status: ReservationStatus.CONFIRMED,
      acceptedTermsAt: new Date(),
    },
  });
};

beforeEach(async () => {
  vi.resetModules();
  process.env.CALCOM_API_BASE_URL = 'https://api.cal.test/v2';
  process.env.CALCOM_API_VERSION = '2024-06-14';
  process.env.CALCOM_API_KEY = '';
  process.env.CALCOM_EVENT_TYPE_ID = '';
  process.env.CALCOM_TIME_ZONE = 'Africa/Douala';

  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);

  await resetDatabase();
});

afterAll(async () => {
  const { prisma } = await import('../../src/db/prisma.js');
  await prisma.$disconnect();
});

describe('Calendar sync reliability', () => {
  it('creates a booking through Cal.com and records the provider result', async () => {
    process.env.CALCOM_API_KEY = 'test-calcom-key';
    process.env.CALCOM_EVENT_TYPE_ID = '123';
    const reservation = await seedConfirmedReservation();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { uid: 'cal-booking-1' } }),
    });

    const { syncReservationToCalendar } = await import('../../src/services/calendar.js');
    const log = await syncReservationToCalendar(reservation.id);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cal.test/v2/bookings',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"eventTypeId":123'),
        headers: expect.objectContaining({ 'cal-api-version': '2024-06-14' }),
      }),
    );
    expect(fetchMock.mock.calls[0][1].body).toContain('"lengthInMinutes":60');
    expect(log).toMatchObject({
      provider: 'cal_com',
      action: 'UPSERT',
      status: 'SYNCED',
      attemptCount: 1,
      externalEventId: 'cal-booking-1',
    });
    expect(log.idempotencyKey).toContain(`reservation:${reservation.id}:v1:calendar:upsert`);
  });

  it('marks sync as skipped with a safe code when Cal.com is not configured', async () => {
    const reservation = await seedConfirmedReservation();
    const { syncReservationToCalendar } = await import('../../src/services/calendar.js');
    const log = await syncReservationToCalendar(reservation.id);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(log).toMatchObject({
      provider: 'cal_com',
      status: 'SKIPPED',
      error: 'CALENDAR_NOT_CONFIGURED',
      attemptCount: 1,
    });
  });

  it('stores only a safe failure code when Cal.com rejects a booking', async () => {
    process.env.CALCOM_API_KEY = 'test-calcom-key';
    process.env.CALCOM_EVENT_TYPE_ID = '123';
    const reservation = await seedConfirmedReservation();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'sensitive provider response' }),
    });

    const { syncReservationToCalendar } = await import('../../src/services/calendar.js');
    const log = await syncReservationToCalendar(reservation.id);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(log).toMatchObject({
      provider: 'cal_com',
      status: 'FAILED',
      error: 'CALCOM_HTTP_401',
      providerStatus: 'failed',
      attemptCount: 1,
    });
    expect(log.error).not.toContain('sensitive');
  });

  it('deduplicates concurrent delivery attempts for one reservation version', async () => {
    const reservation = await seedConfirmedReservation();
    const deliver = vi.fn(async () => ({
      status: 'SYNCED' as const,
      externalEventId: 'cal-concurrent-1',
      providerStatus: 'accepted',
    }));
    const { syncReservationToCalendar } = await import('../../src/services/calendar.js');

    await Promise.all([
      syncReservationToCalendar(reservation.id, { deliver }),
      syncReservationToCalendar(reservation.id, { deliver }),
    ]);

    const { prisma } = await import('../../src/db/prisma.js');
    const logs = await prisma.calendarSyncLog.findMany({ where: { reservationId: reservation.id } });
    expect(deliver).toHaveBeenCalledOnce();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ status: 'SYNCED', attemptCount: 1, externalEventId: 'cal-concurrent-1' });
  });

  it('retries a failed operation in the same ledger row', async () => {
    const reservation = await seedConfirmedReservation();
    const { syncReservationToCalendar } = await import('../../src/services/calendar.js');
    const first = await syncReservationToCalendar(reservation.id, {
      deliver: async () => { throw new Error('raw provider secret'); },
    });
    expect(first).toMatchObject({ status: 'FAILED', error: 'CALENDAR_PROVIDER_FAILED', attemptCount: 1 });

    const retried = await syncReservationToCalendar(reservation.id, {
      deliver: async () => ({ status: 'SYNCED', externalEventId: 'cal-retry-1' }),
    });
    const { prisma } = await import('../../src/db/prisma.js');
    expect(retried).toMatchObject({ status: 'SYNCED', attemptCount: 2, externalEventId: 'cal-retry-1' });
    expect(await prisma.calendarSyncLog.count({ where: { reservationId: reservation.id } })).toBe(1);
  });

  it('reports Cal.com calendar sync health without exposing credentials', async () => {
    process.env.CALCOM_API_KEY = 'test-calcom-key';
    process.env.CALCOM_EVENT_TYPE_ID = '123';
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [{ id: 123, title: 'Calendar Package' }] }),
    });

    const { getCalendarSyncHealth } = await import('../../src/services/calendar.js');
    const health = await getCalendarSyncHealth();

    expect(health).toMatchObject({
      ok: true,
      provider: 'cal_com',
      configured: true,
      apiVersion: '2024-06-14',
      eventTypeId: '123',
      eventTypeFound: true,
      eventTypeCount: 1,
    });
    expect(JSON.stringify(health)).not.toContain('test-calcom-key');
  });
});
