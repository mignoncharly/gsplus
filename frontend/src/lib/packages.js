import { formatFcfa } from './display-formatters.js';

export const formatPrice = (pack, locale = 'fr') => {
  const price = formatFcfa(pack.price);
  const base = pack.isRange ? (locale === 'en' ? `From ${price}` : `À partir de ${price}`) : price;
  const suffix = pack.options && typeof pack.options === 'object' && !Array.isArray(pack.options) ? pack.options.priceSuffix : null;
  return typeof suffix === 'string' && suffix.trim() ? `${base} ${suffix.trim()}` : base;
};

export const formatDuration = (durationMin, locale = 'fr') => {
  if (!Number.isFinite(durationMin)) return locale === 'en' ? 'Arranged on request' : 'Organisation sur échange';
  if (durationMin < 60) return `${durationMin} min`;
  const hours = Math.floor(durationMin / 60);
  const minutes = durationMin % 60;
  return minutes ? `${hours}h${minutes}` : `${hours}h`;
};

export const GENERIC_DELIVERY_CONTACT = 'Pour connaître les modalités et délais de livraison de cette offre, veuillez nous contacter.';
export const GENERIC_DELIVERY_CONTACT_ENGLISH = 'Please contact us for delivery terms and timelines for this offer.';
export const deliveryLabel = (locale = 'fr') => locale === 'en' ? GENERIC_DELIVERY_CONTACT_ENGLISH : GENERIC_DELIVERY_CONTACT;
export const deliveryLabelOrigin = (value) => {
  const label = value?.trim();
  if (!label) return 'MISSING';
  return label === GENERIC_DELIVERY_CONTACT ? 'GENERIC_FALLBACK' : 'OWNER_EXPLICIT';
};

const localizedRecord = (records, locale) => records?.find((item) => item.locale === locale && item.isEnabled !== false)
  ?? records?.find((item) => item.locale === 'fr' && item.isEnabled !== false)
  ?? null;

const taxonomyLabel = (taxonomy, locale) => {
  const labels = taxonomy?.locales;
  if (Array.isArray(labels)) return localizedRecord(labels, locale)?.label ?? taxonomy.key;
  return labels?.[locale] ?? labels?.fr ?? taxonomy?.key ?? '';
};

export const shootingCategoriesForLocale = (taxonomy = [], locale = 'fr') => [
  { key: 'all', label: locale === 'en' ? 'All' : 'Toutes' },
  ...taxonomy.map((item) => ({ key: item.key, label: taxonomyLabel(item, locale), sortOrder: item.sortOrder })),
];

export const normalizeFrenchPackageName = (name = '') => name.replace(/\bMaternite\b/g, 'Maternité').replace(/\bBebe\b/g, 'Bébé').replace(/\bFiancailles\b/g, 'Fiançailles').replace(/\bPre-mariage\b/g, 'Pré-mariage').replace(/\bDecouverte\b/g, 'Découverte');

export const packageView = (pack, locale = 'fr') => {
  const localized = localizedRecord(pack.locales, locale);
  const packageName = localized?.name ?? pack.name;
  const sourceDelivery = localized?.deliveryLabel?.trim() || pack.deliveryLabel?.trim() || deliveryLabel(locale);
  const options = localized?.options && typeof localized.options === 'object' ? localized.options : pack.options;
  const view = {
    ...pack,
    name: locale === 'fr' ? normalizeFrenchPackageName(packageName) : packageName,
    description: localized?.description ?? pack.description,
    content: localized?.content ?? pack.content,
    inclusions: localized?.inclusions ?? pack.inclusions,
    conditions: localized?.conditions ?? pack.conditions,
    mandatoryWording: localized?.mandatoryWording ?? pack.legalText,
    deliveryLabel: sourceDelivery,
    options,
    cat: pack.taxonomyKey,
    categoryLabel: taxonomyLabel(pack.taxonomy, locale) || pack.category,
    priceLabel: formatPrice({ ...pack, options }, locale),
    durationLabel: formatDuration(pack.durationMin, locale),
    deliveryLabelOrigin: pack.deliveryLabelOrigin ?? deliveryLabelOrigin(sourceDelivery),
    bookingMode: pack.bookingMode || 'CONTACT',
  };
  return { ...view, isDirectBooking: view.bookingMode === 'DIRECT' && Number.isFinite(view.durationMin) };
};

export const catalogueBenefitView = (benefit, locale = 'fr') => {
  const localized = localizedRecord(benefit.locales, locale);
  return { ...benefit, ...(localized ?? {}), categoryLabel: taxonomyLabel(benefit.taxonomy, locale) };
};

export const packageCtaLabel = (pack, locale = 'fr') => {
  if (locale === 'en') return pack.isDirectBooking ? 'Book this package' : 'Contact us';
  return pack.isDirectBooking ? 'Réserver ce pack' : 'Nous contacter';
};

export const selectPackageFromQuery = (packages, queryValue) => {
  if (!packages.length) return null;
  if (!queryValue) return packages[0];
  return packages.find((pack) => pack.id === queryValue || pack.slug === queryValue) || packages.find((pack) => String(pack.sortOrder / 10) === queryValue) || packages[0];
};
