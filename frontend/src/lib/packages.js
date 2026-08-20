import { formatFcfa } from './display-formatters.js';

const ENGLISH_PACKAGE_NAMES = Object.freeze({
  'flash-social': 'Social Flash', 'identite-standard': 'Standard ID', 'pack-decouverte': 'Discovery Portrait', 'classic-propre': 'Classic', 'pack-signature': 'Signature', 'corporate-linkedin': 'Corporate LinkedIn', 'duo-couple': 'Duo & Couple', famille: 'Family — up to 5 people', 'groupe-fun': 'Fun Group — 6 to 8 people', 'pack-fratrie': 'Siblings Package — 2 to 4 children', maternite: 'Maternity Discovery', 'maternite-douce': 'Soft Maternity', 'maternite-elegance': 'Maternity Elegance', 'bebe-naissance': 'Baby Discovery', 'bebe-premiere-magie': 'Baby First Magic', enfant: 'Child Discovery', 'enfant-star': 'Child Star', 'ado-swag': 'Teen Swag', anniversaire: 'Child Birthday Discovery', 'anniversaire-enfant-star': 'Child Birthday Star', 'anniversaire-adulte-classic': 'Classic Adult Birthday', 'anniversaire-adulte-premium': 'Premium Adult Birthday', 'fiancailles-decouverte': 'Engagement Discovery', 'fiancailles-classic': 'Classic Engagement', 'fiancailles-premium': 'Premium Engagement', 'pre-mariage-decouverte': 'Pre-wedding Discovery', 'pre-mariage-classic': 'Classic Pre-wedding', 'pre-mariage-premium': 'Premium Pre-wedding', 'event-lite': 'Event Lite', 'event-standard': 'Standard Event', 'event-premium': 'Premium Event', 'abonnement-createur-starter': 'Creator Starter Membership', 'abonnement-createur-pro': 'Creator Pro Membership', 'abonnement-influenceur-vip': 'VIP Influencer Membership', 'happy-hours': 'Happy Hours — Social Flash',
});
const ENGLISH_PACKAGE_DESCRIPTIONS = Object.freeze({
  'flash-social': '15 min · 1 backdrop · 1 outfit · 1 HD photo.', 'identite-standard': '1 paper print including the ID cards.', 'pack-decouverte': '30 min · 1 backdrop · 1 outfit · 5 HD photos.', 'classic-propre': '1-hour session · 2 backdrops · 2 outfits · 8 HD photos, including 4 retouched.', 'pack-signature': '1 h 30 · 3 backdrops · 3 outfits · 15 HD photos.', 'corporate-linkedin': '45 min · neutral backdrop · pose direction · 6 HD photos.',
  'duo-couple': '1 h · 2 backdrops · 10 HD photos · 2 people.', famille: '1 h · 2 backdrops · 12 HD photos · up to 5 people.', 'groupe-fun': '1 h 30 · 15 HD photos · simple accessories.', 'pack-fratrie': '1 h · individual and group portraits · 12 HD photos.',
  maternite: '30 min · 1 backdrop · 1 outfit · 5 HD photos.', 'maternite-douce': '1 h · 2 backdrops · 2 outfits · 8 HD photos.', 'maternite-elegance': '1 h 30 · 3 backdrops · 3 outfits · 12 HD photos · studio makeup included.', 'bebe-naissance': 'Up to 30 min · simple set design · 5 HD photos.', 'bebe-premiere-magie': 'Up to 40 min · simple set design and accessories · 8 HD photos.', enfant: '30 min · 1 backdrop · 1 outfit · 5 HD photos.', 'enfant-star': '45 min · 2 backdrops · 2 outfits · 8 HD photos.', 'ado-swag': '1 h · 2 backdrops · 2 outfits · 10 HD photos.',
  anniversaire: '30 min · 1 outfit · 5 HD photos · simple accessories.', 'anniversaire-enfant-star': '45 min · 2 outfits · 8 HD photos · standard set.', 'anniversaire-adulte-classic': '1 h · 2 outfits · 8 HD photos · standard set.', 'anniversaire-adulte-premium': '1 h 30 · 3 outfits · 12 HD photos · premium makeup and set.',
  'fiancailles-decouverte': '1 h · delivery within 10 business days after approval of the selection.', 'fiancailles-classic': '1 h 30 · delivery within 10 business days after approval of the selection.', 'fiancailles-premium': '2 h · delivery within 15 business days after approval of the selection.', 'pre-mariage-decouverte': '1 h 30 in studio · delivery within 15 business days after selection.', 'pre-mariage-classic': '2 h in studio · delivery within 15 business days after selection.', 'pre-mariage-premium': '3 h · studio and 1 outdoor location · delivery within 20 business days.',
  'event-lite': '2 h · 1 location · 50 selected and edited photos.', 'event-standard': '4 h · 1 location · 100 selected and edited photos.', 'event-premium': '8 h · up to 2 nearby locations · 200 selected and edited photos.', 'abonnement-createur-starter': 'One 30-minute session per month · 3-month commitment.', 'abonnement-createur-pro': 'Two Classic sessions per month · 3-month commitment.', 'abonnement-influenceur-vip': 'Three Classic sessions per month · 6-month commitment.', 'happy-hours': 'Wednesday and Thursday, 10:00 to 14:00 · 15 min · 1 person · 1 backdrop · 1 outfit · 1 retouched HD photo · maximum 6 slots per day · full payment · cannot be combined.',
});

