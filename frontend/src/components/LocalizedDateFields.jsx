import { useMemo, useState } from 'react';
import { businessMonthLabels, daysInBusinessMonth, parseBusinessDateKey } from '../lib/business-time.js';
import { useLocale } from '../lib/i18n.js';
import './LocalizedDateFields.css';

const emptyParts = { day: '', month: '', year: '' };
const partsFor = (value) => {
  const parsed = parseBusinessDateKey(value);
  return parsed ? { day: String(parsed.day), month: String(parsed.month), year: String(parsed.year) } : emptyParts;
};

const LocalizedDateFields = ({ id, name, label, value, onChange, min = '1900-01-01', max = '2100-12-31', required = false }) => {
  const { locale } = useLocale();
  const [state, setState] = useState(() => ({ externalValue: value, parts: partsFor(value) }));
  const parts = state.externalValue === value ? state.parts : partsFor(value);
  const minParts = parseBusinessDateKey(min);
  const maxParts = parseBusinessDateKey(max);
  const months = useMemo(() => businessMonthLabels(locale), [locale]);
  const years = useMemo(() => Array.from({ length: maxParts.year - minParts.year + 1 }, (_, index) => maxParts.year - index), [maxParts.year, minParts.year]);
  const dayCount = parts.year && parts.month ? daysInBusinessMonth(parts.year, parts.month) : 31;

  const update = (field, nextValue) => {
    const next = { ...parts, [field]: nextValue };
    if (next.day && next.month && next.year && Number(next.day) > daysInBusinessMonth(next.year, next.month)) next.day = '';
    setState({ externalValue: value, parts: next });
    if (!next.day || !next.month || !next.year) {
      if (value) onChange('');
      return;
    }
    const dateKey = `${next.year}-${next.month.padStart(2, '0')}-${next.day.padStart(2, '0')}`;
    onChange(parseBusinessDateKey(dateKey) && dateKey >= min && dateKey <= max ? dateKey : '');
  };

  const fields = {
    day: <label key="day"><span>{locale === 'en' ? 'Day' : 'Jour'}</span><select id={`${id}-day`} value={parts.day} onChange={(event) => update('day', event.target.value)} required={required} aria-label={locale === 'en' ? 'Day' : 'Jour'}><option value="">—</option>{Array.from({ length: dayCount }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>,
    month: <label key="month"><span>{locale === 'en' ? 'Month' : 'Mois'}</span><select id={`${id}-month`} value={parts.month} onChange={(event) => update('month', event.target.value)} required={required} aria-label={locale === 'en' ? 'Month' : 'Mois'}><option value="">—</option>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label>,
    year: <label key="year"><span>{locale === 'en' ? 'Year' : 'Année'}</span><select id={`${id}-year`} value={parts.year} onChange={(event) => update('year', event.target.value)} required={required} aria-label={locale === 'en' ? 'Year' : 'Année'}><option value="">—</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>,
  };

  return <fieldset id={id} className="localized-date-fields"><legend>{label}</legend><div>{(locale === 'en' ? ['month', 'day', 'year'] : ['day', 'month', 'year']).map((field) => fields[field])}</div><input type="hidden" name={name} value={value} /></fieldset>;
};

export default LocalizedDateFields;
