export const BUSINESS_TIME_ZONE = 'Africa/Douala';

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

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
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const businessDateLabelParts = (dateKey) => {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  return {
    dayOfWeek: date.getUTCDay(),
    day: date.getUTCDate(),
    month: date.getUTCMonth(),
  };
};

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

export const formatBusinessDateTime = (value) =>
  new Intl.DateTimeFormat('fr-CM', {
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
