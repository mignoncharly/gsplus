import { PackageBookingMode, type Prisma } from '../generated/prisma/client.js';
import { GENERIC_DELIVERY_CONTACT } from './delivery-labels.js';

export const OFFICIAL_CATALOGUE_SOURCE = Object.freeze({
  file: 'docs/Golden_Studio_Plus_Catalogue.docx',
  sha256: '002bd52c30c7e3fcef8aebc71f82111780320ba8c9500c4e55d746164cd54696',
  version: '4 août 2026',
  language: 'fr',
});

export const OWNER_CATALOGUE_AMENDMENTS = Object.freeze({
  classicPropre: {
    source: 'OWNER_EXPLICIT',
    receivedAt: '2026-08-11',
    fields: [
      'name', 'price', 'durationMin', 'content', 'inclusions', 'conditions',
      'deliveryLabel', 'options.makeupOption', 'options.additionalInformation',
    ],
  },
});

export type OfficialCatalogueOffer = {
  slug: string;
  name: string;
  category: string;
  description: string;
  content: string;
  inclusions: string[];
  conditions: string;
  price: number;
  currency: 'XAF';
  durationMin: number | null;
  bookingMode: PackageBookingMode;
  deliveryLabel: string;
  options: Prisma.InputJsonValue | null;
  legalText: string;
  effectiveAt: Date;
  isPromo: boolean;
  isRange: false;
  sortOrder: number;
};

const DEFAULT_DELIVERY = GENERIC_DELIVERY_CONTACT;
const DEFAULT_CONDITIONS = 'Besoin de plus d’informations sur cette formule ? Nous sommes à votre disposition. Contactez-nous !';
const CONTACT_CONDITIONS = 'Disponible sur demande auprès de Golden Studio Plus. Les modalités sont confirmées lors de l’échange. Conditions générales de vente en vigueur applicables.';
const LEGAL_TEXT = 'Les Conditions générales de vente publiées et acceptées lors de la réservation sont applicables.';
const EFFECTIVE_AT = new Date('2026-08-11T00:00:00.000Z');

const inclusionsFrom = (description: string) => description
  .split(' · ')
  .map((item) => item.trim())
  .filter((item) => item.length > 0 && !/^livraison\b/i.test(item));

const offer = (
  slug: string,
  name: string,
  category: string,
  price: number,
  durationMin: number | null,
  description: string,
  sortOrder: number,
  overrides: Partial<OfficialCatalogueOffer> = {},
): OfficialCatalogueOffer => ({
  slug,
  name,
  category,
  description,
  content: description,
  inclusions: inclusionsFrom(description),
  conditions: DEFAULT_CONDITIONS,
  price,
  currency: 'XAF',
  durationMin,
  bookingMode: PackageBookingMode.DIRECT,
  deliveryLabel: DEFAULT_DELIVERY,
  options: null,
  legalText: LEGAL_TEXT,
  effectiveAt: EFFECTIVE_AT,
  isPromo: false,
  isRange: false,
  sortOrder,
  ...overrides,
});

const contactOffer = (
  slug: string,
  name: string,
  category: string,
  price: number,
  description: string,
  sortOrder: number,
  options: Prisma.InputJsonValue | null = null,
) => offer(slug, name, category, price, null, description, sortOrder, {
  bookingMode: PackageBookingMode.CONTACT,
  conditions: CONTACT_CONDITIONS,
  options,
});

