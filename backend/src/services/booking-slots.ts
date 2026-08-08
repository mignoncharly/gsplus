import { HttpError } from '../errors/http-error.js';
import { Prisma, ReservationStatus, type Package } from '../generated/prisma/client.js';
import {
  addBusinessDays,
  businessDateKey,
  businessDayOfWeek,
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
  OR: [
    { status: { in: BLOCKING_RESERVATION_STATUSES } },
    {
      status: { in: FUTURE_CLOSURE_BLOCKING_STATUSES },
      endAt: { gt: now },
    },
  ],
});

export const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

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
  if (startAt <= now) {
    throw new HttpError(409, 'PAST_SLOT', 'The selected slot must be in the future.');
  }

  const startDate = businessDateKey(startAt);
  const endDate = businessDateKey(new Date(endAt.getTime() - 1));
  const startMin = businessMinutesSinceMidnight(startAt);
  const endMin = businessMinutesSinceMidnight(endAt);

  if (startDate !== endDate || startMin % SLOT_INTERVAL_MIN !== 0) {
    throw new HttpError(409, 'INVALID_SLOT', 'The selected slot is not aligned with the studio schedule.');
  }

  const businessHour = await tx.businessHour.findUnique({
    where: { dayOfWeek: businessDayOfWeek(startDate) },
  });

  if (!businessHour || businessHour.isClosed) {
    throw new HttpError(409, 'STUDIO_CLOSED', 'The studio is closed for the selected day.');
  }

  const opensMin = timeToMinutes(businessHour.opensAt);
  const closesMin = timeToMinutes(businessHour.closesAt);
  if (startMin < opensMin || endMin > closesMin) {
    throw new HttpError(409, 'OUTSIDE_BUSINESS_HOURS', 'The selected slot is outside business hours.');
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
        reservationId: null,
        expiresAt: { gt: now },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      orderBy: { startAt: 'asc' },
    }),
  ]);

  if (block) {
    throw new HttpError(409, 'AVAILABILITY_BLOCKED', 'The selected slot is blocked by studio availability.');
  }
  if (reservation) {
    throw new HttpError(409, 'SLOT_ALREADY_RESERVED', 'The selected slot is no longer available.');
  }
  if (intent) {
    throw new HttpError(409, 'SLOT_TEMPORARILY_HELD', 'The selected slot is temporarily held by another customer.');
  }
};
