import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('Phase 1 uses one semantic transactional WhatsApp consent across all four lead forms', () => {
  const component = read('../src/components/TransactionalWhatsAppConsent.jsx');
  assert.match(component, /name="whatsappConsent"/);
  assert.match(component, /aria-describedby=/);
  assert.match(component, /htmlFor=/);
  for (const page of ['Services.jsx', 'Corporate.jsx', 'Contact.jsx', 'CreativeServices.jsx']) {
    const source = read(`../src/pages/${page}`);
    assert.match(source, /TransactionalWhatsAppConsent/);
    assert.doesNotMatch(source, /<input name="whatsappConsent"/);
  }
});

test('Phase 1 consent tokens guarantee readable text, visible focus and a 44px target', () => {
  const css = read('../src/index.css');
  assert.match(css, /--c-consent-text-on-dark:\s*#F7FAF9/i);
  assert.match(css, /transactional-whatsapp-consent__label[\s\S]*min-height:\s*44px/);
  assert.match(css, /:has\(input:focus-visible\)/);
  assert.match(css, /outline:\s*3px solid var\(--c-consent-focus-on-dark\)/);
});

test('Phase 1 adverse admin decisions require a fresh server-rendered preview', () => {
  const dialog = read('../src/components/AdminActionDialog.jsx');
  const api = read('../src/lib/api.js');
  const dashboard = read('../src/pages/AdminDashboard.jsx');
  assert.match(api, /\/api\/admin\/communication-preview/);
  assert.match(dialog, /previewFingerprint !== JSON\.stringify\(values\)/);
  assert.match(dialog, /Seul cet aperçu quitte l’administration/);
  assert.match(dashboard, /internalReason/);
  assert.match(dashboard, /customerReasonCode/);
  assert.doesNotMatch(dashboard, /label: 'Motif', type: 'textarea', required: true/);
});