export const OFFICIAL_CATALOGUE_OFFERS: OfficialCatalogueOffer[] = [
  offer('flash-social', 'Flash Social', 'Portraits & identité', 5_000, 15, '15 min · 1 fond · 1 tenue · 1 photo HD.', 10),
  contactOffer('identite-standard', 'Identité Standard', 'Portraits & identité', 3_000, '1 tirage papier comprenant les cartes.', 20),
  offer('pack-decouverte', 'Portrait Découverte', 'Portraits & identité', 10_000, 30, '30 min · 1 fond · 1 tenue · 5 photos HD.', 30),
  offer('classic-propre', 'Classic Propre', 'Portraits & identité', 18_000, 60, '1 heure de séance · 2 fonds · 2 tenues · 8 photos HD, dont 4 retouchées.', 40, {
    content: '1 heure de séance · 2 fonds · 2 tenues · 8 photos HD, dont 4 retouchées.',
    inclusions: ['1 heure de séance', '2 fonds', '2 tenues', '8 photos HD, dont 4 retouchées'],
    conditions: 'La réservation est confirmée après vérification des disponibilités et paiement intégral.',
    deliveryLabel: 'Livraison sous 48 à 72 heures',
    options: {
      makeupOption: {
        label: 'Maquillage au studio',
        price: 6_000,
        currency: 'XAF',
      },
      additionalInformation: 'Pour plus de détails sur cette offre, veuillez nous contacter.',
    },
  }),
  offer('pack-signature', 'Signature', 'Portraits & identité', 32_000, 90, '1 h 30 · 3 fonds · 3 tenues · 15 photos HD.', 50),
  offer('corporate-linkedin', 'Corporate LinkedIn', 'Portraits & identité', 25_000, 45, '45 min · fond neutre · direction de pose · 6 photos HD.', 60),

  offer('duo-couple', 'Duo & Couple', 'Couples, familles & groupes', 22_000, 60, '1 h · 2 fonds · 10 photos HD · 2 personnes.', 70),
  offer('famille', 'Famille — jusqu’à 5 personnes', 'Couples, familles & groupes', 28_000, 60, '1 h · 2 fonds · 12 photos HD · jusqu’à 5 personnes.', 80),
  offer('groupe-fun', 'Groupe Fun — 6 à 8 personnes', 'Couples, familles & groupes', 35_000, 90, '1 h 30 · 15 photos HD · accessoires simples.', 90),
  offer('pack-fratrie', 'Pack Fratrie — 2 à 4 enfants', 'Couples, familles & groupes', 28_000, 60, '1 h · portraits individuels et de groupe · 12 photos HD.', 100),

  offer('maternite', 'Maternité Découverte', 'Maternité, bébé & enfant', 10_000, 30, '30 min · 1 fond · 1 tenue · 5 photos HD.', 110),
  offer('maternite-douce', 'Maternité Douce', 'Maternité, bébé & enfant', 18_000, 60, '1 h · 2 fonds · 2 tenues · 8 photos HD.', 120),
  offer('maternite-elegance', 'Maternité Élégance', 'Maternité, bébé & enfant', 35_000, 90, '1 h 30 · 3 fonds · 3 tenues · 12 photos HD · maquillage studio inclus.', 130),
  offer('bebe-naissance', 'Bébé Découverte', 'Maternité, bébé & enfant', 12_000, 30, '30 min maximum · mise en scène simple · 5 photos HD.', 140),
  offer('bebe-premiere-magie', 'Bébé Première Magie', 'Maternité, bébé & enfant', 16_000, 40, '40 min maximum · mise en scène et accessoires simples · 8 photos HD.', 150),
  offer('enfant', 'Enfant Découverte', 'Maternité, bébé & enfant', 8_000, 30, '30 min · 1 fond · 1 tenue · 5 photos HD.', 160),
  offer('enfant-star', 'Enfant Star', 'Maternité, bébé & enfant', 12_000, 45, '45 min · 2 fonds · 2 tenues · 8 photos HD.', 170),
  offer('ado-swag', 'Ado Swag', 'Maternité, bébé & enfant', 18_000, 60, '1 h · 2 fonds · 2 tenues · 10 photos HD.', 180),

  offer('anniversaire', 'Anniversaire Enfant Découverte', 'Anniversaires', 8_000, 30, '30 min · 1 tenue · 5 photos HD · accessoires simples.', 190),
  offer('anniversaire-enfant-star', 'Anniversaire Enfant Star', 'Anniversaires', 12_000, 45, '45 min · 2 tenues · 8 photos HD · décor standard.', 200),
  offer('anniversaire-adulte-classic', 'Anniversaire Adulte Classic', 'Anniversaires', 15_000, 60, '1 h · 2 tenues · 8 photos HD · décor standard.', 210),
  offer('anniversaire-adulte-premium', 'Anniversaire Adulte Premium', 'Anniversaires', 32_000, 90, '1 h 30 · 3 tenues · 12 photos HD · maquillage et décor premium.', 220),

  offer('fiancailles-decouverte', 'Fiançailles Découverte', 'Fiançailles & pré-mariage', 25_000, 60, '1 h · livraison sous 10 jours ouvrés après validation de la sélection.', 230, { deliveryLabel: 'Livraison sous 10 jours ouvrés après validation de la sélection.' }),
  offer('fiancailles-classic', 'Fiançailles Classic', 'Fiançailles & pré-mariage', 35_000, 90, '1 h 30 · livraison sous 10 jours ouvrés après validation de la sélection.', 240, { deliveryLabel: 'Livraison sous 10 jours ouvrés après validation de la sélection.' }),
  offer('fiancailles-premium', 'Fiançailles Premium', 'Fiançailles & pré-mariage', 50_000, 120, '2 h · livraison sous 15 jours ouvrés après validation de la sélection.', 250, { deliveryLabel: 'Livraison sous 15 jours ouvrés après validation de la sélection.' }),
  offer('pre-mariage-decouverte', 'Pré-mariage Découverte', 'Fiançailles & pré-mariage', 40_000, 90, '1 h 30 en studio · livraison sous 15 jours ouvrés après sélection.', 260, { deliveryLabel: 'Livraison sous 15 jours ouvrés après sélection.' }),
  offer('pre-mariage-classic', 'Pré-mariage Classic', 'Fiançailles & pré-mariage', 60_000, 120, '2 h en studio · livraison sous 15 jours ouvrés après sélection.', 270, { deliveryLabel: 'Livraison sous 15 jours ouvrés après sélection.' }),
  offer('pre-mariage-premium', 'Pré-mariage Premium', 'Fiançailles & pré-mariage', 100_000, 180, '3 h · studio et 1 lieu extérieur · livraison sous 20 jours ouvrés.', 280, { deliveryLabel: 'Livraison sous 20 jours ouvrés.' }),

  offer('event-lite', 'Événement Lite', 'Événements', 80_000, 120, '2 h · 1 lieu · 50 photos sélectionnées et traitées.', 290),
  offer('event-standard', 'Événement Standard', 'Événements', 140_000, 240, '4 h · 1 lieu · 100 photos sélectionnées et traitées.', 300),
  offer('event-premium', 'Événement Premium', 'Événements', 220_000, 480, '8 h · maximum 2 lieux proches · 200 photos sélectionnées et traitées.', 310),

  contactOffer('abonnement-createur-starter', 'Abonnement Créateur Starter', 'Créateurs & entreprises', 15_000, '1 séance de 30 min par mois · engagement 3 mois.', 320, { priceSuffix: '/ mois', subscription: { commitmentMonths: 3, sessionsPerMonth: 1 } }),
  contactOffer('abonnement-createur-pro', 'Abonnement Créateur Pro', 'Créateurs & entreprises', 35_000, '2 séances Classic par mois · engagement 3 mois.', 330, { priceSuffix: '/ mois', subscription: { commitmentMonths: 3, sessionsPerMonth: 2 } }),
  contactOffer('abonnement-influenceur-vip', 'Abonnement Influenceur VIP', 'Créateurs & entreprises', 50_000, '3 séances Classic Propre par mois · engagement 6 mois.', 340, { priceSuffix: '/ mois', subscription: { commitmentMonths: 6, sessionsPerMonth: 3 } }),

  offer('happy-hours', 'Happy Hours — Flash Social', 'Privilèges Golden', 4_000, 15, 'Mercredi et jeudi, de 10 h à 14 h · 15 min · 1 personne · 1 fond · 1 tenue · 1 photo HD retouchée · maximum 6 créneaux par jour · paiement intégral · non cumulable.', 350, {
    conditions: 'Mercredi et jeudi, de 10 h à 14 h · 15 min · 1 personne · 1 fond · 1 tenue · 1 photo HD retouchée · maximum 6 créneaux par jour · paiement intégral · non cumulable.',
    isPromo: true,
    options: {
      bookingRules: {
        kind: 'HAPPY_HOURS',
        allowedWeekdays: [3, 4],
        opensAt: '10:00',
        closesAt: '14:00',
        maxReservationsPerDay: 6,
        requiresFullPayment: true,
        combinable: false,
      },
    },
  }),
];

