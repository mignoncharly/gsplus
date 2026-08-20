import type { Prisma } from '../generated/prisma/client.js';
import type { OfficialCatalogueOffer } from './golden-studio-plus-2026-08-04.js';

export const CATALOGUE_LOCALES = ['fr', 'en'] as const;
export type CatalogueLocale = typeof CATALOGUE_LOCALES[number];

export const CATALOGUE_TAXONOMY = Object.freeze([
  { key: 'portraits-identite', sortOrder: 10, labels: { fr: 'Portraits & identité', en: 'Portraits & identity' } },
  { key: 'couples-familles-groupes', sortOrder: 20, labels: { fr: 'Couples, familles & groupes', en: 'Couples, families & groups' } },
  { key: 'maternite-bebe-enfant', sortOrder: 30, labels: { fr: 'Maternité, bébé & enfant', en: 'Maternity, baby & children' } },
  { key: 'anniversaires', sortOrder: 40, labels: { fr: 'Anniversaires', en: 'Birthdays' } },
  { key: 'fiancailles-pre-mariage', sortOrder: 50, labels: { fr: 'Fiançailles & pré-mariage', en: 'Engagements & pre-wedding' } },
  { key: 'evenements', sortOrder: 60, labels: { fr: 'Événements', en: 'Events' } },
  { key: 'createurs-entreprises', sortOrder: 70, labels: { fr: 'Créateurs & entreprises', en: 'Creators & businesses' } },
  { key: 'privileges-golden-promotion', sortOrder: 80, labels: { fr: 'Privilèges Golden — Promotion', en: 'Golden privileges — Promotion' } },
] as const);

export type CatalogueTaxonomyKey = typeof CATALOGUE_TAXONOMY[number]['key'];

const CATEGORY_TO_KEY = new Map<string, CatalogueTaxonomyKey>([
  ['Portraits & identité', 'portraits-identite'],
  ['Couples, familles & groupes', 'couples-familles-groupes'],
  ['Maternité, bébé & enfant', 'maternite-bebe-enfant'],
  ['Anniversaires', 'anniversaires'],
  ['Fiançailles & pré-mariage', 'fiancailles-pre-mariage'],
  ['Événements', 'evenements'],
  ['Créateurs & entreprises', 'createurs-entreprises'],
  ['Privilèges Golden', 'privileges-golden-promotion'],
  ['Privilèges Golden — Promotion', 'privileges-golden-promotion'],
  ['Tests', 'portraits-identite'],
  ['Phase 2', 'privileges-golden-promotion'],
]);

export const taxonomyKeyForCategory = (category: string): CatalogueTaxonomyKey => {
  const key = CATEGORY_TO_KEY.get(category);
  if (!key) throw new Error(`UNKNOWN_CATALOGUE_CATEGORY:${category}`);
  return key;
};

export const taxonomyByKey = new Map(CATALOGUE_TAXONOMY.map((item) => [item.key, item]));

const ENGLISH_NAMES: Record<string, string> = {
  'flash-social': 'Social Flash', 'identite-standard': 'Standard ID', 'pack-decouverte': 'Discovery Portrait', 'classic-propre': 'Classic', 'pack-signature': 'Signature', 'corporate-linkedin': 'Corporate LinkedIn', 'duo-couple': 'Duo & Couple', famille: 'Family — up to 5 people', 'groupe-fun': 'Fun Group — 6 to 8 people', 'pack-fratrie': 'Siblings Package — 2 to 4 children', maternite: 'Maternity Discovery', 'maternite-douce': 'Soft Maternity', 'maternite-elegance': 'Maternity Elegance', 'bebe-naissance': 'Baby Discovery', 'bebe-premiere-magie': 'Baby First Magic', enfant: 'Child Discovery', 'enfant-star': 'Child Star', 'ado-swag': 'Teen Swag', anniversaire: 'Child Birthday Discovery', 'anniversaire-enfant-star': 'Child Birthday Star', 'anniversaire-adulte-classic': 'Classic Adult Birthday', 'anniversaire-adulte-premium': 'Premium Adult Birthday', 'fiancailles-decouverte': 'Engagement Discovery', 'fiancailles-classic': 'Classic Engagement', 'fiancailles-premium': 'Premium Engagement', 'pre-mariage-decouverte': 'Pre-wedding Discovery', 'pre-mariage-classic': 'Classic Pre-wedding', 'pre-mariage-premium': 'Premium Pre-wedding', 'event-lite': 'Event Lite', 'event-standard': 'Standard Event', 'event-premium': 'Premium Event', 'abonnement-createur-starter': 'Creator Starter Membership', 'abonnement-createur-pro': 'Creator Pro Membership', 'abonnement-influenceur-vip': 'VIP Influencer Membership', 'happy-hours': 'Happy Hours — Social Flash',
};

