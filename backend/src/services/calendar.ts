import { env } from '../config/env.js';
import { Prisma } from '../generated/prisma/client.js';
import { NotificationStatus, ReservationStatus } from '../generated/prisma/enums.js';
import { prisma } from '../db/prisma.js';

const CALCOM_PROVIDER = 'cal_com';
const CalendarStatus = {
  PENDING: NotificationStatus.PENDING,
  PROCESSING: NotificationStatus.PROCESSING,
  SYNCED: 'SYNCED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED',
  SKIPPED: 'SKIPPED',
  FAILED: NotificationStatus.FAILED,
} as const;

type CalendarAction = 'UPSERT' | 'DELETE';
type CalendarDeliveryResult = {
  status: 'SYNCED' | 'UPDATED' | 'DELETED' | 'SKIPPED';
  externalEventId?: string | null;
  providerStatus?: string | null;
  error?: string | null;
};
type CalendarReservation = NonNullable<Awaited<ReturnType<typeof reservationForCalendar>>>;

export type CalendarDeliveryAdapters = {
  now?: () => Date;
  deliver?: (
    reservation: CalendarReservation,
    action: CalendarAction,
    existingEventId: string | undefined,
  ) => Promise<CalendarDeliveryResult>;
};

type CalComEventType = {
  id: number;
  title?: string;
  lengthInMinutes?: number;
  lengthInMinutesOptions?: number[];
};

const calComConfigured = () => Boolean(env.CALCOM_API_KEY);
const calComApiBaseUrl = () => env.CALCOM_API_BASE_URL.replace(/\/$/, '');
const safeCalendarError = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  if (/^CALENDAR_[A-Z0-9_]+$/.test(message) || /^CALCOM_HTTP_\d{3}$/.test(message)) return message;
  return 'CALENDAR_PROVIDER_FAILED';
};

const calComRequest = async <T>(path: string, init: RequestInit = {}) => {
  const response = await fetch(`${calComApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.CALCOM_API_KEY}`,
      'Content-Type': 'application/json',
      'cal-api-version': env.CALCOM_API_VERSION,
      ...init.headers,
    },
  });
  const responseText = await response.text();
  const data = responseText ? JSON.parse(responseText) : null;
  if (!response.ok) throw new Error(`CALCOM_HTTP_${response.status}`);
  return data as T;
};

const calComEventTypeSupportsDuration = (eventType: CalComEventType, durationMin: number) =>
  eventType.lengthInMinutes === durationMin || eventType.lengthInMinutesOptions?.includes(durationMin);

const resolveCalComEventTypeId = async (durationMin: number) => {
  if (env.CALCOM_EVENT_TYPE_ID) {
    const configured = Number(env.CALCOM_EVENT_TYPE_ID);
    if (!Number.isInteger(configured) || configured < 1) throw new Error('CALENDAR_EVENT_TYPE_INVALID');
    return configured;
  }
  const response = await calComRequest<{ data?: CalComEventType[] }>('/event-types');
  const eventTypes = response.data ?? [];
  const matching = eventTypes.find((eventType) => calComEventTypeSupportsDuration(eventType, durationMin));
  if (matching) return matching.id;
  if (eventTypes.length === 1) return eventTypes[0].id;
  throw new Error(eventTypes.length === 0 ? 'CALENDAR_EVENT_TYPE_MISSING' : 'CALENDAR_DURATION_UNSUPPORTED');
};

const calComBookingId = (data: unknown) => {
  if (!data || typeof data !== 'object') return undefined;
  const booking = 'data' in data ? (data as { data?: unknown }).data : data;
  if (!booking || typeof booking !== 'object') return undefined;
  const record = booking as { uid?: unknown; id?: unknown };
  const value = record.uid ?? record.id;
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
};

const reservationForCalendar = (reservationId: string) =>
  prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { customer: true, package: true, packageVersion: true },
  });

