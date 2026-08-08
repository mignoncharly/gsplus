import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWhatsAppCustomerLink } from '../src/lib/admin-workflow.js';

const reservation = (whatsappConsent) => ({
  reference: 'GSPWA1234',
  package: { name: 'Portrait WhatsApp' },
  snapshot: {
    firstName: 'Aline',
    notificationPhoneE164: '+237 699 33 33 33',
    whatsappConsent,
    whatsappConsentAt: whatsappConsent ? '2026-08-01T16:00:00.000Z' : null,
  },
});

test('P1-01 builds a consent-aware prefilled customer WhatsApp action', () => {
  const link = buildWhatsAppCustomerLink(reservation(true));
  assert.ok(link);
  const url = new URL(link);
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/237699333333');
  assert.equal(
    url.searchParams.get('text'),
    'Bonjour Aline, nous vous contactons au sujet de votre réservation GSPWA1234 (Portrait WhatsApp) chez Golden Studio Plus.',
  );
});

test('P1-01 never exposes a customer WhatsApp action without immutable consent and snapshot', () => {
  assert.equal(buildWhatsAppCustomerLink(reservation(false)), null);
  assert.equal(buildWhatsAppCustomerLink({ ...reservation(true), snapshot: null }), null);
});
