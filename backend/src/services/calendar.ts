import { createHash } from 'node:crypto';

import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { ReservationStatus } from '../generated/prisma/enums.js';
import { enqueueCalendarSyncFailureAlert } from '../emails/notifications.js';
import { adminReservationUrl } from '../utils/admin-links.js';
import { paymentMethodLabel, type DisplayLocale } from '../utils/business-display.js';
import { formatBusinessDateTime } from '../utils/business-time.js';
import { recordMissingReservationSnapshot } from './integrity-incidents.js';

const CALCOM_PROVIDER = 'cal_com';
const MAX_ATTEMPTS = 3;
const CalendarStatus = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  SYNCING: 'SYNCING',
  SYNCED: 'SYNCED',
  RETRYING: 'RETRYING',
  FAILED: 'FAILED',
} as const;

export type CalendarAction = 'CREATE' | 'UPDATE' | 'CANCEL';
type CalendarDeliveryResult = {
  status: 'SYNCED' | 'UPDATED' | 'DELETED' | 'NOT_REQUIRED' | 'SKIPPED';
  externalEventId?: string | null;
  providerStatus?: string | null;
  error?: string | null;
};
type CalendarOperationContext = {
  idempotencyKey: string;
  payloadHash: string;
};
type CalendarReservation = NonNullable<Awaited<ReturnType<typeof reservationForCalendar>>>;

export type CalendarDeliveryAdapters = {
  now?: () => Date;
  deliver?: (
    reservation: CalendarReservation,
    action: CalendarAction,
    existingEventId: string | undefined,
    context: CalendarOperationContext,
  ) => Promise<CalendarDeliveryResult>;
  reconcile?: (
    reservation: CalendarReservation,
    action: CalendarAction,
    existingEventId: string | undefined,
    context: CalendarOperationContext,
  ) => Promise<CalendarDeliveryResult | null>;
};

type CalComEventType = {
  id: number;
  title?: string;
  lengthInMinutes?: number;
  lengthInMinutesOptions?: number[];
};
type CalComBooking = {
  uid?: unknown;
  id?: unknown;
  status?: unknown;
  start?: unknown;
  startTime?: unknown;
  rescheduledToUid?: unknown;
  metadata?: unknown;
};

const calComConfigured = () => Boolean(env.CALCOM_API_KEY);
const calComApiBaseUrl = () => env.CALCOM_API_BASE_URL.replace(/\/$/, '');
const safeCalendarError = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  if (/^CALENDAR_[A-Z0-9_]+$/.test(message) || /^CALCOM_HTTP_\d{3}$/.test(message)) return message;
  return 'CALENDAR_PROVIDER_FAILED';
};
const calendarPayloadHash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const calComRequest = async <T>(
  path: string,
  init: RequestInit = {},
  apiVersion = env.CALCOM_API_VERSION,
) => {
  const response = await fetch(`${calComApiBaseUrl()}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(env.CALCOM_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${env.CALCOM_API_KEY}`,
      'Content-Type': 'application/json',
      'cal-api-version': apiVersion,
      ...init.headers,
    },
  });
  const responseText = await response.text();
  let data: unknown = null;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = null;
  }
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
  const response = await calComRequest<{ data?: CalComEventType[] }>(
    '/event-types',
    {},
    env.CALCOM_EVENT_TYPES_API_VERSION,
  );
  const eventTypes = response.data ?? [];
  const matching = eventTypes.find((eventType) => calComEventTypeSupportsDuration(eventType, durationMin));
  if (matching) return matching.id;
  if (eventTypes.length === 1) return eventTypes[0].id;
  throw new Error(eventTypes.length === 0 ? 'CALENDAR_EVENT_TYPE_MISSING' : 'CALENDAR_DURATION_UNSUPPORTED');
};

const unwrapCalComBooking = (data: unknown): CalComBooking | undefined => {
  if (!data || typeof data !== 'object') return undefined;
  const booking = 'data' in data ? (data as { data?: unknown }).data : data;
  if (!booking || typeof booking !== 'object' || Array.isArray(booking)) return undefined;
  return booking as CalComBooking;
};

const calComBookingId = (data: unknown) => {
  const booking = unwrapCalComBooking(data);
  const value = booking?.uid ?? booking?.id;
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
};

const reservationForCalendar = (reservationId: string) =>
  prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      customer: true,
      package: true,
      packageVersion: true,
      snapshot: true,
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

