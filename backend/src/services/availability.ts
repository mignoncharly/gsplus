import { HttpError } from '../errors/http-error.js';
import {
  PackageBookingMode,
  ReservationScheduleKind,
  type AvailabilityBlock,
  type BookingRule,
  type BusinessHour,
  type Package,
  type Reservation,
  type ReservationIntent,
  type ScheduleException,
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
} from './booking-slots.js';
import {
  type EffectiveBookingRule,
  isWithinSchedule,
  minutesToTime,
  resolveBookingRule,
  resolveDaySchedule,
} from './schedule-rules.js';

type AvailabilityQuery = { from: string; to: string; packageId: string };

type AvailabilitySlot = {
  time: string;
  endTime: string;
  startAt: string;
  endAt: string;
  available: boolean;
  reason: 'availability_block' | 'reservation' | 'reservation_intent' | 'package_daily_quota'
    | 'schedule_break' | 'minimum_notice' | 'booking_horizon' | null;
};

type AvailabilityDay = {
  date: string;
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  closureReason: string | null;
  slots: AvailabilitySlot[];
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
  exception: ScheduleException | undefined,
  rule: EffectiveBookingRule,
  now: Date,
  pack: Package,
  blocks: AvailabilityBlock[],
  reservations: Reservation[],
  intents: ReservationIntent[],
): AvailabilityDay => {
  const dayOfWeek = businessDayOfWeek(date);
  // The same resolver the booking transaction uses, so the grid cannot offer a slot
  // the booking would refuse.
  const schedule = resolveDaySchedule({ dayOfWeek, businessHour, exception, pack });

  if (schedule.isClosed) {
    return {
      date,
      dayOfWeek,
      opensAt: null,
      closesAt: null,
      isClosed: true,
      closureReason: schedule.reason,
      slots: [],
    };
  }

  const dailyUsage = reservations.filter((item) => item.packageId === pack.id && businessDateKey(item.startAt) === date).length
    + intents.filter((item) => item.packageId === pack.id && businessDateKey(item.startAt) === date).length;
  const quotaReached = Boolean(rule.dailyCapacity && dailyUsage >= rule.dailyCapacity);
  const horizonEnd = rule.horizonDays === null
    ? null
    : businessLocalToInstant(addBusinessDays(businessDateKey(now), rule.horizonDays + 1));
  const slots: AvailabilitySlot[] = [];

  for (let startMin = schedule.openMin; startMin + pack.durationMin! <= schedule.closeMin; startMin += SLOT_INTERVAL_MIN) {
    const time = minutesToTime(startMin);
    const endTime = minutesToTime(startMin + pack.durationMin!);
    const slotStart = businessLocalToInstant(date, time);
    const slotEnd = businessLocalToInstant(date, endTime);
    // A buffer keeps a session clear of the one before and after it.
    const guardStart = new Date(slotStart.getTime() - rule.bufferMinutes * 60_000);
    const guardEnd = new Date(slotEnd.getTime() + rule.bufferMinutes * 60_000);

    const reason: AvailabilitySlot['reason'] = !isWithinSchedule(schedule, startMin, startMin + pack.durationMin!)
      ? 'schedule_break'
      : slotStart.getTime() - now.getTime() < rule.minNoticeMinutes * 60_000
        ? 'minimum_notice'
        : horizonEnd !== null && slotStart >= horizonEnd
          ? 'booking_horizon'
          : quotaReached
            ? 'package_daily_quota'
            : getBlockReason(guardStart, guardEnd, blocks, reservations, intents);

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
    opensAt: minutesToTime(schedule.openMin),
    closesAt: minutesToTime(schedule.closeMin),
    isClosed: false,
    closureReason: null,
    slots,
  };
};

const buildDays = (
  from: string,
  to: string,
  pack: Package,
  rule: EffectiveBookingRule,
  now: Date,
  businessHours: BusinessHour[],
  exceptions: ScheduleException[],
  blocks: AvailabilityBlock[],
  reservations: Reservation[],
  intents: ReservationIntent[],
) => {
  const hoursByDay = new Map(businessHours.map((hour) => [hour.dayOfWeek, hour]));
  const exceptionByDate = new Map(exceptions.map((item) => [item.date, item]));
  const days: AvailabilityDay[] = [];
  for (let date = from; date <= to; date = addBusinessDays(date, 1)) {
    days.push(buildDaySlots(
      date,
      hoursByDay.get(businessDayOfWeek(date)),
      exceptionByDate.get(date),
      rule,
      now,
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
  const [businessHours, exceptions, globalRule, packageRule, blocks, reservations, intents] = await Promise.all([
    prisma.businessHour.findMany({ orderBy: { dayOfWeek: 'asc' } }),
    prisma.scheduleException.findMany({ where: { date: { gte: from, lte: to } } }),
    prisma.bookingRule.findFirst({ where: { packageId: null } }),
    prisma.bookingRule.findFirst({ where: { packageId } }),
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
    days: buildDays(
      from, to, pack,
      resolveBookingRule({ global: globalRule, packageRule, pack }),
      now, businessHours, exceptions, blocks, reservations, intents,
    ),
  };
};
