export const BUSINESS_TIME_ZONE = 'Africa/Douala';

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const businessLocaleTag = (locale = 'fr') => locale === 'en' ? 'en-GB' : 'fr-CM';

export const parseBusinessDateKey = (dateKey) => {
  const match = DATE_KEY.exec(dateKey || '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day, date };
};

export const businessDateKey = (instant = new Date()) => {
  const parts = Object.fromEntries(
    partsFormatter
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const addBusinessDays = (dateKey, days) => {
  const parsed = parseBusinessDateKey(dateKey);
  if (!parsed) throw new Error('Date de Douala invalide.');
  parsed.date.setUTCDate(parsed.date.getUTCDate() + days);
  return parsed.date.toISOString().slice(0, 10);
};

export const businessDateLabelParts = (dateKey) => {
  const parsed = parseBusinessDateKey(dateKey);
  if (!parsed) return null;
  return {
    dayOfWeek: parsed.date.getUTCDay(),
    day: parsed.day,
    month: parsed.month - 1,
    year: parsed.year,
  };
};

export const formatBusinessDateKey = (dateKey, locale = 'fr') => {
  const parsed = parseBusinessDateKey(dateKey);
  if (!parsed) return '';
  return new Intl.DateTimeFormat(businessLocaleTag(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed.date);
};

export const businessMonthLabels = (locale = 'fr') => Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat(businessLocaleTag(locale), { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2026, index, 1))));

export const daysInBusinessMonth = (year, month) => new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();

export const doualaLocalDateTimeToIso = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || '')) {
    throw new Error('Date/heure de Douala invalide.');
  }
  const instant = new Date(`${value}:00+01:00`);
  if (Number.isNaN(instant.getTime())) {
    throw new Error('Date/heure de Douala invalide.');
  }
  return instant.toISOString();
};

export const formatBusinessDate = (value, locale = 'fr') =>
  new Intl.DateTimeFormat(businessLocaleTag(locale), {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: 'long',
  }).format(new Date(value));

export const formatBusinessTime = (value, locale = 'fr') =>
  new Intl.DateTimeFormat(businessLocaleTag(locale), {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));

export const formatBusinessDateTime = (value, locale = 'fr') =>
  new Intl.DateTimeFormat(businessLocaleTag(locale), {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export const currentBusinessMonthKey = () => businessDateKey().slice(0, 7);

export const businessDateTimeLocalValue = (value) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(value))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};
