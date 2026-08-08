import { HttpError } from '../errors/http-error.js';
import {
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
  businessDayOfWeek,
  businessLocalToInstant,
} from '../utils/business-time.js';
import {
  BLOCKING_RESERVATION_STATUSES,
  SLOT_INTERVAL_MIN,
  blockingReservationWhere,
} from './booking-slots.js';

type AvailabilityQuery = {
  from: string;
  to: string;
  packageId: string;
};

type AvailabilitySlot = {
  time: string;
  endTime: string;
  startAt: string;
  endAt: string;
  available: boolean;
  reason: 'availability_block' | 'reservation' | 'reservation_intent' | null;
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
  if (blocks.some((block) => overlaps(slotStart, slotEnd, block.startAt, block.endAt))) {
    return 'availability_block';
  }
  if (reservations.some((reservation) => overlaps(slotStart, slotEnd, reservation.startAt, reservation.endAt))) {
    return 'reservation';
  }
  if (intents.some((intent) => overlaps(slotStart, slotEnd, intent.startAt, intent.endAt))) {
    return 'reservation_intent';
  }
  return null;
};

const buildDaySlots = (
  date: string,
  businessHour: BusinessHour | undefined,
  durationMin: number,
  blocks: AvailabilityBlock[],
  reservations: Reservation[],
  intents: ReservationIntent[],
): AvailabilityDay => {
  const dayOfWeek = businessDayOfWeek(date);

  if (!businessHour || businessHour.isClosed) {
    return {
      date,
      dayOfWeek,
      opensAt: businessHour?.opensAt ?? null,
      closesAt: businessHour?.closesAt ?? null,
      isClosed: true,
      slots: [],
    };
  }

  const openMin = timeToMinutes(businessHour.opensAt);
  const closeMin = timeToMinutes(businessHour.closesAt);
  const slots: AvailabilitySlot[] = [];

  for (let startMin = openMin; startMin + durationMin <= closeMin; startMin += SLOT_INTERVAL_MIN) {
    const time = minutesToTime(startMin);
    const endTime = minutesToTime(startMin + durationMin);
    const slotStart = businessLocalToInstant(date, time);
    const slotEnd = businessLocalToInstant(date, endTime);
    const reason = getBlockReason(slotStart, slotEnd, blocks, reservations, intents);

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
    opensAt: businessHour.opensAt,
    closesAt: businessHour.closesAt,
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
    days.push(
      buildDaySlots(
        date,
        hoursByDay.get(businessDayOfWeek(date)),
        pack.durationMin,
        blocks,
        reservations,
        intents,
      ),
    );
  }

  return days;
};

export const getAvailability = async ({ from, to, packageId }: AvailabilityQuery) => {
  const pack = await prisma.package.findFirst({
    where: { id: packageId, isActive: true, isArchived: false },
  });
  if (!pack) {
    throw new HttpError(404, 'PACKAGE_NOT_FOUND', 'Package not found or inactive.');
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
      where: {
        startAt: { lt: windowEnd },
        endAt: { gt: windowStart },
        ...blockingReservationWhere(now),
      },
      orderBy: { startAt: 'asc' },
    }),
    prisma.reservationIntent.findMany({
      where: {
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
