import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { catalogueBenefitView, formatDuration, formatPrice, packageCtaLabel, packageView, shootingCategoriesForLocale } from '../src/lib/packages.js';

const services = await readFile(new URL('../src/pages/Services.jsx', import.meta.url), 'utf8');
const packagesSource = await readFile(new URL('../src/lib/packages.js', import.meta.url), 'utf8');
const home = await readFile(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
const reservation = await readFile(new URL('../src/pages/Reservation.jsx', import.meta.url), 'utf8');

const taxonomy = { key: 'portraits-identite', sortOrder: 10, locales: [{ locale: 'fr', label: 'Portraits & identité' }, { locale: 'en', label: 'Portraits & identity' }] };
const locales = [
  { locale: 'fr', isEnabled: true, name: 'Identité Standard', description: 'Tirage papier.', content: 'Tirage papier.', inclusions: ['Tirage papier'], conditions: 'Disponible sur demande.', deliveryLabel: 'Sur échange.', mandatoryWording: 'CGV applicables.', options: null },
  { locale: 'en', isEnabled: true, name: 'Standard ID', description: 'Paper print.', content: 'Paper print.', inclusions: ['Paper print'], conditions: 'Available on request.', deliveryLabel: 'Arranged on request.', mandatoryWording: 'Terms apply.', options: null },
];

test('Identité Standard reste une offre contact et ne peut jamais ouvrir une réservation directe', () => {
  const contact = packageView({ name: 'Identité Standard', slug: 'identite-standard', category: 'Portraits & identité', taxonomyKey: taxonomy.key, taxonomy, locales, price: 3000, durationMin: null, bookingMode: 'CONTACT' });
  const contactEnglish = packageView({ ...contact, locales }, 'en');
  assert.equal(contact.isDirectBooking, false);
  assert.equal(contactEnglish.name, 'Standard ID');
  assert.equal(contactEnglish.conditions, 'Available on request.');
  assert.equal(packageCtaLabel(contact, 'fr'), 'Nous contacter');
  assert.equal(packageCtaLabel(contact, 'en'), 'Contact us');
  assert.match(services, /pack\.isDirectBooking/);
  assert.match(reservation, /filter\(\(pack\) => pack\.isDirectBooking\)/);
});

test('le filtrage utilise exclusivement les huit clés de taxonomie versionnées', () => {
  const rows = Array.from({ length: 8 }, (_, index) => ({ key: 'section-' + (index + 1), sortOrder: (index + 1) * 10, locales: { fr: 'Section ' + (index + 1), en: 'Section ' + (index + 1) } }));
  const filters = shootingCategoriesForLocale(rows, 'en');
  assert.equal(filters.length, 9);
  assert.deepEqual(filters.slice(1).map((item) => item.key), rows.map((item) => item.key));
  assert.equal(formatPrice({ price: 15000, options: { priceSuffix: '/ month' } }, 'en'), (15000).toLocaleString('fr-CM') + ' FCFA / month');
  assert.equal(formatDuration(null), 'Organisation sur échange');
});

test('les avantages sont localisés depuis leur version API', () => {
  const benefit = catalogueBenefitView({ code: 'STUDENT', taxonomy, locales: [{ locale: 'fr', isEnabled: true, name: 'Avantage étudiant', advantage: '−15 %', conditions: 'Non cumulable.', applicationLabel: 'Vérification équipe.' }, { locale: 'en', isEnabled: true, name: 'Student benefit', advantage: '−15%', conditions: 'Cannot be combined.', applicationLabel: 'Team verification.' }] }, 'en');
  assert.equal(benefit.name, 'Student benefit');
  assert.equal(benefit.categoryLabel, 'Portraits & identity');
  assert.match(services, /benefits\.map/);
  assert.doesNotMatch(services, /cataloguePromotionsForLocale/);
});

test('aucune copie commerciale ou exception CTA liée à un slug ne subsiste dans le frontend', () => {
  for (const source of [packagesSource, services, home]) {
    assert.doesNotMatch(source, /ENGLISH_PACKAGE_NAMES|ENGLISH_PACKAGE_DESCRIPTIONS|identite-standard|classic-propre|happy-hours/);
  }
});
