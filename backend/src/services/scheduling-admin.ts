import { HttpError } from '../errors/http-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { addBusinessDays, businessDateKey, businessLocalToInstant } from '../utils/business-time.js';
import { isValidTime, parseBreaks, resolveBookingRule, timeToMinutes } from './schedule-rules.js';

export type BusinessHourInput = {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
  breaks?: Array<{ start: string; end: string }>;
};

/** A schedule that closes before it opens, or takes a break outside its own hours, is
 *  rejected here rather than silently producing a day with no slots. */
const assertCoherent = (opensAt: string, closesAt: string, breaks: Array<{ start: string; end: string }> = []) => {
  if (!isValidTime(opensAt) || !isValidTime(closesAt)) {
    throw new HttpError(400, 'INVALID_TIME', 'Utilisez le format HH:MM.');
  }
  const open = timeToMinutes(opensAt);
  const close = timeToMinutes(closesAt);
  if (close <= open) throw new HttpError(400, 'INVALID_RANGE', 'L’heure de fermeture doit suivre l’ouverture.');

  const parsed = parseBreaks(breaks);
  if (parsed.length !== (breaks?.length ?? 0)) {
    throw new HttpError(400, 'INVALID_BREAK', 'Chaque pause doit être au format HH:MM et se terminer après son début.');
  }
  let previousEnd = open;
  for (const pause of parsed) {
    const start = timeToMinutes(pause.start);
    const end = timeToMinutes(pause.end);
    if (start < open || end > close) {
      throw new HttpError(400, 'BREAK_OUTSIDE_HOURS', 'Une pause doit rester dans les heures d’ouverture.');
    }
    if (start < previousEnd && previousEnd !== open) {
      throw new HttpError(400, 'BREAK_OVERLAP', 'Les pauses ne peuvent pas se chevaucher.');
    }
    previousEnd = end;
  }
  return parsed;
};

export const listBusinessHours = () => prisma.businessHour.findMany({ orderBy: { dayOfWeek: 'asc' } });

export const upsertBusinessHour = async (input: BusinessHourInput, adminUserId?: string) => {
  const breaks = input.isClosed ? [] : assertCoherent(input.opensAt, input.closesAt, input.breaks);
  const data = {
    opensAt: input.opensAt,
    closesAt: input.closesAt,
    isClosed: input.isClosed,
    breaks: breaks.length ? breaks : Prisma.DbNull,
  };
  const saved = await prisma.businessHour.upsert({
    where: { dayOfWeek: input.dayOfWeek },
    update: data,
    create: { dayOfWeek: input.dayOfWeek, ...data },
  });
  await prisma.auditLog.create({
    data: { adminUserId, action: 'schedule.business_hour.update', entityType: 'BusinessHour', entityId: saved.id, metadata: { ...input } },
  });
  return saved;
};

export const listScheduleExceptions = (from?: string, to?: string) => prisma.scheduleException.findMany({
  where: { ...(from ? { date: { gte: from } } : {}), ...(to ? { date: { lte: to } } : {}) },
  orderBy: { date: 'asc' },
  include: { createdBy: { select: { id: true, name: true } } },
});

export const upsertScheduleException = async (input: {
  date: string; isClosed: boolean; opensAt?: string | null; closesAt?: string | null;
  breaks?: Array<{ start: string; end: string }>; reason: string;
}, adminUserId?: string) => {
  if (!input.isClosed) {
    if (!input.opensAt || !input.closesAt) {
      throw new HttpError(400, 'EXCEPTION_HOURS_REQUIRED', 'Indiquez les heures d’ouverture de cette exception.');
    }
    assertCoherent(input.opensAt, input.closesAt, input.breaks);
  }
  const breaks = !input.isClosed && input.breaks?.length ? input.breaks : Prisma.DbNull;
  const saved = await prisma.scheduleException.upsert({
    where: { date: input.date },
    update: { isClosed: input.isClosed, opensAt: input.opensAt ?? null, closesAt: input.closesAt ?? null, breaks, reason: input.reason },
    create: {
      date: input.date, isClosed: input.isClosed, opensAt: input.opensAt ?? null,
      closesAt: input.closesAt ?? null, breaks, reason: input.reason, createdById: adminUserId,
    },
  });
  await prisma.auditLog.create({
    data: { adminUserId, action: 'schedule.exception.upsert', entityType: 'ScheduleException', entityId: saved.id, metadata: { ...input } },
  });
  return saved;
};

export const deleteScheduleException = async (date: string, adminUserId?: string) => {
  const existing = await prisma.scheduleException.findUnique({ where: { date } });
  if (!existing) throw new HttpError(404, 'EXCEPTION_NOT_FOUND', 'Exception introuvable.');
  await prisma.scheduleException.delete({ where: { date } });
  await prisma.auditLog.create({
    data: { adminUserId, action: 'schedule.exception.delete', entityType: 'ScheduleException', entityId: existing.id, metadata: { date } },
  });
};