const calendarLocale = (locale: string): DisplayLocale => locale === 'en' ? 'en' : 'fr';
const compactCalendarText = (value: string, maxLength: number) =>
  value.replace(/\s+/g, ' ').trim().slice(0, maxLength);

const calendarPresentation = (reservation: CalendarReservation) => {
  if (!reservation.snapshot) throw new Error('CALENDAR_RESERVATION_SNAPSHOT_MISSING');
  const snapshot = reservation.snapshot;
  const locale = calendarLocale(snapshot.locale);
  const clientName = compactCalendarText(`${snapshot.firstName} ${snapshot.lastName}`, 80);
  const packageName = compactCalendarText(snapshot.packageName, 100);
  const payment = reservation.payments[0];

  const attendeeName = compactCalendarText(
    `${reservation.reference} — ${packageName} — ${clientName}`,
    200,
  );
  const startDouala = formatBusinessDateTime(reservation.startAt, locale);
  const endDouala = formatBusinessDateTime(reservation.endAt, locale);
  const paymentLabel = paymentMethodLabel(payment?.method, locale);
  const adminUrl = adminReservationUrl(reservation.reference);
  const operationalNotes = locale === 'en'
    ? 'Open the protected admin record for payment status and approved operational details.'
    : 'Ouvrir la fiche admin protégée pour le statut du paiement et les détails opérationnels approuvés.';
  const bookingNotes = locale === 'en'
    ? `Reference: ${reservation.reference}\nStart (Douala): ${startDouala}\nEnd (Douala): ${endDouala}\nPhone: ${snapshot.notificationPhoneE164}\nPayment: ${paymentLabel}\nAdmin: ${adminUrl}\n${operationalNotes}`
    : `Référence : ${reservation.reference}\nDébut (Douala) : ${startDouala}\nFin (Douala) : ${endDouala}\nTéléphone : ${snapshot.notificationPhoneE164}\nPaiement : ${paymentLabel}\nAdmin : ${adminUrl}\n${operationalNotes}`;

  return {
    locale,
    attendeeName,
    bookingNotes,
    metadata: {
      gspReference: reservation.reference,
      gspPackage: packageName,
      gspStartDouala: startDouala,
      gspEndDouala: endDouala,
      gspPhone: snapshot.notificationPhoneE164,
      gspPaymentLabel: paymentLabel,
      gspAdminUrl: adminUrl,
      gspOperationalNotes: operationalNotes,
    },
  };
};

