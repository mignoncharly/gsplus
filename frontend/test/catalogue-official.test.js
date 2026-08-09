import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { categoryKey, formatDuration, formatPrice, packageView } from '../src/lib/packages.js';
import { cataloguePromotions } from '../src/content/catalogue-promotions.js';

const services = await readFile(new URL('../src/pages/Services.jsx', import.meta.url), 'utf8');
const reservation = await readFile(new URL('../src/pages/Reservation.jsx', import.meta.url), 'utf8');

test('le catalogue distingue réservation directe et prise de contact', () => {
  const contact = packageView({
    name: 'Identité Standard',
    category: 'Portraits & identité',
    price: 3000,
    durationMin: null,
    bookingMode: 'CONTACT',
  });
  assert.equal(contact.isDirectBooking, false);
  assert.equal(contact.durationLabel, 'Organisation sur échange');
  assert.match(services, /pack\.isDirectBooking/);
  assert.match(services, /Nous contacter/);
  assert.match(reservation, /filter\(\(pack\) => pack\.isDirectBooking\)/);
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
