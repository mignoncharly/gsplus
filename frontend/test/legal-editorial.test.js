import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { LEGAL_LAST_UPDATED } from '../src/content/legal.js';
import { GENERIC_DELIVERY_CONTACT, packageView } from '../src/lib/packages.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (path) => readFileSync(`${root}${path}`, 'utf8');

test('les pages juridiques chargent exclusivement les trois nouvelles sources OWNER', () => {
  assert.equal(LEGAL_LAST_UPDATED, '11 août 2026');
  const loader = source('src/content/owner-legal-documents.js');
  for (const file of ['cgv.txt?raw', 'mentions legales.txt?raw', 'politique de confidentialite.txt?raw']) {
    assert.ok(loader.includes(file));
  }
  const pages = ['Legal.jsx', 'Terms.jsx', 'Privacy.jsx'].map((name) => source(`src/pages/${name}`)).join('\n');
  assert.match(pages, /OWNER_LEGAL_DOCUMENTS\.legalNotice/);
  assert.match(pages, /OWNER_LEGAL_DOCUMENTS\.terms/);
  assert.match(pages, /OWNER_LEGAL_DOCUMENTS\.privacy/);
});

test('le parcours de réservation expose les trois documents et sépare les consentements', () => {
  const consent = source('src/components/ReservationConsentFields.jsx');
  assert.match(consent, /to="\/mentions-legales"/);
  assert.match(consent, /to="\/cgv"/);
  assert.match(consent, /to="\/confidentialite"/);
  assert.match(consent, /booking-image-consent/);
  assert.match(consent, /booking-whatsapp-consent/);
  assert.match(consent, /booking-whatsapp-marketing-consent/);
  assert.match(consent, /booking-legal-acceptance/);
  assert.doesNotMatch(consent, /defaultChecked/);
});

test('package display normalizes approved accents without mutating source data', () => {
  const original = {
    id: 'p1', slug: 'legacy', name: 'Pre-mariage Decouverte', category: 'Fiancailles & Pre-mariage', taxonomyKey: 'fiancailles-pre-mariage',
    taxonomy: { key: 'fiancailles-pre-mariage', locales: [{ locale: 'fr', label: 'Fiançailles & pré-mariage' }] },
    locales: [{ locale: 'fr', isEnabled: true, name: 'Pré-mariage Découverte', description: null, content: 'Contenu approuvé', inclusions: ['Séance'], conditions: 'Conditions approuvées', deliveryLabel: 'Sur échange', mandatoryWording: 'CGV applicables' }],
    price: 40000, durationMin: 480, isRange: true,
  };
  const displayed = packageView(original);
  assert.equal(displayed.name, 'Pré-mariage Découverte');
  assert.equal(displayed.categoryLabel, 'Fiançailles & pré-mariage');
  assert.equal(displayed.priceLabel, 'À partir de 40 000 FCFA');
  assert.equal(displayed.durationLabel, '8h');
  assert.equal(original.name, 'Pre-mariage Decouverte');
});

test('package display préserve le délai OWNER et classe l’absence comme fallback générique', () => {
  const approved = packageView({ name: 'Formule approuvée', category: 'Portraits', price: 5000, durationMin: 30, deliveryLabel: 'Livraison sous 48 à 72 heures' });
  const missing = packageView({ name: 'Formule historique', category: 'Portraits', price: 5000, durationMin: 30, deliveryLabel: null });
  assert.equal(approved.deliveryLabel, 'Livraison sous 48 à 72 heures');
  assert.equal(approved.deliveryLabelOrigin, 'OWNER_EXPLICIT');
  assert.equal(missing.deliveryLabel, GENERIC_DELIVERY_CONTACT);
  assert.equal(missing.deliveryLabelOrigin, 'GENERIC_FALLBACK');
});
