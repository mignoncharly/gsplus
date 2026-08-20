import { HttpError } from '../errors/http-error.js';
import {
  PackageBookingMode,
  ReservationScheduleKind,
  type AvailabilityBlock,
  type BusinessHour,
  type Package,
  type Reservation,
  type ReservationIntent,
} from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import {
  BUSINESS_TIME_ZONE,
  addBusinessDays,
  businessDateKey,
  businessDayOfWeek,
  businessLocalToInstant,
} from '../utils/business-time.js';
import {
  BLOCKING_RESERVATION_STATUSES,
  SLOT_INTERVAL_MIN,
  blockingReservationWhere,
  packageBookingRules,
} from './booking-slots.js';

type AvailabilityQuery = { from: string; to: string; packageId: string };

type AvailabilitySlot = {
  time: string;
  endTime: string;
  startAt: string;
  endAt: string;
  available: boolean;
  reason: 'availability_block' | 'reservation' | 'reservation_intent' | 'package_daily_quota' | null;
};

type AvailabilityDay = {
  date: string;
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  slots: AvailabilitySlot[];
};

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
};

const overlaps = (startA: Date, endA: Date, startB: Date, endB: Date) => startA < endB && endA > startB;

const getBlockReason = (
  slotStart: Date,
  slotEnd: Date,
  blocks: AvailabilityBlock[],
  reservations: Reservation[],
  intents: ReservationIntent[],
): AvailabilitySlot['reason'] => {
  if (blocks.some((block) => overlaps(slotStart, slotEnd, block.startAt, block.endAt))) return 'availability_block';
  if (reservations.some((item) => overlaps(slotStart, slotEnd, item.startAt, item.endAt))) return 'reservation';
  if (intents.some((item) => overlaps(slotStart, slotEnd, item.startAt, item.endAt))) return 'reservation_intent';
  return null;
};

const buildDaySlots = (
  date: string,
  businessHour: BusinessHour | undefined,
  pack: Package,
  blocks: AvailabilityBlock[],
  reservations: Reservation[],
  intents: ReservationIntent[],
): AvailabilityDay => {
  const dayOfWeek = businessDayOfWeek(date);
  const rules = packageBookingRules(pack);
  const restrictedDay = Boolean(rules?.allowedWeekdays?.length && !rules.allowedWeekdays.includes(dayOfWeek));

  if (!businessHour || businessHour.isClosed || restrictedDay) {
    return {
      date,
      dayOfWeek,
      opensAt: rules?.opensAt ?? businessHour?.opensAt ?? null,
      closesAt: rules?.closesAt ?? businessHour?.closesAt ?? null,
      isClosed: true,
      slots: [],
    };
  }

  const openMin = Math.max(
    timeToMinutes(businessHour.opensAt),
    rules?.opensAt ? timeToMinutes(rules.opensAt) : 0,
  );
  const closeMin = Math.min(
    timeToMinutes(businessHour.closesAt),
    rules?.closesAt ? timeToMinutes(rules.closesAt) : 24 * 60,
  );
  const dailyUsage = reservations.filter((item) => item.packageId === pack.id && businessDateKey(item.startAt) === date).length
    + intents.filter((item) => item.packageId === pack.id && businessDateKey(item.startAt) === date).length;
  const quotaReached = Boolean(rules?.maxReservationsPerDay && dailyUsage >= rules.maxReservationsPerDay);
  const slots: AvailabilitySlot[] = [];

  for (let startMin = openMin; startMin + pack.durationMin! <= closeMin; startMin += SLOT_INTERVAL_MIN) {
    const time = minutesToTime(startMin);
    const endTime = minutesToTime(startMin + pack.durationMin!);
    const slotStart = businessLocalToInstant(date, time);
    const slotEnd = businessLocalToInstant(date, endTime);
    const reason: AvailabilitySlot['reason'] = quotaReached
      ? 'package_daily_quota'
      : getBlockReason(slotStart, slotEnd, blocks, reservations, intents);

    slots.push({
      time,
      endTime,
      startAt: slotStart.toISOString(),
      endAt: slotEnd.toISOString(),
      available: reason === null,
      reason,
    });
  }

  return {
    date,
    dayOfWeek,
    opensAt: minutesToTime(openMin),
    closesAt: minutesToTime(closeMin),
    isClosed: false,
    slots,
  };
};

const buildDays = (
  from: string,
  to: string,
  pack: Package,
  businessHours: BusinessHour[],
  blocks: AvailabilityBlock[],
  reservations: Reservation[],
  intents: ReservationIntent[],
) => {
  const hoursByDay = new Map(businessHours.map((hour) => [hour.dayOfWeek, hour]));
  const days: AvailabilityDay[] = [];
  for (let date = from; date <= to; date = addBusinessDays(date, 1)) {
    days.push(buildDaySlots(
      date,
      hoursByDay.get(businessDayOfWeek(date)),
      pack,
      blocks,
      reservations,
      intents,
    ));
  }
  return days;
};

export const getAvailability = async ({ from, to, packageId }: AvailabilityQuery) => {
  const pack = await prisma.package.findFirst({
    where: { id: packageId, isActive: true, isArchived: false },
  });
  if (!pack) throw new HttpError(404, 'PACKAGE_NOT_FOUND', 'Package not found or inactive.');
  if (pack.bookingMode !== PackageBookingMode.DIRECT || pack.durationMin === null) {
    throw new HttpError(409, 'PACKAGE_CONTACT_ONLY', 'Cette formule est disponible uniquement sur demande.');
  }

  const windowStart = businessLocalToInstant(from);
  const windowEnd = businessLocalToInstant(addBusinessDays(to, 1));
  const now = new Date();
  const [businessHours, blocks, reservations, intents] = await Promise.all([
    prisma.businessHour.findMany({ orderBy: { dayOfWeek: 'asc' } }),
    prisma.availabilityBlock.findMany({
      where: { startAt: { lt: windowEnd }, endAt: { gt: windowStart } },
      orderBy: { startAt: 'asc' },
    }),
    prisma.reservation.findMany({
      where: { startAt: { lt: windowEnd }, endAt: { gt: windowStart }, ...blockingReservationWhere(now) },
      orderBy: { startAt: 'asc' },
    }),
    prisma.reservationIntent.findMany({
      where: {
        scheduleKind: ReservationScheduleKind.STANDARD_HOLD,
        reservationId: null,
        expiresAt: { gt: now },
        startAt: { lt: windowEnd },
        endAt: { gt: windowStart },
      },
      orderBy: { startAt: 'asc' },
    }),
  ]);

  return {
    timeZone: BUSINESS_TIME_ZONE,
    package: { id: pack.id, name: pack.name, durationMin: pack.durationMin },
    from,
    to,
    slotIntervalMin: SLOT_INTERVAL_MIN,
    blockingStatuses: BLOCKING_RESERVATION_STATUSES,
    days: buildDays(from, to, pack, businessHours, blocks, reservations, intents),
  };
};