const latestActiveCalendarEvent = async (reservationId: string) => {
  const latest = await prisma.calendarSyncLog.findFirst({
    where: {
      reservationId,
      provider: CALCOM_PROVIDER,
      status: CalendarStatus.SYNCED,
      externalEventId: { not: null },
    },
    orderBy: [{ syncedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
  });
  if (!latest || ['CANCEL', 'DELETE'].includes(latest.action)) return undefined;
  return latest.externalEventId ?? undefined;
};

const bookingMetadataKey = (booking: CalComBooking) => {
  if (!booking.metadata || typeof booking.metadata !== 'object' || Array.isArray(booking.metadata)) return undefined;
  const value = (booking.metadata as Record<string, unknown>).gspCalendarKey;
  return typeof value === 'string' ? value : undefined;
};

const bookingStartsAt = (booking: CalComBooking) => {
  const value = booking.start ?? booking.startTime;
  if (typeof value !== 'string') return undefined;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
};

const getCalComBooking = async (uid: string) => {
  try {
    return unwrapCalComBooking(await calComRequest(`/bookings/${encodeURIComponent(uid)}`));
  } catch (error) {
    if (error instanceof Error && error.message === 'CALCOM_HTTP_404') return undefined;
    throw error;
  }
};

const reconcileCalCom = async (
  reservation: CalendarReservation,
  action: CalendarAction,
  existingEventId: string | undefined,
  context: CalendarOperationContext,
): Promise<CalendarDeliveryResult | null> => {
  if (!calComConfigured()) return null;

  if (action === 'CREATE') {
    const pageSize = 100;
    for (let skip = 0; skip < 10_000; skip += pageSize) {
      const response = await calComRequest<{ data?: unknown[] }>(
        `/bookings?status=upcoming&take=${pageSize}&skip=${skip}`,
        {},
        env.CALCOM_BOOKINGS_LIST_API_VERSION,
      );
      const bookings = Array.isArray(response.data) ? response.data : [];
      const booking = bookings
        .map((item) => (item && typeof item === 'object' ? item as CalComBooking : undefined))
        .find((item) => item && bookingMetadataKey(item) === context.idempotencyKey);
      if (booking) {
        const externalEventId = calComBookingId(booking);
        return externalEventId
          ? { status: 'SYNCED', externalEventId, providerStatus: 'reconciled' }
          : null;
      }
      if (bookings.length < pageSize) return null;
    }
    throw new Error('CALENDAR_RECONCILIATION_LIMIT');
  }

  if (!existingEventId) return null;
  let booking = await getCalComBooking(existingEventId);
  if (!booking) return null;
  let externalEventId = existingEventId;

  if (action === 'UPDATE') {
    if (typeof booking.rescheduledToUid === 'string' && booking.rescheduledToUid) {
      externalEventId = booking.rescheduledToUid;
      booking = await getCalComBooking(externalEventId) ?? booking;
    }
    if (bookingStartsAt(booking) !== reservation.startAt.getTime()) return null;
    return { status: 'SYNCED', externalEventId, providerStatus: 'reconciled' };
  }

  const status = typeof booking.status === 'string' ? booking.status.toLowerCase() : '';
  if (!status.includes('cancel')) return null;
  return { status: 'SYNCED', externalEventId, providerStatus: 'reconciled' };
};

const deliverToCalCom = async (
  reservation: CalendarReservation,
  action: CalendarAction,
  existingEventId: string | undefined,
  context: CalendarOperationContext,
): Promise<CalendarDeliveryResult> => {
  if (!calComConfigured()) {
    return { status: CalendarStatus.NOT_REQUIRED, error: 'CALENDAR_NOT_CONFIGURED' };
  }
  if (!reservation.snapshot) throw new Error('CALENDAR_RESERVATION_SNAPSHOT_MISSING');
  const snapshot = reservation.snapshot;

  if (action === 'CANCEL') {
    if (!existingEventId) {
      return { status: CalendarStatus.NOT_REQUIRED, error: 'CALENDAR_EXTERNAL_EVENT_NOT_FOUND' };
    }
    await calComRequest(`/bookings/${encodeURIComponent(existingEventId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancellationReason: `Reservation ${reservation.reference} cancelled` }),
    });
    return { status: 'SYNCED', externalEventId: existingEventId, providerStatus: 'accepted' };
  }

  if (action === 'UPDATE') {
    if (!existingEventId) throw new Error('CALENDAR_EXTERNAL_EVENT_NOT_FOUND');
    const response = await calComRequest(`/bookings/${encodeURIComponent(existingEventId)}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({
        start: reservation.startAt.toISOString(),
        reschedulingReason: `Reservation ${reservation.reference} rescheduled`,
      }),
    });
    return {
      status: 'SYNCED',
      externalEventId: calComBookingId(response) ?? existingEventId,
      providerStatus: 'accepted',
    };
  }

  const eventTypeId = await resolveCalComEventTypeId(snapshot.durationMin);
  const presentation = calendarPresentation(reservation);
  const response = await calComRequest('/bookings', {
    method: 'POST',
    body: JSON.stringify({
      start: reservation.startAt.toISOString(),
      eventTypeId,
      lengthInMinutes: snapshot.durationMin,
      attendee: {
        name: presentation.attendeeName,
        email: snapshot.notificationEmail ?? snapshot.email ?? env.ADMIN_NOTIFICATION_EMAIL,
        timeZone: env.CALCOM_TIME_ZONE,
        phoneNumber: snapshot.notificationPhoneE164,
        language: presentation.locale,
      },
      bookingFieldsResponses: {
        title: presentation.attendeeName,
        notes: presentation.bookingNotes,
      },
      metadata: {
        reservationId: reservation.id,
        reference: reservation.reference,
        gspCalendarKey: context.idempotencyKey,
        gspPayloadHash: context.payloadHash,
        ...presentation.metadata,
      },
    }),
  });
  const externalEventId = calComBookingId(response);
  if (!externalEventId) throw new Error('CALENDAR_PROVIDER_ID_MISSING');
  return { status: 'SYNCED', externalEventId, providerStatus: 'accepted' };
};

const desiredCalendarAction = (
  status: ReservationStatus,
  existingEventId: string | undefined,
): CalendarAction | null => {
  if (status === ReservationStatus.CONFIRMED) return existingEventId ? 'UPDATE' : 'CREATE';
  if (status === ReservationStatus.CANCELLED) return 'CANCEL';
  return null;
};

const operationPayload = (
  reservation: CalendarReservation,
  action: CalendarAction,
  existingEventId: string | undefined,
) => ({
  provider: CALCOM_PROVIDER,
  action,
  reservationId: reservation.id,
  reservationVersion: reservation.version,
  reservationStatus: reservation.status,
  externalEventId: existingEventId ?? null,
  startAt: reservation.startAt.toISOString(),
  endAt: reservation.endAt.toISOString(),
  durationMin: reservation.snapshot?.durationMin ?? null,
  locale: reservation.snapshot ? calendarLocale(reservation.snapshot.locale) : null,
  notificationEmail: reservation.snapshot?.notificationEmail ?? reservation.snapshot?.email ?? null,
  notificationPhoneE164: reservation.snapshot?.notificationPhoneE164 ?? null,
  paymentMethod: reservation.payments[0]?.method ?? null,
  timeZone: env.CALCOM_TIME_ZONE,
});

const queueCalendarOperation = async (
  reservation: CalendarReservation,
  action: CalendarAction,
  existingEventId: string | undefined,
) => {
  const idempotencyKey =
    `reservation:${reservation.id}:v${reservation.version}:calendar:${action.toLowerCase()}`;
  const payloadHash = calendarPayloadHash(operationPayload(reservation, action, existingEventId));
  try {
    return await prisma.calendarSyncLog.create({
      data: {
        reservationId: reservation.id,
        reservationVersion: reservation.version,
        provider: CALCOM_PROVIDER,
        action,
        idempotencyKey,
        payloadHash,
        externalEventId: existingEventId,
        maxAttempts: MAX_ATTEMPTS,
        status: action === 'CANCEL' && !existingEventId
          ? CalendarStatus.NOT_REQUIRED
          : CalendarStatus.PENDING,
        error: action === 'CANCEL' && !existingEventId
          ? 'CALENDAR_EXTERNAL_EVENT_NOT_FOUND'
          : null,
        nextAttemptAt: null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.calendarSyncLog.findUniqueOrThrow({ where: { idempotencyKey } });
    }
    throw error;
  }
};

const retryAt = (now: Date, completedAttempt: number) => {
  const delayMinutes = completedAttempt === 1 ? 2 : 10;
  return new Date(now.getTime() + delayMinutes * 60_000);
};

const markTerminalLocalFailure = (id: string, error: string) =>
  prisma.calendarSyncLog.update({
    where: { id },
    data: {
      status: CalendarStatus.FAILED,
      error,
      providerStatus: 'failed',
      nextAttemptAt: null,
      lockedAt: null,
    },
  });

const recordProviderFailure = async (id: string, now: Date, error: unknown) => {
  const current = await prisma.calendarSyncLog.findUniqueOrThrow({ where: { id } });
  const terminal = current.attemptCount >= current.maxAttempts;
  const updated = await prisma.calendarSyncLog.update({
    where: { id },
    data: {
      status: terminal ? CalendarStatus.FAILED : CalendarStatus.RETRYING,
      error: safeCalendarError(error),
      providerStatus: terminal ? 'failed' : 'retry_scheduled',
      nextAttemptAt: terminal ? null : retryAt(now, current.attemptCount),
      lockedAt: null,
    },
  });
  if (terminal && updated.reservationId) {
    await enqueueCalendarSyncFailureAlert({
      calendarSyncLogId: updated.id,
      reservationId: updated.reservationId,
      error: updated.error ?? 'CALENDAR_PROVIDER_FAILED',
    });
  }
  return updated;
};

export const processCalendarSyncLog = async (id: string, adapters: CalendarDeliveryAdapters = {}) => {
  const now = adapters.now?.() ?? new Date();
  const staleBefore = new Date(now.getTime() - env.CALENDAR_LOCK_TIMEOUT_SECONDS * 1000);
  const due = { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] };
  const claim = await prisma.calendarSyncLog.updateMany({
    where: {
      id,
      OR: [
        { status: CalendarStatus.PENDING, ...due },
        { status: CalendarStatus.RETRYING, ...due },
        { status: CalendarStatus.SYNCING, lockedAt: { lte: staleBefore } },
      ],
    },
    data: {
      status: CalendarStatus.SYNCING,
      attemptCount: { increment: 1 },
      lastAttemptAt: now,
      nextAttemptAt: null,
      lockedAt: now,
      error: null,
    },
  });
  if (claim.count === 0) return prisma.calendarSyncLog.findUnique({ where: { id } });

  const log = await prisma.calendarSyncLog.findUnique({ where: { id } });
  if (!log?.reservationId) return null;
  const reservation = await reservationForCalendar(log.reservationId);
  if (!reservation) return markTerminalLocalFailure(id, 'CALENDAR_RESERVATION_NOT_FOUND');

  if (!reservation.snapshot) {
    await recordMissingReservationSnapshot(reservation.id, 'calendar_sync');
    return markTerminalLocalFailure(id, 'CALENDAR_RESERVATION_SNAPSHOT_MISSING');
  }

  const existingEventId = log.externalEventId ?? await latestActiveCalendarEvent(reservation.id);
  const expectedAction = desiredCalendarAction(reservation.status, existingEventId);
  if (expectedAction !== log.action || reservation.version !== log.reservationVersion) {
    return prisma.calendarSyncLog.update({
      where: { id },
      data: {
        status: CalendarStatus.NOT_REQUIRED,
        error: 'CALENDAR_OPERATION_SUPERSEDED',
        providerStatus: 'superseded',
        nextAttemptAt: null,
        lockedAt: null,
      },
    });
  }

  const context = {
    idempotencyKey: log.idempotencyKey ?? `calendar-log:${log.id}`,
    payloadHash: log.payloadHash ?? calendarPayloadHash(operationPayload(
      reservation,
      log.action as CalendarAction,
      existingEventId,
    )),
  };

  try {
    const reconciled = log.attemptCount > 1
      ? await (adapters.reconcile ?? reconcileCalCom)(
          reservation,
          log.action as CalendarAction,
          existingEventId,
          context,
        )
      : null;
    const result = reconciled ?? await (adapters.deliver ?? deliverToCalCom)(
      reservation,
      log.action as CalendarAction,
      existingEventId,
      context,
    );
    if (result.status === CalendarStatus.NOT_REQUIRED || result.status === 'SKIPPED') {
      return prisma.calendarSyncLog.update({
        where: { id },
        data: {
          status: CalendarStatus.NOT_REQUIRED,
          externalEventId: result.externalEventId ?? existingEventId,
          providerStatus: result.providerStatus,
          error: result.error,
          nextAttemptAt: null,
          lockedAt: null,
        },
      });
    }
    const externalEventId = result.externalEventId ?? existingEventId;
    if (!externalEventId) throw new Error('CALENDAR_PROVIDER_ID_MISSING');
    return prisma.calendarSyncLog.update({
      where: { id },
      data: {
        status: CalendarStatus.SYNCED,
        externalEventId,
        providerStatus: result.providerStatus ?? (reconciled ? 'reconciled' : 'accepted'),
        error: null,
        syncedAt: now,
        nextAttemptAt: null,
        lockedAt: null,
      },
    });
  } catch (error) {
    return recordProviderFailure(id, now, error);
  }
};

export const syncReservationToCalendar = async (
  reservationId: string,
  adapters: CalendarDeliveryAdapters = {},
) => {
  const reservation = await reservationForCalendar(reservationId);
  if (!reservation) throw new Error('CALENDAR_RESERVATION_NOT_FOUND');

  const alreadySynced = await prisma.calendarSyncLog.findFirst({
    where: {
      reservationId,
      provider: CALCOM_PROVIDER,
      reservationVersion: reservation.version,
      status: CalendarStatus.SYNCED,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (alreadySynced) return alreadySynced;

  const existingEventId = await latestActiveCalendarEvent(reservation.id);
  const action = desiredCalendarAction(reservation.status, existingEventId);
  if (!action) {
    return prisma.calendarSyncLog.create({
      data: {
        reservationId,
        reservationVersion: reservation.version,
        provider: CALCOM_PROVIDER,
        action: 'CREATE',
        status: CalendarStatus.NOT_REQUIRED,
        error: 'CALENDAR_STATUS_NOT_SYNCABLE',
        maxAttempts: MAX_ATTEMPTS,
      },
    });
  }

  const operation = await queueCalendarOperation(reservation, action, existingEventId);
  const processed = await processCalendarSyncLog(operation.id, adapters);
  if (!processed) throw new Error('CALENDAR_SYNC_LOG_NOT_FOUND');
  return processed;
};

export const retryCalendarSync = async (
  reservationId: string,
  adapters: CalendarDeliveryAdapters = {},
) => {
  const now = adapters.now?.() ?? new Date();
  const reservation = await reservationForCalendar(reservationId);
  if (!reservation) throw new Error('CALENDAR_RESERVATION_NOT_FOUND');
  const retryable = await prisma.calendarSyncLog.findFirst({
    where: {
      reservationId,
      provider: CALCOM_PROVIDER,
      reservationVersion: reservation.version,
      status: { in: [CalendarStatus.FAILED, CalendarStatus.RETRYING, CalendarStatus.NOT_REQUIRED] },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!retryable) return syncReservationToCalendar(reservationId, adapters);

  await prisma.calendarSyncLog.updateMany({
    where: {
      id: retryable.id,
      status: { in: [CalendarStatus.FAILED, CalendarStatus.RETRYING, CalendarStatus.NOT_REQUIRED] },
    },
    data: {
      status: CalendarStatus.PENDING,
      attemptCount: 0,
      maxAttempts: MAX_ATTEMPTS,
      lastAttemptAt: null,
      nextAttemptAt: now,
      lockedAt: null,
      error: null,
      providerStatus: 'manual_retry',
    },
  });
  const result = await processCalendarSyncLog(retryable.id, adapters);
  if (!result) throw new Error('CALENDAR_SYNC_LOG_NOT_FOUND');
  return result;
};

export const processCalendarOutbox = async (adapters: CalendarDeliveryAdapters = {}) => {
  const now = adapters.now?.() ?? new Date();
  const staleBefore = new Date(now.getTime() - env.CALENDAR_LOCK_TIMEOUT_SECONDS * 1000);
  await prisma.calendarSyncLog.updateMany({
    where: { status: CalendarStatus.SYNCING, lockedAt: { lte: staleBefore } },
    data: {
      status: CalendarStatus.RETRYING,
      nextAttemptAt: now,
      lockedAt: null,
      error: 'CALENDAR_STALE_LOCK_RECOVERED',
      providerStatus: 'reconciliation_required',
    },
  });

  const logs = await prisma.calendarSyncLog.findMany({
    where: {
      status: { in: [CalendarStatus.PENDING, CalendarStatus.RETRYING] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
    take: env.CALENDAR_BATCH_SIZE,
    select: { id: true },
  });
  return Promise.all(logs.map((log) => processCalendarSyncLog(log.id, adapters)));
};

export const startCalendarWorker = () => {
  if (!env.CALENDAR_WORKER_ENABLED) return () => undefined;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await processCalendarOutbox();
    } catch (error) {
      console.error('Calendar worker cycle failed', safeCalendarError(error));
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void run(), env.CALENDAR_WORKER_INTERVAL_MS);
  timer.unref();
  void run();
  return () => clearInterval(timer);
};

export const getCalendarSyncHealth = async () => {
  if (!calComConfigured()) {
    return { ok: false, provider: CALCOM_PROVIDER, configured: false, error: 'CALENDAR_NOT_CONFIGURED' };
  }
  try {
    const response = await calComRequest<{ data?: CalComEventType[] }>(
      '/event-types',
      {},
      env.CALCOM_EVENT_TYPES_API_VERSION,
    );
    const eventTypes = response.data ?? [];
    const configuredEventType = env.CALCOM_EVENT_TYPE_ID
      ? eventTypes.find((eventType) => String(eventType.id) === String(env.CALCOM_EVENT_TYPE_ID))
      : null;
    return {
      ok: env.CALCOM_EVENT_TYPE_ID ? Boolean(configuredEventType) : eventTypes.length > 0,
      provider: CALCOM_PROVIDER,
      configured: true,
      apiVersion: env.CALCOM_EVENT_TYPES_API_VERSION,
      bookingApiVersion: env.CALCOM_API_VERSION,
      bookingsListApiVersion: env.CALCOM_BOOKINGS_LIST_API_VERSION,
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
      apiVersion: env.CALCOM_EVENT_TYPES_API_VERSION,
      bookingApiVersion: env.CALCOM_API_VERSION,
      bookingsListApiVersion: env.CALCOM_BOOKINGS_LIST_API_VERSION,
      eventTypeId: env.CALCOM_EVENT_TYPE_ID ?? null,
      checkedAt: new Date().toISOString(),
      error: safeCalendarError(error),
    };
  }
};
