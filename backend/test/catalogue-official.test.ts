import { describe, expect, it } from 'vitest';

import { PackageBookingMode, PackageVersionStatus } from '../src/generated/prisma/client.js';
import {
  MANUAL_CATALOGUE_PROMOTIONS,
  OFFICIAL_CATALOGUE_OFFERS,
  OFFICIAL_CATALOGUE_SOURCE,
  OWNER_CATALOGUE_AMENDMENTS,
  assertOfficialCatalogue,
} from '../src/catalogue/golden-studio-plus-2026-08-04.js';
import { CATALOGUE_BENEFITS, CATALOGUE_TAXONOMY, packageLocalesForOffer, taxonomyKeyForCategory } from '../src/catalogue/catalogue-model.js';
import { assertBookableSlot, packageBookingRules } from '../src/services/booking-slots.js';
import { assertBenefitLocales } from '../src/services/catalogue.js';
import { assertPublishable } from '../src/services/packages.js';
import { addBusinessDays, businessDayOfWeek, businessLocalToInstant } from '../src/utils/business-time.js';

const GENERIC_DELIVERY = 'Pour connaître les modalités et délais de livraison de cette offre, veuillez nous contacter.';

describe('catalogue officiel français du 4 août 2026', () => {
  it('contient 35 offres uniques et vérifie la source DOCX', () => {
    expect(assertOfficialCatalogue()).toBeUndefined();
    expect(OFFICIAL_CATALOGUE_OFFERS).toHaveLength(35);
    expect(new Set(OFFICIAL_CATALOGUE_OFFERS.map((offer) => offer.slug)).size).toBe(35);
    expect(OFFICIAL_CATALOGUE_SOURCE.language).toBe('fr');
    expect(OFFICIAL_CATALOGUE_SOURCE.sha256).toBe('002bd52c30c7e3fcef8aebc71f82111780320ba8c9500c4e55d746164cd54696');
  });

  it('rend Identité Standard et les trois abonnements disponibles uniquement sur contact', () => {
    const contactOffers = OFFICIAL_CATALOGUE_OFFERS.filter((offer) => offer.bookingMode === PackageBookingMode.CONTACT);
    expect(contactOffers.map((offer) => offer.slug)).toEqual([
      'identite-standard',
      'abonnement-createur-starter',
      'abonnement-createur-pro',
      'abonnement-influenceur-vip',
    ]);
    expect(contactOffers.every((offer) => offer.durationMin === null)).toBe(true);
  });

  it('préserve sept délais OWNER précis et utilise le contact générique pour les autres offres', () => {
    const deliveries = Object.fromEntries(OFFICIAL_CATALOGUE_OFFERS.map((offer) => [offer.slug, offer.deliveryLabel]));
    expect(deliveries['classic-propre']).toBe('Livraison sous 48 à 72 heures');
    expect(deliveries['fiancailles-decouverte']).toBe('Livraison sous 10 jours ouvrés après validation de la sélection.');
    expect(deliveries['fiancailles-classic']).toBe('Livraison sous 10 jours ouvrés après validation de la sélection.');
    expect(deliveries['fiancailles-premium']).toBe('Livraison sous 15 jours ouvrés après validation de la sélection.');
    expect(deliveries['pre-mariage-decouverte']).toBe('Livraison sous 15 jours ouvrés après sélection.');
    expect(deliveries['pre-mariage-classic']).toBe('Livraison sous 15 jours ouvrés après sélection.');
    expect(deliveries['pre-mariage-premium']).toBe('Livraison sous 20 jours ouvrés.');
    expect(OFFICIAL_CATALOGUE_OFFERS.filter((offer) => offer.deliveryLabel === GENERIC_DELIVERY)).toHaveLength(28);
  });

  it('reprend toutes les valeurs OWNER explicites de Classic Propre sans dérivation', () => {
    const classic = OFFICIAL_CATALOGUE_OFFERS.find((offer) => offer.slug === 'classic-propre')!;
    expect(classic).toMatchObject({
      price: 18_000,
      currency: 'XAF',
      durationMin: 60,
      content: '1 heure de séance · 2 fonds · 2 tenues · 8 photos HD, dont 4 retouchées.',
      inclusions: ['1 heure de séance', '2 fonds', '2 tenues', '8 photos HD, dont 4 retouchées'],
      conditions: 'La réservation est confirmée après vérification des disponibilités et paiement intégral.',
      deliveryLabel: 'Livraison sous 48 à 72 heures',
      options: {
        makeupOption: { label: 'Maquillage au studio', price: 6_000, currency: 'XAF' },
        additionalInformation: 'Pour plus de détails sur cette offre, veuillez nous contacter.',
      },
    });
    expect(OWNER_CATALOGUE_AMENDMENTS.classicPropre.source).toBe('OWNER_EXPLICIT');
  });

  it('refuse les réservations directes pour une offre contact et les jours hors Happy Hours', async () => {
    const tx = {} as Parameters<typeof assertBookableSlot>[0];
    const startAt = businessLocalToInstant('2030-01-02', '10:00');
    const endAt = businessLocalToInstant('2030-01-02', '10:15');
    const contactPack = { bookingMode: PackageBookingMode.CONTACT, durationMin: null, options: null } as Parameters<typeof assertBookableSlot>[1];
    await expect(assertBookableSlot(tx, contactPack, startAt, endAt, { now: new Date('2029-01-01') }))
      .rejects.toMatchObject({ code: 'PACKAGE_CONTACT_ONLY' });

    let restrictedDate = '2030-01-01';
    while ([3, 4].includes(businessDayOfWeek(restrictedDate))) restrictedDate = addBusinessDays(restrictedDate, 1);
    const restrictedStart = businessLocalToInstant(restrictedDate, '10:00');
    const happyPack = {
      bookingMode: PackageBookingMode.DIRECT,
      durationMin: 15,
      options: { bookingRules: { allowedWeekdays: [3, 4], opensAt: '10:00', closesAt: '14:00' } },
    } as Parameters<typeof assertBookableSlot>[1];
    await expect(assertBookableSlot(tx, happyPack, restrictedStart, new Date(restrictedStart.getTime() + 15 * 60_000), { now: new Date('2029-01-01') }))
      .rejects.toMatchObject({ code: 'PACKAGE_SCHEDULE_RESTRICTED' });
  });

  it('encode les restrictions Happy Hours et garde les deux autres promotions manuelles', () => {
    const happyHours = OFFICIAL_CATALOGUE_OFFERS.find((offer) => offer.slug === 'happy-hours')!;
    expect(packageBookingRules({ options: happyHours.options } as never)).toEqual({
      allowedWeekdays: [3, 4],
      opensAt: '10:00',
      closesAt: '14:00',
      maxReservationsPerDay: 6,
      requiresFullPayment: true,
      combinable: false,
    });
    expect(MANUAL_CATALOGUE_PROMOTIONS.map((promotion) => promotion.applicationMode)).toEqual([
      'MANUAL_CONTACT',
      'MANUAL_CONTACT',
    ]);
  });


  it('définit exactement huit sections stables avec libellés FR et EN et une seule section par offre', () => {
    expect(CATALOGUE_TAXONOMY).toHaveLength(8);
    expect(new Set(CATALOGUE_TAXONOMY.map((item) => item.key)).size).toBe(8);
    expect(CATALOGUE_TAXONOMY.map((item) => item.labels.fr)).toEqual([
      'Portraits & identité', 'Couples, familles & groupes', 'Maternité, bébé & enfant', 'Anniversaires',
      'Fiançailles & pré-mariage', 'Événements', 'Créateurs & entreprises', 'Privilèges Golden — Promotion',
    ]);
    expect(CATALOGUE_TAXONOMY.every((item) => item.labels.fr && item.labels.en)).toBe(true);
    const membership = Object.fromEntries(CATALOGUE_TAXONOMY.map((taxonomy) => [taxonomy.key, OFFICIAL_CATALOGUE_OFFERS.filter((offer) => taxonomyKeyForCategory(offer.category) === taxonomy.key).map((offer) => offer.slug)]));
    expect(membership).toEqual({
      'portraits-identite': ['flash-social', 'identite-standard', 'pack-decouverte', 'classic-propre', 'pack-signature', 'corporate-linkedin'],
      'couples-familles-groupes': ['duo-couple', 'famille', 'groupe-fun', 'pack-fratrie'],
      'maternite-bebe-enfant': ['maternite', 'maternite-douce', 'maternite-elegance', 'bebe-naissance', 'bebe-premiere-magie', 'enfant', 'enfant-star', 'ado-swag'],
      anniversaires: ['anniversaire', 'anniversaire-enfant-star', 'anniversaire-adulte-classic', 'anniversaire-adulte-premium'],
      'fiancailles-pre-mariage': ['fiancailles-decouverte', 'fiancailles-classic', 'fiancailles-premium', 'pre-mariage-decouverte', 'pre-mariage-classic', 'pre-mariage-premium'],
      evenements: ['event-lite', 'event-standard', 'event-premium'],
      'createurs-entreprises': ['abonnement-createur-starter', 'abonnement-createur-pro', 'abonnement-influenceur-vip'],
      'privileges-golden-promotion': ['happy-hours'],
    });
  });

  it('versionne les contenus FR/EN complets et les deux avantages catalogue', () => {
    for (const offer of OFFICIAL_CATALOGUE_OFFERS) {
      const locales = packageLocalesForOffer(offer);
      expect(locales.map((item) => item.locale)).toEqual(['fr', 'en']);
      expect(locales.every((item) => item.name && item.content && item.inclusions.length && item.conditions && item.deliveryLabel && item.mandatoryWording)).toBe(true);
    }
    expect(CATALOGUE_BENEFITS.map((benefit) => benefit.code)).toEqual(['STUDENT', 'REFERRAL']);
    expect(CATALOGUE_BENEFITS.every((benefit) => benefit.locales.fr && benefit.locales.en)).toBe(true);
  });

  it('exige une approbation explicite de chaque langue avant publication des avantages', () => {
    const approvedAt = new Date('2026-08-20T19:37:33.818Z');
    const locales = (['fr', 'en'] as const).map((locale) => ({ locale, name: 'Name', advantage: 'Benefit', conditions: 'Conditions', applicationLabel: 'Application', mandatoryWording: 'Terms', sourceReference: 'TEST', approvedAt: locale === 'fr' ? null : approvedAt, isEnabled: true }));
    expect(() => assertBenefitLocales(locales, true)).toThrowError('CATALOGUE_BENEFIT_LOCALE_UNAPPROVED:fr');
    expect(() => assertBenefitLocales(locales.map((locale) => ({ ...locale, approvedAt })), true)).not.toThrow();
  });

  it('bloque la publication sans taxonomie connue ou avec une langue activée incomplète', () => {
    const base = {
      id: 'version', packageId: 'package', version: 1, name: 'Test', category: 'Tests', taxonomyKey: 'portraits-identite',
      englishEnabled: true, description: 'Description complète', content: 'Contenu complet', inclusions: ['Séance'], conditions: 'Conditions complètes',
      price: 10_000, currency: 'XAF', durationMin: 30, bookingMode: PackageBookingMode.DIRECT, deliveryLabel: 'Livraison',
      options: null, legalText: 'Mentions obligatoires', legalApprovedAt: null, status: PackageVersionStatus.DRAFT,
      effectiveAt: new Date('2026-08-20T00:00:00Z'), validatedAt: null, validatedById: null, publishedAt: null, publishedById: null,
      archivedAt: null, createdById: null, createdAt: new Date(), taxonomy: { isActive: true },
      locales: ['fr', 'en'].map((locale) => ({ locale, name: 'Name', content: 'Content', inclusions: ['Item'], conditions: 'Conditions', deliveryLabel: 'Delivery', mandatoryWording: 'Terms', isEnabled: true })),
    };
    expect(() => assertPublishable(base as never)).not.toThrow();
    expect(() => assertPublishable(base as never, true)).toThrowError(expect.objectContaining({ code: 'PACKAGE_PUBLICATION_FIELDS_REQUIRED' }));
    expect(() => assertPublishable({ ...base, locales: base.locales.map((locale) => ({ ...locale, approvedAt: new Date() })) } as never, true)).not.toThrow();
    expect(() => assertPublishable({ ...base, taxonomy: null } as never)).toThrowError(expect.objectContaining({ code: 'PACKAGE_PUBLICATION_FIELDS_REQUIRED' }));
    expect(() => assertPublishable({ ...base, locales: base.locales.filter((item) => item.locale === 'fr') } as never)).toThrowError(expect.objectContaining({ code: 'PACKAGE_PUBLICATION_FIELDS_REQUIRED' }));
  });

});