const latestCalendarEventId = async (reservationId: string) => {
  const latest = await prisma.calendarSyncLog.findFirst({
    where: { reservationId, provider: CALCOM_PROVIDER, externalEventId: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
  return !latest || latest.status === CalendarStatus.DELETED ? undefined : latest.externalEventId ?? undefined;
};

const deliverToCalCom = async (
  reservation: CalendarReservation,
  action: CalendarAction,
  existingEventId: string | undefined,
): Promise<CalendarDeliveryResult> => {
  if (!calComConfigured()) return { status: CalendarStatus.SKIPPED, error: 'CALENDAR_NOT_CONFIGURED' };

  if (action === 'DELETE') {
    if (!existingEventId) return { status: CalendarStatus.SKIPPED, error: 'CALENDAR_EXTERNAL_EVENT_NOT_FOUND' };
    await calComRequest(`/bookings/${encodeURIComponent(existingEventId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancellationReason: `Reservation ${reservation.reference} cancelled` }),
    });
    return { status: CalendarStatus.DELETED, externalEventId: existingEventId, providerStatus: 'accepted' };
  }

  if (existingEventId) {
    const response = await calComRequest(`/bookings/${encodeURIComponent(existingEventId)}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({
        start: reservation.startAt.toISOString(),
        reschedulingReason: `Reservation ${reservation.reference} rescheduled`,
      }),
    });
    return {
      status: CalendarStatus.UPDATED,
      externalEventId: calComBookingId(response) ?? existingEventId,
      providerStatus: 'accepted',
    };
  }

  const eventTypeId = await resolveCalComEventTypeId(reservation.packageVersion.durationMin);
  const response = await calComRequest('/bookings', {
    method: 'POST',
    body: JSON.stringify({
      start: reservation.startAt.toISOString(),
      eventTypeId,
      lengthInMinutes: reservation.packageVersion.durationMin,
      attendee: {
        name: `${reservation.customer.firstName} ${reservation.customer.lastName}`,
        email: reservation.customer.email ?? env.ADMIN_NOTIFICATION_EMAIL,
        timeZone: env.CALCOM_TIME_ZONE,
        phoneNumber: reservation.customer.phone,
        language: 'fr',
      },
      metadata: { reservationId: reservation.id, reference: reservation.reference },
    }),
  });
  const externalEventId = calComBookingId(response);
  if (!externalEventId) throw new Error('CALENDAR_PROVIDER_ID_MISSING');
  return { status: CalendarStatus.SYNCED, externalEventId, providerStatus: 'accepted' };
};

const calendarAction = (status: ReservationStatus): CalendarAction | null => {
  if (status === ReservationStatus.CONFIRMED) return 'UPSERT';
  if (status === ReservationStatus.CANCELLED) return 'DELETE';
  return null;
};

const queueCalendarOperation = async (reservation: CalendarReservation, action: CalendarAction) => {
  const idempotencyKey = `reservation:${reservation.id}:v${reservation.version}:calendar:${action.toLowerCase()}`;
  try {
    return await prisma.calendarSyncLog.create({
      data: {
        reservationId: reservation.id,
        provider: CALCOM_PROVIDER,
        action,
        idempotencyKey,
        status: CalendarStatus.PENDING,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.calendarSyncLog.findUniqueOrThrow({ where: { idempotencyKey } });
    }
    throw error;
  }
};

export const processCalendarSyncLog = async (id: string, adapters: CalendarDeliveryAdapters = {}) => {
  const now = adapters.now?.() ?? new Date();
  const staleBefore = new Date(now.getTime() - env.CALENDAR_LOCK_TIMEOUT_SECONDS * 1000);
  const claim = await prisma.calendarSyncLog.updateMany({
    where: {
      id,
      OR: [
        { status: { in: [CalendarStatus.PENDING, CalendarStatus.FAILED, CalendarStatus.SKIPPED] } },
        { status: CalendarStatus.PROCESSING, lockedAt: { lte: staleBefore } },
      ],
    },
    data: {
      status: CalendarStatus.PROCESSING,
      attemptCount: { increment: 1 },
      lastAttemptAt: now,
      lockedAt: now,
      error: null,
    },
  });
  if (claim.count === 0) return prisma.calendarSyncLog.findUnique({ where: { id } });

  const log = await prisma.calendarSyncLog.findUnique({ where: { id } });
  if (!log?.reservationId) return null;
  const reservation = await reservationForCalendar(log.reservationId);
  if (!reservation) {
    return prisma.calendarSyncLog.update({
      where: { id },
      data: { status: CalendarStatus.FAILED, error: 'CALENDAR_RESERVATION_NOT_FOUND', lockedAt: null },
    });
  }

  const expectedAction = calendarAction(reservation.status);
  if (expectedAction !== log.action) {
    return prisma.calendarSyncLog.update({
      where: { id },
      data: { status: CalendarStatus.SKIPPED, error: 'CALENDAR_OPERATION_SUPERSEDED', lockedAt: null },
    });
  }

  try {
    const existingEventId = await latestCalendarEventId(reservation.id);
    const result = await (adapters.deliver ?? deliverToCalCom)(
      reservation,
      log.action as CalendarAction,
      existingEventId,
    );
    return prisma.calendarSyncLog.update({
      where: { id },
      data: {
        status: result.status,
        externalEventId: result.externalEventId,
        providerStatus: result.providerStatus,
        error: result.error,
        lockedAt: null,
      },
    });
  } catch (error) {
    return prisma.calendarSyncLog.update({
      where: { id },
      data: { status: CalendarStatus.FAILED, error: safeCalendarError(error), providerStatus: 'failed', lockedAt: null },
    });
  }
};

export const syncReservationToCalendar = async (
  reservationId: string,
  adapters: CalendarDeliveryAdapters = {},
) => {
  const reservation = await reservationForCalendar(reservationId);
  if (!reservation) {
    throw new Error('CALENDAR_RESERVATION_NOT_FOUND');
  }
  const action = calendarAction(reservation.status);
  if (!action) {
    return prisma.calendarSyncLog.create({
      data: {
        reservationId,
        provider: CALCOM_PROVIDER,
        action: 'UPSERT',
        status: CalendarStatus.SKIPPED,
        error: 'CALENDAR_STATUS_NOT_SYNCABLE',
      },
    });
  }
  const operation = await queueCalendarOperation(reservation, action);
  const processed = await processCalendarSyncLog(operation.id, adapters);
  if (!processed) throw new Error('CALENDAR_SYNC_LOG_NOT_FOUND');
  return processed;
};

export const getCalendarSyncHealth = async () => {
  if (!calComConfigured()) {
    return { ok: false, provider: CALCOM_PROVIDER, configured: false, error: 'CALENDAR_NOT_CONFIGURED' };
  }
  try {
    const response = await calComRequest<{ data?: CalComEventType[] }>('/event-types');
    const eventTypes = response.data ?? [];
    const configuredEventType = env.CALCOM_EVENT_TYPE_ID
      ? eventTypes.find((eventType) => String(eventType.id) === String(env.CALCOM_EVENT_TYPE_ID))
      : null;
    return {
      ok: env.CALCOM_EVENT_TYPE_ID ? Boolean(configuredEventType) : eventTypes.length > 0,
      provider: CALCOM_PROVIDER,
      configured: true,
      apiVersion: env.CALCOM_API_VERSION,
      eventTypeId: env.CALCOM_EVENT_TYPE_ID ?? null,
      eventTypeFound: env.CALCOM_EVENT_TYPE_ID ? Boolean(configuredEventType) : undefined,
      eventTypeCount: eventTypes.length,
      checkedAt: new Date().toISOString(),
      error: env.CALCOM_EVENT_TYPE_ID && !configuredEventType ? 'CALENDAR_EVENT_TYPE_NOT_FOUND' : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      provider: CALCOM_PROVIDER,
      configured: true,
      apiVersion: env.CALCOM_API_VERSION,
      eventTypeId: env.CALCOM_EVENT_TYPE_ID ?? null,
      checkedAt: new Date().toISOString(),
      error: safeCalendarError(error),
    };
  }
};
