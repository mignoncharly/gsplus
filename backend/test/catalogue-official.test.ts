import { describe, expect, it } from 'vitest';

import { PackageBookingMode } from '../src/generated/prisma/client.js';
import {
  MANUAL_CATALOGUE_PROMOTIONS,
  OFFICIAL_CATALOGUE_OFFERS,
  OFFICIAL_CATALOGUE_SOURCE,
  assertOfficialCatalogue,
} from '../src/catalogue/golden-studio-plus-2026-08-04.js';
import { assertBookableSlot, packageBookingRules } from '../src/services/booking-slots.js';
import { addBusinessDays, businessDayOfWeek, businessLocalToInstant } from '../src/utils/business-time.js';

const DEFAULT_DELIVERY = 'Délai communiqué lors de l’échange WhatsApp.';

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

  it('reprend exactement les six délais photo du DOCX et le fallback WhatsApp ailleurs', () => {
    const deliveries = Object.fromEntries(OFFICIAL_CATALOGUE_OFFERS.map((offer) => [offer.slug, offer.deliveryLabel]));
    expect(deliveries['fiancailles-decouverte']).toBe('Livraison sous 10 jours ouvrés après validation de la sélection.');
    expect(deliveries['fiancailles-classic']).toBe('Livraison sous 10 jours ouvrés après validation de la sélection.');
    expect(deliveries['fiancailles-premium']).toBe('Livraison sous 15 jours ouvrés après validation de la sélection.');
    expect(deliveries['pre-mariage-decouverte']).toBe('Livraison sous 15 jours ouvrés après sélection.');
    expect(deliveries['pre-mariage-classic']).toBe('Livraison sous 15 jours ouvrés après sélection.');
    expect(deliveries['pre-mariage-premium']).toBe('Livraison sous 20 jours ouvrés.');
    expect(OFFICIAL_CATALOGUE_OFFERS.filter((offer) => offer.deliveryLabel === DEFAULT_DELIVERY)).toHaveLength(29);
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
});
