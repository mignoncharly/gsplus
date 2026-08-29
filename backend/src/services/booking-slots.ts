import { HttpError } from '../errors/http-error.js';
import { PackageBookingMode, Prisma, ReservationScheduleKind, ReservationStatus, type Package } from '../generated/prisma/client.js';
import {
  addBusinessDays,
  businessDateKey,
  businessDayOfWeek,
  businessLocalToInstant,
  businessMinutesSinceMidnight,
} from '../utils/business-time.js';
import { isWithinSchedule, packageBookingRules, resolveBookingRule, resolveDaySchedule } from './schedule-rules.js';

// The package-rule parser now lives with the other rule resolution, so booking-slots
// and schedule-rules no longer import each other. Re-exported for existing callers.
export { packageBookingRules, type PackageBookingRules } from './schedule-rules.js';

export const SLOT_INTERVAL_MIN = 30;
export const BLOCKING_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING_CONFIRMATION,
  ReservationStatus.CONFIRMED,
];
export const FUTURE_CLOSURE_BLOCKING_STATUSES: ReservationStatus[] = [
  ReservationStatus.COMPLETED,
  ReservationStatus.NO_SHOW,
];

export const blockingReservationWhere = (now = new Date()): Prisma.ReservationWhereInput => ({
  scheduleKind: ReservationScheduleKind.STANDARD_HOLD,
  OR: [
    { status: { in: BLOCKING_RESERVATION_STATUSES } },
    {
      status: { in: FUTURE_CLOSURE_BLOCKING_STATUSES },
      endAt: { gt: now },
    },
  ],
});

export const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

const isValidTime = (value: unknown): value is string =>
  typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};


const bookingDates = (startAt: Date, endAt: Date) => {
  const dates: string[] = [];
  const endProbe = new Date(endAt.getTime() - 1);
  const lastDate = businessDateKey(endProbe);
  for (let date = businessDateKey(startAt); date <= lastDate; date = addBusinessDays(date, 1)) {
    dates.push(date);
  }
  return dates;
};