export const listBookingRules = async () => {
  const [rules, packages] = await Promise.all([
    prisma.bookingRule.findMany({ include: { package: { select: { id: true, name: true } } } }),
    prisma.package.findMany({ where: { isArchived: false }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  const global = rules.find((rule) => rule.packageId === null) ?? null;
  return {
    global,
    effectiveGlobal: resolveBookingRule({ global }),
    perPackage: rules.filter((rule) => rule.packageId !== null),
    packages,
  };
};

export const upsertBookingRule = async (input: {
  packageId: string | null;
  minNoticeMinutes: number | null;
  horizonDays: number | null;
  dailyCapacity: number | null;
  bufferMinutes: number | null;
}, adminUserId?: string) => {
  if (input.packageId) {
    const pack = await prisma.package.findUnique({ where: { id: input.packageId }, select: { id: true } });
    if (!pack) throw new HttpError(404, 'PACKAGE_NOT_FOUND', 'Formule introuvable.');
  }
  const data = {
    minNoticeMinutes: input.minNoticeMinutes,
    horizonDays: input.horizonDays,
    dailyCapacity: input.dailyCapacity,
    bufferMinutes: input.bufferMinutes,
    updatedById: adminUserId ?? null,
  };
  const existing = await prisma.bookingRule.findFirst({ where: { packageId: input.packageId } });
  const saved = existing
    ? await prisma.bookingRule.update({ where: { id: existing.id }, data })
    : await prisma.bookingRule.create({ data: { ...data, packageId: input.packageId } });
  await prisma.auditLog.create({
    data: { adminUserId, action: 'schedule.booking_rule.update', entityType: 'BookingRule', entityId: saved.id, metadata: { ...input } },
  });
  return saved;
};

/**
 * Everything the planning view needs for one window: the reservations and holds that
 * occupy it, the studio's own blocks, and the resolved schedule for each day.
 */
export const getPlanningWindow = async (from: string, to: string) => {
  const windowStart = businessLocalToInstant(from);
  const windowEnd = businessLocalToInstant(addBusinessDays(to, 1));
  const [reservations, blocks, intents, businessHours, exceptions] = await Promise.all([
    prisma.reservation.findMany({
      where: { startAt: { lt: windowEnd }, endAt: { gt: windowStart } },
      orderBy: { startAt: 'asc' },
      select: {
        id: true, reference: true, status: true, startAt: true, endAt: true, scheduleKind: true,
        package: { select: { id: true, name: true } },
        snapshot: { select: { firstName: true, lastName: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.availabilityBlock.findMany({ where: { startAt: { lt: windowEnd }, endAt: { gt: windowStart } }, orderBy: { startAt: 'asc' } }),
    prisma.reservationIntent.findMany({
      where: { reservationId: null, expiresAt: { gt: new Date() }, startAt: { lt: windowEnd }, endAt: { gt: windowStart } },
      orderBy: { startAt: 'asc' },
      select: { id: true, startAt: true, endAt: true, expiresAt: true, package: { select: { name: true } } },
    }),
    listBusinessHours(),
    listScheduleExceptions(from, to),
  ]);

  const days: Array<{ date: string; dayOfWeek: number; isClosed: boolean; opensAt: string | null; closesAt: string | null; reason: string | null }> = [];
  const hoursByDay = new Map(businessHours.map((hour) => [hour.dayOfWeek, hour]));
  const exceptionByDate = new Map(exceptions.map((item) => [item.date, item]));
  for (let date = from; date <= to; date = addBusinessDays(date, 1)) {
    const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
    const exception = exceptionByDate.get(date);
    const hour = hoursByDay.get(dayOfWeek);
    const closed = exception ? exception.isClosed : (!hour || hour.isClosed);
    days.push({
      date,
      dayOfWeek,
      isClosed: closed,
      opensAt: closed ? null : (exception?.opensAt ?? hour?.opensAt ?? null),
      closesAt: closed ? null : (exception?.closesAt ?? hour?.closesAt ?? null),
      reason: exception?.reason ?? null,
    });
  }

  return { from, to, today: businessDateKey(new Date()), days, reservations, blocks, intents };
};

/** Cal.com health: last success, last failure and what is still waiting. */
export const getCalendarHealth = async () => {
  const [lastSuccess, lastFailure, pending, failing] = await Promise.all([
    prisma.calendarSyncLog.findFirst({ where: { status: 'SYNCED' }, orderBy: { createdAt: 'desc' } }),
    prisma.calendarSyncLog.findFirst({ where: { status: 'FAILED' }, orderBy: { createdAt: 'desc' } }),
    prisma.calendarSyncLog.count({ where: { status: { in: ['PENDING', 'SYNCING', 'RETRYING'] } } }),
    prisma.calendarSyncLog.count({ where: { status: 'FAILED' } }),
  ]);
  return {
    lastSuccessAt: lastSuccess?.createdAt ?? null,
    lastFailureAt: lastFailure?.createdAt ?? null,
    lastFailureError: lastFailure?.error ?? null,
    pendingCount: pending,
    failingCount: failing,
    healthy: failing === 0 && pending === 0,
  };
};
