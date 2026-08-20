import { HttpError } from '../errors/http-error.js';
import { PackageBookingMode, Prisma, ReservationScheduleKind, ReservationStatus, type Package } from '../generated/prisma/client.js';
import {
  addBusinessDays,
  businessDateKey,
  businessDayOfWeek,
  businessLocalToInstant,
  businessMinutesSinceMidnight,
} from '../utils/business-time.js';

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

export type PackageBookingRules = {
  allowedWeekdays?: number[];
  opensAt?: string;
  closesAt?: string;
  maxReservationsPerDay?: number;
  requiresFullPayment?: boolean;
  combinable?: boolean;
};

export const packageBookingRules = (pack: Pick<Package, 'options'>): PackageBookingRules | null => {
  const options = pack.options;
  if (!options || typeof options !== 'object' || Array.isArray(options)) return null;
  const raw = options.bookingRules;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  return {
    allowedWeekdays: Array.isArray(raw.allowedWeekdays)
      ? raw.allowedWeekdays.filter((value): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6)
      : undefined,
    opensAt: isValidTime(raw.opensAt) ? raw.opensAt : undefined,
    closesAt: isValidTime(raw.closesAt) ? raw.closesAt : undefined,
    maxReservationsPerDay: typeof raw.maxReservationsPerDay === 'number' && raw.maxReservationsPerDay > 0
      ? Math.floor(raw.maxReservationsPerDay)
      : undefined,
    requiresFullPayment: raw.requiresFullPayment === true,
    combinable: raw.combinable === true,
  };
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

  const businessHour = await tx.businessHour.findUnique({ where: { dayOfWeek } });
  if (!businessHour || businessHour.isClosed) {
    throw new HttpError(409, 'STUDIO_CLOSED', 'The studio is closed for the selected day.');
  }

  const opensMin = Math.max(
    timeToMinutes(businessHour.opensAt),
    rules?.opensAt ? timeToMinutes(rules.opensAt) : 0,
  );
  const closesMin = Math.min(
    timeToMinutes(businessHour.closesAt),
    rules?.closesAt ? timeToMinutes(rules.closesAt) : 24 * 60,
  );
  if (startMin < opensMin || endMin > closesMin) {
    throw new HttpError(409, 'OUTSIDE_BUSINESS_HOURS', 'The selected slot is outside business hours.');
  }

  if (rules?.maxReservationsPerDay) {
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
    if (reservationCount + intentCount >= rules.maxReservationsPerDay) {
      throw new HttpError(409, 'PACKAGE_DAILY_QUOTA_REACHED', 'Le quota quotidien de cette formule est atteint.');
    }
  }

  const [block, reservation, intent] = await Promise.all([
    tx.availabilityBlock.findFirst({
      where: { startAt: { lt: endAt }, endAt: { gt: startAt } },
      orderBy: { startAt: 'asc' },
    }),
    tx.reservation.findFirst({
      where: {
        id: options.excludeReservationId ? { not: options.excludeReservationId } : undefined,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
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
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      orderBy: { startAt: 'asc' },
    }),
  ]);

  if (block) throw new HttpError(409, 'AVAILABILITY_BLOCKED', 'The selected slot is blocked by studio availability.');
  if (reservation) throw new HttpError(409, 'SLOT_ALREADY_RESERVED', 'The selected slot is no longer available.');
  if (intent) throw new HttpError(409, 'SLOT_TEMPORARILY_HELD', 'The selected slot is temporarily held by another customer.');
};
