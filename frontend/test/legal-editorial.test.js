import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ACTIVE_PROCESSORS,
  HOSTING_PROVIDER,
  DATA_RETENTION,
  LEGAL_LAST_UPDATED,
  PENDING_LEGAL_PARTICULARS,
  PRIVACY_RIGHTS,
} from '../src/content/legal.js';
import { packageView } from '../src/lib/packages.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (path) => readFileSync(`${root}${path}`, 'utf8');

test('July 2026 legal content covers providers, retention, rights, and pending particulars', () => {
  assert.equal(LEGAL_LAST_UPDATED, '31 juillet 2026');
  assert.ok(DATA_RETENTION.length >= 6);
  assert.ok(DATA_RETENTION.every(({ category, duration, details }) => category && duration && details));

  const processors = new Map(ACTIVE_PROCESSORS.map((item) => [item.name, item.status]));
  assert.match(processors.get('Cal.com'), /Actif/);
  assert.match(processors.get('Zoho Mail (SMTP)'), /Actif/);
  assert.match(processors.get('WhatsApp Business / Meta'), /désactivé/);
  assert.match(processors.get('Cloudflare Turnstile'), /désactivée/);

  assert.ok(PRIVACY_RIGHTS.some((right) => right.includes('portabilité')));
  assert.ok(PRIVACY_RIGHTS.some((right) => right.includes('limitation')));
  assert.ok(PRIVACY_RIGHTS.some((right) => right.includes('autorité compétente')));
  assert.ok(PENDING_LEGAL_PARTICULARS.includes('numéro RCCM et identifiant fiscal (NIU)'));
  assert.ok(!PENDING_LEGAL_PARTICULARS.some((item) => item.includes('hébergeur')));
  assert.equal(HOSTING_PROVIDER.name, 'Hetzner Online GmbH');
  assert.match(HOSTING_PROVIDER.address, /91710 Gunzenhausen/);
  assert.equal(HOSTING_PROVIDER.registry, 'Registre d’Ansbach, HRB 6089');
});

test('privacy and terms mirror the data collected and manual workflow', () => {
  const privacy = [source('src/pages/Privacy.jsx'), source('src/content/legal.js')].join(' ');
  const terms = source('src/pages/Terms.jsx');
  const requiredPrivacyTerms = [
    'date de naissance',
    'genre',
    'canal de découverte',
    'consentement facultatif aux notifications WhatsApp',
    'référence de transaction',
    'RCCM ou NIU',
    'adresse IP',
    'Cal.com',
    'Durées de conservation',
    'Cookies, traceurs et mesure d’audience',
  ];

  for (const term of requiredPrivacyTerms) assert.match(privacy, new RegExp(term));
  assert.match(terms, /contrôle manuel du paiement/);
  assert.match(terms, /ne valide jamais automatiquement/);
  assert.doesNotMatch(`${privacy}\n${terms}`, /Octobre 2023|No-show/);
});

test('approved French copy is public and external WhatsApp icon is local', () => {
  const publicSources = [
    'src/App.jsx',
    'src/pages/About.jsx',
    'src/pages/Contact.jsx',
    'src/pages/Corporate.jsx',
    'src/pages/CreativeServices.jsx',
    'src/pages/Home.jsx',
    'src/pages/Reservation.jsx',
    'src/pages/Services.jsx',
  ].map(source).join('\n');

  for (const stale of [
    'Must Have',
    'Ideal profil pro',
    'Direction editoriale',
    'Seance a deux',
    'Email Support',
    "Heures d'Ouverture",
    'Shooting Photo',
    'Services Design',
    'Impression & Produits',
    'deadlines',
    'Demande de Devis B2B',
    'Contact Référent',
    'Nature du Besoin',
    'Faites glisser horizontalement',
    'upload.wikimedia.org',
  ]) {
    assert.doesNotMatch(publicSources, new RegExp(stale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(publicSources, /Livraison sous/);
  assert.match(publicSources, /Idéal pour un profil professionnel/);
  assert.match(publicSources, /Fermé, sauf rendez-vous VIP préalable/);
});

test('package display normalizes approved accents without mutating source data', () => {
  const original = {
    id: 'p1',
    slug: 'pre-mariage-decouverte',
    name: 'Pre-mariage Decouverte',
    category: 'Fiancailles & Pre-mariage',
    price: 40000,
    durationMin: 480,
    isRange: true,
  };
  const displayed = packageView(original);

  assert.equal(displayed.name, 'Pré-mariage Découverte');
  assert.equal(displayed.categoryLabel, 'Fiançailles & Pré-mariage');
  assert.equal(displayed.priceLabel, 'À partir de 40 000 FCFA');
  assert.equal(displayed.durationLabel, '8h');
  assert.equal(original.name, 'Pre-mariage Decouverte');
});

test('package display prefers the OWNER-approved delivery label and uses the WhatsApp fallback when no approved delay exists', () => {
  const approved = packageView({
    name: 'Formule approuvée',
    category: 'Portraits',
    price: 5000,
    durationMin: 30,
    deliveryLabel: 'Délai approuvé par l’OWNER',
  });
  const legacy = packageView({
    name: 'Formule historique',
    category: 'Portraits',
    price: 5000,
    durationMin: 30,
    deliveryLabel: null,
  });

  assert.equal(approved.deliveryLabel, 'Délai approuvé par l’OWNER');
  assert.equal(legacy.deliveryLabel, 'Délai communiqué lors de l’échange WhatsApp');
});