export const PACKAGE_CATEGORY_LABELS = Object.freeze({ all: 'Tous', portrait: 'Portraits', famille: 'Famille & Enfants', maternite: 'Maternité', fiancailles: 'Fiançailles & Pré-mariage', event: 'Événementiel' });
export const ENGLISH_PACKAGE_CATEGORY_LABELS = Object.freeze({ all: 'All', portrait: 'Portraits', famille: 'Family & children', maternite: 'Maternity, baby & children', fiancailles: 'Engagement & pre-wedding', event: 'Events' });

export const shootingCategories = [
  { key: 'all', label: PACKAGE_CATEGORY_LABELS.all }, { key: 'portrait', label: PACKAGE_CATEGORY_LABELS.portrait }, { key: 'famille', label: PACKAGE_CATEGORY_LABELS.famille }, { key: 'maternite', label: PACKAGE_CATEGORY_LABELS.maternite }, { key: 'fiancailles', label: PACKAGE_CATEGORY_LABELS.fiancailles }, { key: 'event', label: PACKAGE_CATEGORY_LABELS.event },
];

const ENGLISH_EXPLICIT_DELIVERY = Object.freeze({
  'classic-propre': 'Delivery within 48 to 72 hours', 'fiancailles-decouverte': 'Delivery within 10 business days after approval of the selection.', 'fiancailles-classic': 'Delivery within 10 business days after approval of the selection.', 'fiancailles-premium': 'Delivery within 15 business days after approval of the selection.', 'pre-mariage-decouverte': 'Delivery within 15 business days after selection.', 'pre-mariage-classic': 'Delivery within 15 business days after selection.', 'pre-mariage-premium': 'Delivery within 20 business days.',
});
const FRENCH_DEFAULT_CONDITIONS = 'Besoin de plus d’informations sur cette formule ? Nous sommes à votre disposition. Contactez-nous !';
const ENGLISH_DEFAULT_CONDITIONS = 'Need more information about this package? We are here to help. Contact us!';
const ENGLISH_CONTACT_CONDITIONS = 'Available on request from Golden Studio Plus. Terms are confirmed during your conversation. The applicable published terms and conditions of sale apply.';
const ENGLISH_CLASSIC_CONDITIONS = 'The booking is confirmed after availability has been verified and full payment has been received.';
const IDENTITY_STANDARD_CONDITIONS = FRENCH_DEFAULT_CONDITIONS;
const IDENTITY_STANDARD_CONDITIONS_ENGLISH = ENGLISH_DEFAULT_CONDITIONS;
const localizePackageOptions = (options, slug, locale) => {
  if (locale !== 'en' || !options || typeof options !== 'object' || Array.isArray(options)) return options;
  if (slug !== 'classic-propre') return options;
  return { ...options, makeupOption: options.makeupOption ? { ...options.makeupOption, label: 'Studio makeup' } : options.makeupOption, additionalInformation: 'Please contact us for more details about this offer.' };
};
const localizeConditions = (value, slug, locale) => {
  if (slug === 'identite-standard') return locale === 'en' ? IDENTITY_STANDARD_CONDITIONS_ENGLISH : IDENTITY_STANDARD_CONDITIONS;
  const hasGenericConditions = String(value || '').startsWith('Conditions confirmées') || String(value || '').startsWith('Besoin de plus d’informations');
  if (hasGenericConditions) return locale === 'en' ? ENGLISH_DEFAULT_CONDITIONS : FRENCH_DEFAULT_CONDITIONS;
  if (locale !== 'en') return value;
  if (slug === 'classic-propre') return ENGLISH_CLASSIC_CONDITIONS;
  if (String(value || '').startsWith('Disponible sur demande')) return ENGLISH_CONTACT_CONDITIONS;
  if (slug === 'happy-hours') return 'Wednesday and Thursday, 10:00 to 14:00 · 15 min · 1 person · 1 backdrop · 1 outfit · 1 retouched HD photo · maximum 6 slots per day · full payment · cannot be combined.';
  return value;
};

