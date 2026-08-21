export const BUSINESS_TIME_ZONE = 'Africa/Douala';
export type BusinessLocale = 'fr' | 'en';

export const businessLocaleTag = (locale: string = 'fr') => (locale === 'en' ? 'en-GB' : 'fr-CM');

// Africa/Douala is UTC+01:00 year-round. Keeping the conversion here makes
// browser/server timezone settings irrelevant while the IANA zone remains the
// display contract used by Intl and calendar providers.
const BUSINESS_OFFSET_MINUTES = 60;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_ONLY = /^(\d{2}):(\d{2})$/;

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const businessParts = (instant: Date) => {
  const values = Object.fromEntries(
    partsFormatter
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
  };
};

export const businessLocalToInstant = (date: string, time = '00:00') => {
  const dateMatch = DATE_ONLY.exec(date);
  const timeMatch = TIME_ONLY.exec(time);
  if (!dateMatch || !timeMatch) {
    throw new Error('Invalid Africa/Douala local date or time');
  }

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (month < 1 || month > 12 || hour > 23 || minute > 59) {
    throw new Error('Invalid Africa/Douala local date or time');
  }

  const instant = new Date(Date.UTC(year, month - 1, day, hour, minute) - BUSINESS_OFFSET_MINUTES * 60_000);
  const roundTrip = businessParts(instant);
  if (
    roundTrip.year !== year ||
    roundTrip.month !== month ||
    roundTrip.day !== day ||
    roundTrip.hour !== hour ||
    roundTrip.minute !== minute
  ) {
    throw new Error('Invalid Africa/Douala local date or time');
  }

  return instant;
};

export const businessDateKey = (instant: Date) => {
  const parts = businessParts(instant);
  return `${parts.year.toString().padStart(4, '0')}-${parts.month.toString().padStart(2, '0')}-${parts.day
    .toString()
    .padStart(2, '0')}`;
};

export const businessTimeKey = (instant: Date) => {
  const parts = businessParts(instant);
  return `${parts.hour.toString().padStart(2, '0')}:${parts.minute.toString().padStart(2, '0')}`;
};

export const businessMinutesSinceMidnight = (instant: Date) => {
  const parts = businessParts(instant);
  return parts.hour * 60 + parts.minute;
};

export const businessDayOfWeek = (date: string) => {
  const match = DATE_ONLY.exec(date);
  if (!match) throw new Error('Invalid date');
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
};

export const addBusinessDays = (date: string, days: number) => {
  const cursor = new Date(`${date}T12:00:00.000Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor.toISOString().slice(0, 10);
};

export const businessDayWindow = (date: string) => ({
  start: businessLocalToInstant(date),
  end: businessLocalToInstant(addBusinessDays(date, 1)),
});

export const formatBusinessDate = (instant: Date, locale: string = 'fr') =>
  new Intl.DateTimeFormat(businessLocaleTag(locale), {
    dateStyle: 'long',
    timeZone: BUSINESS_TIME_ZONE,
  }).format(instant);

export const formatBusinessTime = (instant: Date, locale: string = 'fr') => {
  const value = new Intl.DateTimeFormat(businessLocaleTag(locale), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: BUSINESS_TIME_ZONE,
  }).format(instant);
  return locale === 'fr' ? value.replace(':', ' h ') : value;
};

export const formatBusinessDateTime = (instant: Date, locale: string = 'fr') =>
  new Intl.DateTimeFormat(businessLocaleTag(locale), {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: BUSINESS_TIME_ZONE,
  }).format(instant);