const ENGLISH_DESCRIPTIONS: Record<string, string> = {
  'flash-social': '15 min · 1 backdrop · 1 outfit · 1 HD photo.', 'identite-standard': '1 paper print including the ID cards.', 'pack-decouverte': '30 min · 1 backdrop · 1 outfit · 5 HD photos.', 'classic-propre': '1-hour session · 2 backdrops · 2 outfits · 8 HD photos, including 4 retouched.', 'pack-signature': '1 h 30 · 3 backdrops · 3 outfits · 15 HD photos.', 'corporate-linkedin': '45 min · neutral backdrop · pose direction · 6 HD photos.', 'duo-couple': '1 h · 2 backdrops · 10 HD photos · 2 people.', famille: '1 h · 2 backdrops · 12 HD photos · up to 5 people.', 'groupe-fun': '1 h 30 · 15 HD photos · simple accessories.', 'pack-fratrie': '1 h · individual and group portraits · 12 HD photos.', maternite: '30 min · 1 backdrop · 1 outfit · 5 HD photos.', 'maternite-douce': '1 h · 2 backdrops · 2 outfits · 8 HD photos.', 'maternite-elegance': '1 h 30 · 3 backdrops · 3 outfits · 12 HD photos · studio makeup included.', 'bebe-naissance': 'Up to 30 min · simple set design · 5 HD photos.', 'bebe-premiere-magie': 'Up to 40 min · simple set design and accessories · 8 HD photos.', enfant: '30 min · 1 backdrop · 1 outfit · 5 HD photos.', 'enfant-star': '45 min · 2 backdrops · 2 outfits · 8 HD photos.', 'ado-swag': '1 h · 2 backdrops · 2 outfits · 10 HD photos.', anniversaire: '30 min · 1 outfit · 5 HD photos · simple accessories.', 'anniversaire-enfant-star': '45 min · 2 outfits · 8 HD photos · standard set.', 'anniversaire-adulte-classic': '1 h · 2 outfits · 8 HD photos · standard set.', 'anniversaire-adulte-premium': '1 h 30 · 3 outfits · 12 HD photos · premium makeup and set.', 'fiancailles-decouverte': '1 h · delivery within 10 business days after approval of the selection.', 'fiancailles-classic': '1 h 30 · delivery within 10 business days after approval of the selection.', 'fiancailles-premium': '2 h · delivery within 15 business days after approval of the selection.', 'pre-mariage-decouverte': '1 h 30 in studio · delivery within 15 business days after selection.', 'pre-mariage-classic': '2 h in studio · delivery within 15 business days after selection.', 'pre-mariage-premium': '3 h · studio and 1 outdoor location · delivery within 20 business days.', 'event-lite': '2 h · 1 location · 50 selected and edited photos.', 'event-standard': '4 h · 1 location · 100 selected and edited photos.', 'event-premium': '8 h · up to 2 nearby locations · 200 selected and edited photos.', 'abonnement-createur-starter': 'One 30-minute session per month · 3-month commitment.', 'abonnement-createur-pro': 'Two Classic sessions per month · 3-month commitment.', 'abonnement-influenceur-vip': 'Three Classic sessions per month · 6-month commitment.', 'happy-hours': 'Wednesday and Thursday, 10:00 to 14:00 · 15 min · 1 person · 1 backdrop · 1 outfit · 1 retouched HD photo · maximum 6 slots per day · full payment · cannot be combined.',
};

const ENGLISH_DELIVERY: Record<string, string> = {
  'classic-propre': 'Delivery within 48 to 72 hours',
  'fiancailles-decouverte': 'Delivery within 10 business days after approval of the selection.',
  'fiancailles-classic': 'Delivery within 10 business days after approval of the selection.',
  'fiancailles-premium': 'Delivery within 15 business days after approval of the selection.',
  'pre-mariage-decouverte': 'Delivery within 15 business days after selection.',
  'pre-mariage-classic': 'Delivery within 15 business days after selection.',
  'pre-mariage-premium': 'Delivery within 20 business days.',
};

const ENGLISH_DEFAULT_DELIVERY = 'Please contact us for delivery terms and timelines for this offer.';
const ENGLISH_DEFAULT_CONDITIONS = 'Need more information about this package? We are here to help. Contact us!';
const ENGLISH_CONTACT_CONDITIONS = 'Available on request from Golden Studio Plus. Terms are confirmed during your conversation. The applicable published terms and conditions of sale apply.';
const ENGLISH_LEGAL = 'The published terms and conditions accepted when booking apply.';
const sourceReference = 'VERSIONED_MIGRATION:Golden_Studio_Plus_Catalogue:2026-08-04';

