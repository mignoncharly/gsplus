import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { CONTENT_FALLBACK, SETTINGS_FALLBACK, mergeContent, mergeSettings, telLink, whatsappLink } from '../src/lib/site-settings.js';

const repoRoot = new URL('../../', import.meta.url);
const registry = readFileSync(new URL('backend/src/services/studio-settings.ts', repoRoot), 'utf8');

test('ADM-09 the compiled fallback matches what was hard-coded before the phase', () => {
  // If these drift, an API outage would render a different phone number than the site
  // shipped with, which is worse than not being editable at all.
  assert.equal(SETTINGS_FALLBACK.identity.phoneE164, '+237673026654');
  assert.equal(SETTINGS_FALLBACK.identity.phoneDisplay, '+237 673 026 654');
  assert.equal(CONTENT_FALLBACK['contact.hours'].weekdaysValue, '9 h - 18 h');

  // And the server's own defaults must agree with the client's fallback.
  assert.match(registry, /key: 'phoneE164'[^}]*default: '\+237673026654'/);
  assert.match(registry, /key: 'phoneDisplay'[^}]*default: '\+237 673 026 654'/);
});

test('ADM-09 a partial or failed response still yields a complete settings object', () => {
  // Nothing at all: every field falls back.
  assert.equal(mergeSettings(undefined).identity.phoneE164, '+237673026654');
  assert.equal(mergeSettings(null).identity.publicName, 'Golden Studio Plus');

  // A response carrying one group leaves the others intact, and an edited field
  // overrides only itself.
  const merged = mergeSettings({ identity: { phoneDisplay: '+237 690 000 000' } });
  assert.equal(merged.identity.phoneDisplay, '+237 690 000 000');
  assert.equal(merged.identity.phoneE164, '+237673026654');
  assert.equal(merged.features.contactFormEnabled, true);

  assert.equal(mergeContent(undefined)['contact.hours'].sundayLabel, 'Dimanche :');
});

test('ADM-09 link builders never produce a broken href', () => {
  assert.equal(whatsappLink('+237 673 026 654'), 'https://wa.me/237673026654');
  assert.equal(whatsappLink('+237673026654', 'Bonjour'), 'https://wa.me/237673026654?text=Bonjour');
  assert.equal(telLink('+237673026654'), 'tel:+237673026654');
  // An emptied number yields null so the caller can decide, rather than "tel:" or "wa.me/".
  assert.equal(whatsappLink(''), null);
  assert.equal(whatsappLink(undefined), null);
  assert.equal(telLink('  '), null);
});

test('ADM-09 no public call site keeps a hard-coded phone number', () => {
  for (const file of [
    'frontend/src/components/Footer.jsx',
    'frontend/src/components/WhatsAppFab.jsx',
    'frontend/src/pages/Contact.jsx',
    'frontend/src/pages/Reservation.jsx',
  ]) {
    const source = readFileSync(new URL(file, repoRoot), 'utf8');
    assert.doesNotMatch(source, /673026654/, `${file} must read the number from settings`);
  }
});
