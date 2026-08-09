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
  return pack.isRange ? `À partir de ${price}` : price;
};

export const formatDuration = (durationMin) => {
  if (durationMin <= 30) return '20-30 min';
  if (durationMin < 60) return `${durationMin} min`;
  if (durationMin === 480) return 'Journée';

  const hours = Math.floor(durationMin / 60);
  const minutes = durationMin % 60;
  return minutes ? `${hours}h${minutes}` : `${hours}h`;
};

export const deliveryLabel = (durationMin) => {
  if (durationMin <= 30) return '24 h';
  if (durationMin <= 60) return '48 h';
  if (durationMin <= 120) return '72 h';
  if (durationMin <= 240) return '5 jours';
  return '7 jours';
};

export const categoryKey = (category = '') => {
  const normalized = category
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('duo') || normalized.includes('famille') || normalized.includes('enfant')) return 'famille';
  if (normalized.includes('maternite') || normalized.includes('naissance')) return 'maternite';
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