const translatedOptions = (offer: OfficialCatalogueOffer): Prisma.InputJsonValue | null => {
  if (!offer.options || typeof offer.options !== 'object' || Array.isArray(offer.options)) return offer.options;
  const options = structuredClone(offer.options) as Record<string, unknown>;
  if (offer.slug === 'classic-propre') {
    options.makeupOption = { ...(options.makeupOption as object), label: 'Studio makeup' };
    options.additionalInformation = 'Please contact us for more details about this offer.';
  }
  if (options.priceSuffix === '/ mois') options.priceSuffix = '/ month';
  return options as Prisma.InputJsonValue;
};

export type VersionLocaleInput = {
  locale: CatalogueLocale;
  name: string;
  description: string;
  content: string;
  inclusions: string[];
  conditions: string;
  deliveryLabel: string;
  mandatoryWording: string;
  options: Prisma.InputJsonValue | null;
  sourceReference: string;
  approvedAt: Date;
  isEnabled: true;
};

export const packageLocalesForOffer = (offer: OfficialCatalogueOffer): VersionLocaleInput[] => {
  const englishDescription = ENGLISH_DESCRIPTIONS[offer.slug];
  const englishName = ENGLISH_NAMES[offer.slug];
  if (!englishDescription || !englishName) throw new Error(`MISSING_ENGLISH_CATALOGUE_LOCALE:${offer.slug}`);
  const englishConditions = offer.slug === 'classic-propre'
    ? 'The booking is confirmed after availability has been verified and full payment has been received.'
    : offer.slug === 'happy-hours'
      ? englishDescription
      : offer.bookingMode === 'CONTACT' ? ENGLISH_CONTACT_CONDITIONS : ENGLISH_DEFAULT_CONDITIONS;
  const approvalDate = new Date('2026-08-20T00:00:00.000Z');
  return [
    { locale: 'fr', name: offer.name, description: offer.description, content: offer.content, inclusions: offer.inclusions, conditions: offer.conditions, deliveryLabel: offer.deliveryLabel, mandatoryWording: offer.legalText, options: offer.options, sourceReference, approvedAt: approvalDate, isEnabled: true },
    { locale: 'en', name: englishName, description: englishDescription, content: englishDescription, inclusions: englishDescription.split(' · ').map((item) => item.trim()).filter(Boolean), conditions: englishConditions, deliveryLabel: ENGLISH_DELIVERY[offer.slug] ?? ENGLISH_DEFAULT_DELIVERY, mandatoryWording: ENGLISH_LEGAL, options: translatedOptions(offer), sourceReference, approvedAt: approvalDate, isEnabled: true },
  ];
};

export const CATALOGUE_BENEFITS = Object.freeze([
  {
    code: 'STUDENT', sortOrder: 10, taxonomyKey: 'privileges-golden-promotion' as const, applicationMode: 'MANUAL_CONTACT',
    locales: {
      fr: { name: 'Avantage étudiant', advantage: '−15 %', conditions: 'Sur Portrait Découverte, Classic Propre, Ado Swag et Corporate LinkedIn · carte étudiante valide · du lundi au vendredi · paiement intégral · non cumulable.', applicationLabel: 'Application après vérification par l’équipe.', mandatoryWording: 'Offre non cumulable, soumise à vérification.' },
      en: { name: 'Student benefit', advantage: '−15%', conditions: 'On Discovery Portrait, Classic, Teen Swag and Corporate LinkedIn · valid student card · Monday to Friday · full payment · cannot be combined.', applicationLabel: 'Applied after verification by the team.', mandatoryWording: 'Cannot be combined; eligibility is subject to verification.' },
    },
  },
  {
    code: 'REFERRAL', sortOrder: 20, taxonomyKey: 'privileges-golden-promotion' as const, applicationMode: 'MANUAL_CONTACT',
    locales: {
      fr: { name: 'Parrainage Golden', advantage: '3 000 / 5 000 FCFA', conditions: '3 000 FCFA pour le filleul · crédit de 5 000 FCFA pour le parrain après paiement et réalisation de la séance du filleul · séance minimale de 18 000 FCFA · validité 30 jours · non cumulable.', applicationLabel: 'Application manuelle après validation des conditions.', mandatoryWording: 'Crédit valable 30 jours et non cumulable.' },
      en: { name: 'Golden referral', advantage: 'FCFA 3,000 / 5,000', conditions: 'FCFA 3,000 for the referred customer · FCFA 5,000 credit for the referrer after the referred session is paid for and completed · minimum session value FCFA 18,000 · valid for 30 days · cannot be combined.', applicationLabel: 'Applied manually after the conditions are verified.', mandatoryWording: 'Credit is valid for 30 days and cannot be combined.' },
    },
  },
]);
