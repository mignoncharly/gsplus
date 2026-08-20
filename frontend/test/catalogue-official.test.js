import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { categoryKey, formatDuration, formatPrice, packageCtaLabel, packageView } from '../src/lib/packages.js';
import { cataloguePromotions } from '../src/content/catalogue-promotions.js';

const services = await readFile(new URL('../src/pages/Services.jsx', import.meta.url), 'utf8');
const reservation = await readFile(new URL('../src/pages/Reservation.jsx', import.meta.url), 'utf8');

test('le catalogue distingue réservation directe et prise de contact', () => {
  const contact = packageView({
    name: 'Identité Standard',
    slug: 'identite-standard',
    category: 'Portraits & identité',
    price: 3000,
    durationMin: null,
    bookingMode: 'CONTACT',
    conditions: 'Disponible sur demande auprès de Golden Studio Plus. Les modalités sont confirmées lors de l’échange. Conditions générales de vente en vigueur applicables.',
  });
  assert.equal(contact.isDirectBooking, false);
  const contactEnglish = packageView({ ...contact, name: 'Identité Standard' }, 'en');
  assert.equal(contact.durationLabel, 'Organisation sur échange');
  assert.match(services, /pack\.isDirectBooking/);
  assert.equal(contact.conditions, 'Besoin de plus d’informations sur cette formule ? Nous sommes à votre disposition. Contactez-nous !');
  assert.equal(contactEnglish.conditions, 'Need more information about this package? We are here to help. Contact us!');
  assert.equal(packageCtaLabel(contact, 'fr'), 'Réserver ce pack');
  assert.equal(packageCtaLabel(contact, 'en'), 'Book this package');
  assert.equal(packageCtaLabel({ slug: 'abonnement-createur-pro', isDirectBooking: false }, 'fr'), 'Nous contacter');
  assert.equal(packageCtaLabel({ slug: 'abonnement-createur-pro', isDirectBooking: false }, 'en'), 'Contact us');
  assert.match(services, /packageCtaLabel\(pack, locale\)/);
  assert.match(reservation, /filter\(\(pack\) => pack\.isDirectBooking\)/);
  assert.doesNotMatch(services, /t\('Conditions :', 'Terms:'\)/);
  assert.match(services, /MessageCircle/);
});

test('les abonnements affichent leur prix mensuel et les nouvelles catégories restent filtrables', () => {
  assert.equal(formatPrice({ price: 15000, options: { priceSuffix: '/ mois' } }), `${(15000).toLocaleString('fr-CM')} FCFA / mois`);
  assert.equal(formatDuration(null), 'Organisation sur échange');
  assert.equal(categoryKey('Maternité, bébé & enfant'), 'maternite');
  assert.equal(categoryKey('Anniversaires'), 'famille');
});

test('les promotions étudiant et parrainage sont annoncées comme manuelles', () => {
  assert.equal(cataloguePromotions.length, 2);
  for (const promotion of cataloguePromotions) {
    assert.match(promotion.applicationLabel, /équipe/);
    assert.match(promotion.conditions, /non cumulable/);
  }
});
