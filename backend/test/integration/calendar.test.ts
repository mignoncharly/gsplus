import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

const resetDatabase = async () => {
  const { prisma } = await import('../../src/db/prisma.js');
  await prisma.dataIntegrityIncident.deleteMany();
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
          packageVersion: packageVersion.version,
          packageName: packageVersion.name,
          startAt: new Date('2030-01-15T10:00:00.000Z'),
          endAt: new Date('2030-01-15T11:00:00.000Z'),
          durationMin: packageVersion.durationMin,
          amount: packageVersion.price,
          currency: packageVersion.currency,
          termsAccepted: true,
          termsVersion: 'TEST',
          termsAcceptedAt: new Date(),
          privacyAccepted: true,
          privacyVersion: 'TEST',
          privacyAcceptedAt: new Date(),
          whatsappConsent: false,
          imageConsent: false,
          imageAuthorizationVersion: 'TEST',
          source: 'TEST',
        },
      },
    },
  });
};

beforeEach(async () => {
  vi.resetModules();
  process.env.CALCOM_API_BASE_URL = 'https://api.cal.test/v2';
  process.env.CALCOM_API_VERSION = '2026-02-25';
  process.env.CALCOM_EVENT_TYPES_API_VERSION = '2024-06-14';
  process.env.CALCOM_BOOKINGS_LIST_API_VERSION = '2026-05-01';
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
  it('creates exactly one UTC booking and records the complete versioned ledger result', async () => {
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

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cal.test/v2/bookings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'cal-api-version': '2026-02-25' }),
      }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toMatchObject({
      start: '2030-01-15T10:00:00.000Z',
      eventTypeId: 123,
      lengthInMinutes: 60,
      attendee: { timeZone: 'Africa/Douala' },
      metadata: {
        reservationId: reservation.id,
        gspCalendarKey: `reservation:${reservation.id}:v1:calendar:create`,
      },
    });
    expect(log).toMatchObject({
      provider: 'cal_com',
      action: 'CREATE',
      status: 'SYNCED',
      attemptCount: 1,
      maxAttempts: 3,
      reservationVersion: 1,
      externalEventId: 'cal-booking-1',
      providerStatus: 'accepted',
    });
    expect(log.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(log.syncedAt).toBeInstanceOf(Date);
  });

  it('uses the current booking API contract and excludes unsupported reschedule metadata', async () => {
    process.env.CALCOM_API_KEY = 'test-calcom-key';
    process.env.CALCOM_EVENT_TYPE_ID = '123';
    const reservation = await seedConfirmedReservation();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ data: { uid: 'cal-contract-create-1' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ data: { uid: 'cal-contract-update-1' } }),
      });

    const { prisma } = await import('../../src/db/prisma.js');
    const { syncReservationToCalendar } = await import('../../src/services/calendar.js');
    await syncReservationToCalendar(reservation.id);
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        startAt: new Date('2030-01-16T12:00:00.000Z'),
        endAt: new Date('2030-01-16T13:00:00.000Z'),
        version: { increment: 1 },
      },
    });
    const updated = await syncReservationToCalendar(reservation.id);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.cal.test/v2/bookings/cal-contract-create-1/reschedule',
    );
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({
      'cal-api-version': '2026-02-25',
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({
      start: '2030-01-16T12:00:00.000Z',
      reschedulingReason: expect.stringContaining('rescheduled'),
    });
    expect(updated).toMatchObject({
      action: 'UPDATE',
      status: 'SYNCED',
      externalEventId: 'cal-contract-update-1',
    });
  });

  it('records NOT_REQUIRED and never claims provider success when Cal.com is not configured', async () => {
    const reservation = await seedConfirmedReservation();
    const { syncReservationToCalendar } = await import('../../src/services/calendar.js');
    const log = await syncReservationToCalendar(reservation.id);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(log).toMatchObject({
      provider: 'cal_com',
      status: 'NOT_REQUIRED',
      error: 'CALENDAR_NOT_CONFIGURED',
      attemptCount: 1,
    });
    expect(log.syncedAt).toBeNull();
  });

  it('never reports success after a provider HTTP 400 and schedules the two-minute retry', async () => {
    process.env.CALCOM_API_KEY = 'test-calcom-key';
    process.env.CALCOM_EVENT_TYPE_ID = '123';
    const reservation = await seedConfirmedReservation();
    const now = new Date('2026-08-01T14:00:00.000Z');
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: 'sensitive provider response' }),
    });

    const { syncReservationToCalendar } = await import('../../src/services/calendar.js');
    const log = await syncReservationToCalendar(reservation.id, { now: () => now });

    expect(log).toMatchObject({
      status: 'RETRYING',
      error: 'CALCOM_HTTP_400',
      providerStatus: 'retry_scheduled',
      attemptCount: 1,
    });
    expect(log.nextAttemptAt?.toISOString()).toBe('2026-08-01T14:02:00.000Z');
    expect(log.syncedAt).toBeNull();
    expect(JSON.stringify(log)).not.toContain('sensitive provider response');
  });

  it('schedules retry after HTTP 500 and sanitizes timeouts', async () => {
    process.env.CALCOM_API_KEY = 'test-calcom-key';
    process.env.CALCOM_EVENT_TYPE_ID = '123';
    const reservation = await seedConfirmedReservation();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ secret: 'provider-secret' }),
    });
    const { syncReservationToCalendar } = await import('../../src/services/calendar.js');
    const failed = await syncReservationToCalendar(reservation.id);
    expect(failed).toMatchObject({ status: 'RETRYING', error: 'CALCOM_HTTP_500', attemptCount: 1 });

    const { prisma } = await import('../../src/db/prisma.js');
    await prisma.calendarSyncLog.deleteMany();
    const timeout = await syncReservationToCalendar(reservation.id, {
      deliver: async () => { throw new DOMException('provider token leaked', 'TimeoutError'); },
    });
    expect(timeout).toMatchObject({
      status: 'RETRYING',
      error: 'CALENDAR_PROVIDER_FAILED',
      attemptCount: 1,
    });
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

  it('runs attempts at 0/2/10 minutes and raises one I-07 only after the third failure', async () => {
    const reservation = await seedConfirmedReservation();
    const firstAt = new Date('2026-08-01T14:00:00.000Z');
    const deliver = vi.fn(async () => { throw new Error('raw provider secret'); });
    const { processCalendarOutbox, syncReservationToCalendar } =
      await import('../../src/services/calendar.js');

    const first = await syncReservationToCalendar(reservation.id, { now: () => firstAt, deliver });
    expect(first).toMatchObject({ status: 'RETRYING', attemptCount: 1 });
    expect(first.nextAttemptAt?.toISOString()).toBe('2026-08-01T14:02:00.000Z');

    const early = await processCalendarOutbox({
      now: () => new Date('2026-08-01T14:01:59.999Z'),
      deliver,
    });
    expect(early).toEqual([]);
    expect(deliver).toHaveBeenCalledTimes(1);

    const secondResults = await processCalendarOutbox({
      now: () => new Date('2026-08-01T14:02:00.000Z'),
      deliver,
    });
    expect(secondResults[0]).toMatchObject({ status: 'RETRYING', attemptCount: 2 });
    expect(secondResults[0]?.nextAttemptAt?.toISOString()).toBe('2026-08-01T14:12:00.000Z');

    const thirdResults = await processCalendarOutbox({
      now: () => new Date('2026-08-01T14:12:00.000Z'),
      deliver,
    });
    expect(thirdResults[0]).toMatchObject({
      status: 'FAILED',
      attemptCount: 3,
      error: 'CALENDAR_PROVIDER_FAILED',
    });

    const { prisma } = await import('../../src/db/prisma.js');
    const alerts = await prisma.notificationEvent.findMany({
      where: { type: 'calendar_sync_failed_admin', reservationId: reservation.id },
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      channel: 'email',
      recipient: 'info@gsplus.vip',
      status: 'PENDING',
    });
    expect(alerts[0].metadata).toMatchObject({
      templateCode: 'I-07',
      error: 'CALENDAR_PROVIDER_FAILED',
    });

    await processCalendarOutbox({
      now: () => new Date('2026-08-01T15:00:00.000Z'),
      deliver,
    });
    expect(await prisma.notificationEvent.count({
      where: { type: 'calendar_sync_failed_admin', reservationId: reservation.id },
    })).toBe(1);
  });

  it('reconciles an interrupted provider success before retry and never creates a duplicate', async () => {
    const reservation = await seedConfirmedReservation();
    const createdRemoteIds: string[] = [];
    const deliver = vi.fn(async () => {
      createdRemoteIds.push('cal-response-lost-1');
      throw new Error('connection closed after remote success');
    });
    const reconcile = vi.fn(async () => ({
      status: 'SYNCED' as const,
      externalEventId: createdRemoteIds[0],
      providerStatus: 'reconciled',
    }));
    const { processCalendarOutbox, syncReservationToCalendar } =
      await import('../../src/services/calendar.js');

    const first = await syncReservationToCalendar(reservation.id, {
      now: () => new Date('2026-08-01T14:00:00.000Z'),
      deliver,
    });
    expect(first).toMatchObject({ status: 'RETRYING', attemptCount: 1 });

    const results = await processCalendarOutbox({
      now: () => new Date('2026-08-01T14:02:00.000Z'),
      deliver,
      reconcile,
    });
    expect(results[0]).toMatchObject({
      status: 'SYNCED',
      attemptCount: 2,
      externalEventId: 'cal-response-lost-1',
      providerStatus: 'reconciled',
    });
    expect(createdRemoteIds).toEqual(['cal-response-lost-1']);
    expect(deliver).toHaveBeenCalledOnce();
    expect(reconcile).toHaveBeenCalledOnce();
  });

  it('uses Cal.com metadata reconciliation after an ambiguous create response', async () => {
    process.env.CALCOM_API_KEY = 'test-calcom-key';
    process.env.CALCOM_EVENT_TYPE_ID = '123';
    const reservation = await seedConfirmedReservation();
    const key = `reservation:${reservation.id}:v1:calendar:create`;
    fetchMock
      .mockRejectedValueOnce(new TypeError('response stream interrupted'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          data: [{
            uid: 'cal-reconciled-real-1',
            start: '2030-01-15T10:00:00.000Z',
            metadata: { gspCalendarKey: key },
          }],
        }),
      });

    const { processCalendarOutbox, syncReservationToCalendar } =
      await import('../../src/services/calendar.js');
    const first = await syncReservationToCalendar(reservation.id, {
      now: () => new Date('2026-08-01T14:00:00.000Z'),
    });
    const results = await processCalendarOutbox({
      now: () => new Date('2026-08-01T14:02:00.000Z'),
    });

    expect(first).toMatchObject({ status: 'RETRYING', attemptCount: 1 });
    expect(results[0]).toMatchObject({
      status: 'SYNCED',
      attemptCount: 2,
      externalEventId: 'cal-reconciled-real-1',
      providerStatus: 'reconciled',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.cal.test/v2/bookings');
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.cal.test/v2/bookings?status=upcoming&take=100&skip=0',
    );
  });

  it('manually retries the same failed ledger row and repeated manual calls are idempotent', async () => {
    const reservation = await seedConfirmedReservation();
    const { prisma } = await import('../../src/db/prisma.js');
    const { retryCalendarSync, syncReservationToCalendar } =
      await import('../../src/services/calendar.js');

    const failedAttempt = await syncReservationToCalendar(reservation.id, {
      deliver: async () => { throw new Error('provider down'); },
    });
    await prisma.calendarSyncLog.update({
      where: { id: failedAttempt.id },
      data: { status: 'FAILED', attemptCount: 3, nextAttemptAt: null },
    });

    const deliver = vi.fn(async () => ({
      status: 'SYNCED' as const,
      externalEventId: 'cal-manual-1',
      providerStatus: 'accepted',
    }));
    const retried = await retryCalendarSync(reservation.id, { deliver });
    const replayed = await retryCalendarSync(reservation.id, { deliver });

    expect(retried).toMatchObject({
      id: failedAttempt.id,
      status: 'SYNCED',
      attemptCount: 1,
      externalEventId: 'cal-manual-1',
    });
    expect(replayed.id).toBe(retried.id);
    expect(deliver).toHaveBeenCalledOnce();
    expect(await prisma.calendarSyncLog.count({ where: { reservationId: reservation.id } })).toBe(1);
  });

  it('updates the existing event on reschedule and cancels that event without duplication', async () => {
    const reservation = await seedConfirmedReservation();
    const { prisma } = await import('../../src/db/prisma.js');
    const { ReservationStatus } = await import('../../src/generated/prisma/client.js');
    const calls: Array<{ action: string; existingEventId?: string }> = [];
    const deliver = vi.fn(async (
      _reservation: unknown,
      action: string,
      existingEventId: string | undefined,
    ) => {
      calls.push({ action, existingEventId });
      return {
        status: 'SYNCED' as const,
        externalEventId: action === 'CREATE'
          ? 'cal-original-1'
          : action === 'UPDATE'
            ? 'cal-rescheduled-1'
            : existingEventId,
        providerStatus: 'accepted',
      };
    });
    const { syncReservationToCalendar } = await import('../../src/services/calendar.js');

    await syncReservationToCalendar(reservation.id, { deliver });
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        startAt: new Date('2030-01-16T12:00:00.000Z'),
        endAt: new Date('2030-01-16T13:00:00.000Z'),
        version: { increment: 1 },
      },
    });
    const updated = await syncReservationToCalendar(reservation.id, { deliver });

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.CANCELLED, version: { increment: 1 } },
    });
    const cancelled = await syncReservationToCalendar(reservation.id, { deliver });

    expect(calls).toEqual([
      { action: 'CREATE', existingEventId: undefined },
      { action: 'UPDATE', existingEventId: 'cal-original-1' },
      { action: 'CANCEL', existingEventId: 'cal-rescheduled-1' },
    ]);
    expect(updated).toMatchObject({
      action: 'UPDATE',
      status: 'SYNCED',
      externalEventId: 'cal-rescheduled-1',
      reservationVersion: 2,
    });
    expect(cancelled).toMatchObject({
      action: 'CANCEL',
      status: 'SYNCED',
      externalEventId: 'cal-rescheduled-1',
      reservationVersion: 3,
    });
    expect(await prisma.calendarSyncLog.count({ where: { reservationId: reservation.id } })).toBe(3);
  });

  it('blocks snapshot-less delivery and deduplicates the I-10 integrity incident', async () => {
    const seeded = await seedConfirmedReservation();
    const { prisma } = await import('../../src/db/prisma.js');
    const anomalous = await prisma.reservation.create({
      data: {
        reference: `GSP-NO-SNAPSHOT-${Date.now()}`,
        customerId: seeded.customerId,
        packageId: seeded.packageId,
        packageVersionId: seeded.packageVersionId,
        startAt: new Date('2030-01-16T10:00:00.000Z'),
        endAt: new Date('2030-01-16T11:00:00.000Z'),
        status: seeded.status,
        acceptedTermsAt: new Date(),
      },
    });
    const deliver = vi.fn(async () => ({
      status: 'SYNCED' as const,
      externalEventId: 'must-not-send',
    }));
    const { syncReservationToCalendar } = await import('../../src/services/calendar.js');

    const first = await syncReservationToCalendar(anomalous.id, { deliver });
    const replayed = await syncReservationToCalendar(anomalous.id, { deliver });

    expect(first).toMatchObject({ status: 'FAILED', error: 'CALENDAR_RESERVATION_SNAPSHOT_MISSING' });
    expect(replayed.id).toBe(first.id);
    expect(deliver).not.toHaveBeenCalled();
    const incidents = await prisma.dataIntegrityIncident.findMany({ where: { reservationId: anomalous.id } });
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      code: 'I-10_RESERVATION_SNAPSHOT_MISSING',
      status: 'OPEN',
      occurrenceCount: 1,
    });
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
      bookingApiVersion: '2026-02-25',
      bookingsListApiVersion: '2026-05-01',
      eventTypeId: '123',
      eventTypeFound: true,
      eventTypeCount: 1,
    });
    expect(JSON.stringify(health)).not.toContain('test-calcom-key');
  });
});