export const MANUAL_CATALOGUE_PROMOTIONS = Object.freeze([
  {
    code: 'STUDENT',
    name: 'Avantage étudiant',
    advantage: '−15 %',
    conditions: 'Sur Portrait Découverte, Classic Propre, Ado Swag et Corporate LinkedIn · carte étudiante valide · du lundi au vendredi · paiement intégral · non cumulable.',
    applicationMode: 'MANUAL_CONTACT',
  },
  {
    code: 'REFERRAL',
    name: 'Parrainage Golden',
    advantage: '3 000 / 5 000 FCFA',
    conditions: '3 000 FCFA pour le filleul · crédit de 5 000 FCFA pour le parrain après paiement et réalisation de la séance du filleul · séance minimale de 18 000 FCFA · validité 30 jours · non cumulable.',
    applicationMode: 'MANUAL_CONTACT',
  },
]);

export const assertOfficialCatalogue = () => {
  if (OFFICIAL_CATALOGUE_OFFERS.length !== 35) throw new Error('OFFICIAL_CATALOGUE_EXPECTED_35_OFFERS');
  const slugs = new Set(OFFICIAL_CATALOGUE_OFFERS.map((item) => item.slug));
  if (slugs.size !== OFFICIAL_CATALOGUE_OFFERS.length) throw new Error('OFFICIAL_CATALOGUE_DUPLICATE_SLUG');
  const contactOffers = OFFICIAL_CATALOGUE_OFFERS.filter((item) => item.bookingMode === PackageBookingMode.CONTACT);
  if (contactOffers.length !== 4 || contactOffers.some((item) => item.durationMin !== null)) {
    throw new Error('OFFICIAL_CATALOGUE_CONTACT_MODE_INVALID');
  }
};