export const lockBookingWindow = async (tx: Prisma.TransactionClient, startAt: Date, endAt: Date) => {
  for (const date of bookingDates(startAt, endAt)) {
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('gsp-booking'), hashtext(${date})) IS NULL AS locked`,
    );
  }
};

export const assertBookableSlot = async (
  tx: Prisma.TransactionClient,
  pack: Package,
  startAt: Date,
  endAt: Date,
  options: { excludeIntentId?: string; excludeReservationId?: string; now?: Date } = {},
) => {
  const now = options.now ?? new Date();
  if (pack.bookingMode !== PackageBookingMode.DIRECT || pack.durationMin === null) {
    throw new HttpError(409, 'PACKAGE_CONTACT_ONLY', 'Cette formule est disponible uniquement sur demande.');
  }
  if (startAt <= now) {
    throw new HttpError(409, 'PAST_SLOT', 'The selected slot must be in the future.');
  }

  const startDate = businessDateKey(startAt);
  const endDate = businessDateKey(new Date(endAt.getTime() - 1));
  const startMin = businessMinutesSinceMidnight(startAt);
  const endMin = businessMinutesSinceMidnight(endAt);
  const rules = packageBookingRules(pack);
  const dayOfWeek = businessDayOfWeek(startDate);

  if (rules?.allowedWeekdays?.length && !rules.allowedWeekdays.includes(dayOfWeek)) {
    throw new HttpError(409, 'PACKAGE_SCHEDULE_RESTRICTED', 'Cette formule n’est pas disponible ce jour-là.');
  }
  if (startDate !== endDate || startMin % SLOT_INTERVAL_MIN !== 0) {
    throw new HttpError(409, 'INVALID_SLOT', 'The selected slot is not aligned with the studio schedule.');
  }

  // The same resolver the public grid uses, so the two cannot disagree about when the
  // studio is open, which pauses it takes, or which days are exceptions.
  const [businessHour, exception, globalRule, packageRule] = await Promise.all([
    tx.businessHour.findUnique({ where: { dayOfWeek } }),
    tx.scheduleException.findUnique({ where: { date: startDate } }),
    tx.bookingRule.findFirst({ where: { packageId: null } }),
    tx.bookingRule.findFirst({ where: { packageId: pack.id } }),
  ]);
  const schedule = resolveDaySchedule({ dayOfWeek, businessHour, exception, pack });
  if (schedule.isClosed) {
    throw new HttpError(409, 'STUDIO_CLOSED', schedule.reason
      ? `Le studio est fermé ce jour-là : ${schedule.reason}`
      : 'The studio is closed for the selected day.');
  }
  if (startMin < schedule.openMin || endMin > schedule.closeMin) {
    throw new HttpError(409, 'OUTSIDE_BUSINESS_HOURS', 'The selected slot is outside business hours.');
  }
  if (!isWithinSchedule(schedule, startMin, endMin)) {
    throw new HttpError(409, 'SCHEDULE_BREAK', 'Le studio observe une pause sur ce créneau.');
  }

  const effectiveRule = resolveBookingRule({ global: globalRule, packageRule, pack });
  if (startAt.getTime() - now.getTime() < effectiveRule.minNoticeMinutes * 60_000) {
    throw new HttpError(409, 'MINIMUM_NOTICE', 'Ce créneau est trop proche pour être réservé.');
  }
  if (effectiveRule.horizonDays !== null) {
    const horizonEnd = businessLocalToInstant(addBusinessDays(businessDateKey(now), effectiveRule.horizonDays + 1));
    if (startAt >= horizonEnd) {
      throw new HttpError(409, 'BOOKING_HORIZON', 'Ce créneau dépasse l’horizon de réservation ouvert.');
    }
  }

  if (effectiveRule.dailyCapacity) {
    const dayStart = businessLocalToInstant(startDate);
    const dayEnd = businessLocalToInstant(addBusinessDays(startDate, 1));
    const [reservationCount, intentCount] = await Promise.all([
      tx.reservation.count({
        where: {
          id: options.excludeReservationId ? { not: options.excludeReservationId } : undefined,
          packageId: pack.id,
          startAt: { gte: dayStart, lt: dayEnd },
          ...blockingReservationWhere(now),
        },
      }),
      tx.reservationIntent.count({
        where: {
          id: options.excludeIntentId ? { not: options.excludeIntentId } : undefined,
          packageId: pack.id,
          scheduleKind: ReservationScheduleKind.STANDARD_HOLD,
          reservationId: null,
          expiresAt: { gt: now },
          startAt: { gte: dayStart, lt: dayEnd },
        },
      }),
    ]);
    if (reservationCount + intentCount >= effectiveRule.dailyCapacity) {
      throw new HttpError(409, 'PACKAGE_DAILY_QUOTA_REACHED', 'Le quota quotidien de cette formule est atteint.');
    }
  }

  // A buffer widens the window each probe looks at, keeping a session clear of its
  // neighbours by the configured margin.
  const guardStart = new Date(startAt.getTime() - effectiveRule.bufferMinutes * 60_000);
  const guardEnd = new Date(endAt.getTime() + effectiveRule.bufferMinutes * 60_000);
  const [block, reservation, intent] = await Promise.all([
    tx.availabilityBlock.findFirst({
      where: { startAt: { lt: guardEnd }, endAt: { gt: guardStart } },
      orderBy: { startAt: 'asc' },
    }),
    tx.reservation.findFirst({
      where: {
        id: options.excludeReservationId ? { not: options.excludeReservationId } : undefined,
        startAt: { lt: guardEnd },
        endAt: { gt: guardStart },
        ...blockingReservationWhere(now),
      },
      orderBy: { startAt: 'asc' },
    }),
    tx.reservationIntent.findFirst({
      where: {
        id: options.excludeIntentId ? { not: options.excludeIntentId } : undefined,
        scheduleKind: ReservationScheduleKind.STANDARD_HOLD,
        reservationId: null,
        expiresAt: { gt: now },
        startAt: { lt: guardEnd },
        endAt: { gt: guardStart },
      },
      orderBy: { startAt: 'asc' },
    }),
  ]);

  if (block) throw new HttpError(409, 'AVAILABILITY_BLOCKED', 'The selected slot is blocked by studio availability.');
  if (reservation) throw new HttpError(409, 'SLOT_ALREADY_RESERVED', 'The selected slot is no longer available.');
  if (intent) throw new HttpError(409, 'SLOT_TEMPORARILY_HELD', 'The selected slot is temporarily held by another customer.');
};