export const shootingCategoriesForLocale = (locale = 'fr') => {
  const labels = locale === 'en' ? ENGLISH_PACKAGE_CATEGORY_LABELS : PACKAGE_CATEGORY_LABELS;
  return ['all', 'portrait', 'famille', 'maternite', 'fiancailles', 'event'].map((key) => ({ key, label: labels[key] }));
};
export const formatPrice = (pack, locale = 'fr') => {
  const price = formatFcfa(pack.price);
  const base = pack.isRange ? (locale === 'en' ? `From ${price}` : `À partir de ${price}`) : price;
  const suffix = pack.options && typeof pack.options === 'object' && !Array.isArray(pack.options) ? pack.options.priceSuffix : null;
  const translatedSuffix = locale === 'en' && suffix?.trim() === '/ mois' ? '/ month' : suffix;
  return typeof translatedSuffix === 'string' && translatedSuffix.trim() ? `${base} ${translatedSuffix.trim()}` : base;
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

export const categoryKey = (category = '') => {
  const normalized = category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('maternite') || normalized.includes('bebe')) return 'maternite';
  if (normalized.includes('duo') || normalized.includes('famille') || normalized.includes('groupe') || normalized.includes('enfant') || normalized.includes('anniversaire')) return 'famille';
  if (normalized.includes('fiancailles') || normalized.includes('mariage')) return 'fiancailles';
  if (normalized.includes('event') || normalized.includes('evenement')) return 'event';
  return 'portrait';
};

export const normalizeFrenchPackageName = (name = '') => name.replace(/\bMaternite\b/g, 'Maternité').replace(/\bBebe\b/g, 'Bébé').replace(/\bFiancailles\b/g, 'Fiançailles').replace(/\bPre-mariage\b/g, 'Pré-mariage').replace(/\bDecouverte\b/g, 'Découverte');

export const packageView = (pack, locale = 'fr') => {
  const cat = categoryKey(pack.category);
  const sourceDelivery = pack.deliveryLabel?.trim() || deliveryLabel();
  return {
    ...pack,
    name: locale === 'en' ? ENGLISH_PACKAGE_NAMES[pack.slug] || normalizeFrenchPackageName(pack.name) : normalizeFrenchPackageName(pack.name),
    description: locale === 'en' ? ENGLISH_PACKAGE_DESCRIPTIONS[pack.slug] || pack.description : pack.description,
    cat,
    categoryLabel: (locale === 'en' ? ENGLISH_PACKAGE_CATEGORY_LABELS : PACKAGE_CATEGORY_LABELS)[cat] || pack.category,
    priceLabel: formatPrice(pack, locale),
    durationLabel: formatDuration(pack.durationMin, locale),
    deliveryLabel: locale === 'en' ? ENGLISH_EXPLICIT_DELIVERY[pack.slug] || (sourceDelivery === GENERIC_DELIVERY_CONTACT ? deliveryLabel('en') : sourceDelivery) : sourceDelivery,
    options: localizePackageOptions(pack.options, pack.slug, locale),
    conditions: localizeConditions(pack.conditions, pack.slug, locale),
    deliveryLabelOrigin: deliveryLabelOrigin(sourceDelivery),
    bookingMode: pack.bookingMode || 'DIRECT',
    isDirectBooking: (pack.bookingMode || 'DIRECT') === 'DIRECT' && Number.isFinite(pack.durationMin),
  };
};

export const packageCtaLabel = (pack, locale = 'fr') => {
  const isBookingLabel = pack.isDirectBooking || pack.slug === 'identite-standard';
  if (locale === 'en') return isBookingLabel ? 'Book this package' : 'Contact us';
  return isBookingLabel ? 'Réserver ce pack' : 'Nous contacter';
};

export const selectPackageFromQuery = (packages, queryValue) => {
  if (!packages.length) return null;
  if (!queryValue) return packages[0];
  return packages.find((pack) => pack.id === queryValue || pack.slug === queryValue) || packages.find((pack) => String(pack.sortOrder / 10) === queryValue) || packages[0];
};
