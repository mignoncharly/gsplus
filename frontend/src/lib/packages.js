import { formatFcfa } from './display-formatters.js';

export const PACKAGE_CATEGORY_LABELS = Object.freeze({
  all: 'Tous',
  portrait: 'Portraits',
  famille: 'Famille & Enfants',
  maternite: 'Maternité',
  fiancailles: 'Fiançailles & Pré-mariage',
  event: 'Événementiel',
});

export const shootingCategories = [
  { key: 'all', label: PACKAGE_CATEGORY_LABELS.all },
  { key: 'portrait', label: PACKAGE_CATEGORY_LABELS.portrait },
  { key: 'famille', label: PACKAGE_CATEGORY_LABELS.famille },
  { key: 'maternite', label: PACKAGE_CATEGORY_LABELS.maternite },
  { key: 'fiancailles', label: PACKAGE_CATEGORY_LABELS.fiancailles },
  { key: 'event', label: PACKAGE_CATEGORY_LABELS.event },
];

export const formatPrice = (pack) => {
  const price = formatFcfa(pack.price);
  const base = pack.isRange ? `À partir de ${price}` : price;
  const suffix = pack.options && typeof pack.options === 'object' && !Array.isArray(pack.options)
    ? pack.options.priceSuffix
    : null;
  return typeof suffix === 'string' && suffix.trim() ? `${base} ${suffix.trim()}` : base;
};

export const formatDuration = (durationMin) => {
  if (!Number.isFinite(durationMin)) return 'Organisation sur échange';
  if (durationMin < 60) return `${durationMin} min`;

  const hours = Math.floor(durationMin / 60);
  const minutes = durationMin % 60;
  return minutes ? `${hours}h${minutes}` : `${hours}h`;
};

export const deliveryLabel = () => 'Délai communiqué lors de l’échange WhatsApp';

export const categoryKey = (category = '') => {
  const normalized = category
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('maternite') || normalized.includes('bebe')) return 'maternite';
  if (normalized.includes('duo') || normalized.includes('famille') || normalized.includes('groupe') || normalized.includes('enfant') || normalized.includes('anniversaire')) return 'famille';
  if (normalized.includes('fiancailles') || normalized.includes('mariage')) return 'fiancailles';
  if (normalized.includes('event') || normalized.includes('evenement')) return 'event';
  return 'portrait';

};
export const normalizeFrenchPackageName = (name = '') => name
  .replace(/\bMaternite\b/g, 'Maternité')
  .replace(/\bBebe\b/g, 'Bébé')
  .replace(/\bFiancailles\b/g, 'Fiançailles')
  .replace(/\bPre-mariage\b/g, 'Pré-mariage')
  .replace(/\bDecouverte\b/g, 'Découverte');

export const packageView = (pack) => ({
  ...pack,
  name: normalizeFrenchPackageName(pack.name),
  cat: categoryKey(pack.category),
  categoryLabel: PACKAGE_CATEGORY_LABELS[categoryKey(pack.category)] || pack.category,
  priceLabel: formatPrice(pack),
  durationLabel: formatDuration(pack.durationMin),
  deliveryLabel: pack.deliveryLabel?.trim() || deliveryLabel(pack.durationMin),
  bookingMode: pack.bookingMode || 'DIRECT',
  isDirectBooking: (pack.bookingMode || 'DIRECT') === 'DIRECT' && Number.isFinite(pack.durationMin),
});

export const selectPackageFromQuery = (packages, queryValue) => {
  if (!packages.length) return null;
  if (!queryValue) return packages[0];

  return (
    packages.find((pack) => pack.id === queryValue || pack.slug === queryValue) ||
    packages.find((pack) => String(pack.sortOrder / 10) === queryValue) ||
    packages[0]
  );
};
