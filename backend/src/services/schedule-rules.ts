import type { BookingRule, BusinessHour, Package, ScheduleException } from '../generated/prisma/client.js';

/**
 * One resolver, used by both the public slot grid and the authoritative check inside
 * the booking transaction.
 *
 * Those two paths previously worked out opening hours independently. Adding breaks,
 * dated exceptions and booking rules to each separately would let them drift, and a
 * drift here has a specific, bad shape: the site offers a slot that the booking then
 * refuses. Everything schedule-related therefore resolves here, once.
 */

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

export type TimeRange = { start: string; end: string };

export type DaySchedule = {
  isClosed: boolean;
  openMin: number;
  closeMin: number;
  breaks: Array<{ startMin: number; endMin: number }>;
  /** Where the day's hours came from, so the interface can explain itself. */
  source: 'exception' | 'business_hour' | 'package_restriction' | 'none';
  reason: string | null;
};

export const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const minutesToTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

export const isValidTime = (value: unknown): value is string =>
  typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

/** Breaks are stored as JSON, so they are validated rather than trusted. */
export const parseBreaks = (raw: unknown): TimeRange[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is { start: string; end: string } =>
      Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
      && isValidTime((entry as { start?: unknown }).start)
      && isValidTime((entry as { end?: unknown }).end))
    .map((entry) => ({ start: entry.start, end: entry.end }))
    .filter((entry) => timeToMinutes(entry.end) > timeToMinutes(entry.start))
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
};

const CLOSED: DaySchedule = { isClosed: true, openMin: 0, closeMin: 0, breaks: [], source: 'none', reason: null };

/**
 * Precedence, highest first: a dated exception, then the weekly pattern, then any
 * package restriction narrowing both. A package can only ever narrow the studio's
 * hours, never extend them.
 */
export const resolveDaySchedule = (input: {
  dayOfWeek: number;
  businessHour?: BusinessHour | null;
  exception?: ScheduleException | null;
  pack?: Pick<Package, 'options'> | null;
}): DaySchedule => {
  const packRules = input.pack ? packageBookingRules(input.pack) : null;
  const restrictedDay = Boolean(packRules?.allowedWeekdays?.length && !packRules.allowedWeekdays.includes(input.dayOfWeek));
  if (restrictedDay) return { ...CLOSED, source: 'package_restriction' };

  const exception = input.exception;
  if (exception) {
    if (exception.isClosed || !exception.opensAt || !exception.closesAt) {
      return { ...CLOSED, source: 'exception', reason: exception.reason };
    }
    return narrow({
      openMin: timeToMinutes(exception.opensAt),
      closeMin: timeToMinutes(exception.closesAt),
      breaks: parseBreaks(exception.breaks),
      source: 'exception',
      reason: exception.reason,
    }, packRules);
  }

  const hour = input.businessHour;
  if (!hour || hour.isClosed) return { ...CLOSED, source: 'business_hour' };
  return narrow({
    openMin: timeToMinutes(hour.opensAt),
    closeMin: timeToMinutes(hour.closesAt),
    breaks: parseBreaks(hour.breaks),
    source: 'business_hour',
    reason: null,
  }, packRules);
};

const narrow = (
  base: { openMin: number; closeMin: number; breaks: TimeRange[]; source: DaySchedule['source']; reason: string | null },
  packRules: ReturnType<typeof packageBookingRules>,
): DaySchedule => {
  const openMin = Math.max(base.openMin, packRules?.opensAt ? timeToMinutes(packRules.opensAt) : 0);
  const closeMin = Math.min(base.closeMin, packRules?.closesAt ? timeToMinutes(packRules.closesAt) : 24 * 60);
  if (closeMin <= openMin) return { ...CLOSED, source: base.source, reason: base.reason };
  return {
    isClosed: false,
    openMin,
    closeMin,
    breaks: base.breaks.map((entry) => ({ startMin: timeToMinutes(entry.start), endMin: timeToMinutes(entry.end) })),
    source: base.source,
    reason: base.reason,
  };
};

/** A slot must sit inside the open window and clear of every break. */
export const isWithinSchedule = (schedule: DaySchedule, startMin: number, endMin: number) => {
  if (schedule.isClosed) return false;
  if (startMin < schedule.openMin || endMin > schedule.closeMin) return false;
  return !schedule.breaks.some((pause) => startMin < pause.endMin && endMin > pause.startMin);
};

export type EffectiveBookingRule = {
  minNoticeMinutes: number;
  /** Null means no horizon: any future date stays bookable. */
  horizonDays: number | null;
  dailyCapacity: number | null;
  bufferMinutes: number;
};

/**
 * Every default reproduces the behaviour that existed before this phase: no minimum
 * notice, no horizon, no capacity, no buffer. A new rule that defaulted to a real
 * limit would silently change what customers can book the moment it deployed.
 */
export const DEFAULT_BOOKING_RULE: EffectiveBookingRule = {
  minNoticeMinutes: 0,
  horizonDays: null,
  dailyCapacity: null,
  bufferMinutes: 0,
};

/**
 * A package row overrides the global row field by field; a null field falls back.
 * `maxReservationsPerDay` in `Package.options.bookingRules` predates this table and
 * still wins for the package that declares it, so no existing quota changes meaning.
 */
export const resolveBookingRule = (input: {
  global?: BookingRule | null;
  packageRule?: BookingRule | null;
  pack?: Pick<Package, 'options'> | null;
}): EffectiveBookingRule => {
  const legacyQuota = input.pack ? packageBookingRules(input.pack)?.maxReservationsPerDay ?? null : null;
  const pick = <K extends keyof EffectiveBookingRule>(key: K, fallback: EffectiveBookingRule[K]) =>
    (input.packageRule?.[key as keyof BookingRule] as EffectiveBookingRule[K] | null | undefined)
    ?? (input.global?.[key as keyof BookingRule] as EffectiveBookingRule[K] | null | undefined)
    ?? fallback;

  return {
    minNoticeMinutes: pick('minNoticeMinutes', DEFAULT_BOOKING_RULE.minNoticeMinutes),
    horizonDays: pick('horizonDays', DEFAULT_BOOKING_RULE.horizonDays),
    dailyCapacity: legacyQuota ?? pick('dailyCapacity', DEFAULT_BOOKING_RULE.dailyCapacity),
    bufferMinutes: pick('bufferMinutes', DEFAULT_BOOKING_RULE.bufferMinutes),
  };
};
