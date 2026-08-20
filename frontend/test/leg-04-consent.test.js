import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (path) => {
  try {
    return readFileSync(`${root}${path}`, 'utf8');
  } catch {
    return '';
  }
};

const schema = source('../backend/prisma/schema.prisma');
const reservations = source('../backend/src/services/reservations.ts');
const consentService = source('../backend/src/services/legal-consents.ts');
const adminRoutes = source('../backend/src/routes/admin.ts');
const reservationPage = source('src/pages/Reservation.jsx');
const reservationConsent = source('src/components/ReservationConsentFields.jsx');
const adminApi = source('src/lib/api.js');
const adminPanel = source('src/components/AdminImageConsentPanel.jsx');

test('LEG-04 conserve un registre publié des versions juridiques', () => {
  assert.match(schema, /model LegalDocumentVersion/);
  for (const field of ['documentType', 'version', 'sourceDocumentHash', 'noticeText', 'purpose', 'scope', 'effectiveAt', 'publishedAt']) {
    assert.match(schema, new RegExp(field));
  }
  assert.match(reservations, /resolvePublishedLegalVersions/);
  assert.match(reservations, /acceptedPrivacy/);
  assert.match(schema, /whatsappMarketingConsent/);
  assert.match(reservations, /whatsappMarketingConsentAt/);
});

test('LEG-04 sépare les choix publics et ne pré-coche aucun consentement facultatif', () => {
  const publicConsentSources = reservationPage + reservationConsent;
  assert.match(reservationPage, /acceptPrivacy: false/);
  assert.match(reservationPage, /acceptedPrivacy: formData\.acceptPrivacy/);
  assert.match(publicConsentSources, /name="consentImage"/);
  assert.match(publicConsentSources, /name="whatsappMarketingConsent"/);
  assert.match(publicConsentSources, /id="booking-legal-acceptance"/);
  assert.match(publicConsentSources, /J’autorise l’utilisation des images de la séance à des fins promotionnelles\./);
  assert.match(publicConsentSources, /J’accepte de recevoir les informations liées à ma réservation sur WhatsApp\./);
  assert.match(publicConsentSources, /J’accepte de recevoir occasionnellement sur WhatsApp les offres, actualités et communications promotionnelles de Golden Studio Plus\./);
  assert.match(publicConsentSources, /Je reconnais avoir pris connaissance de la/);
  assert.match(publicConsentSources, /Conditions générales de vente/);
  assert.doesNotMatch(reservationPage, /consent: true|whatsappConsent: true|whatsappMarketingConsent: true|acceptPrivacy: true/);
});

test('LEG-04 journalise accord, refus et retrait prospectif sans effacer les preuves', () => {
  assert.match(schema, /model ImageConsentEvent/);
  for (const field of ['choice', 'legalVersionId', 'purpose', 'scope', 'evidence', 'source', 'effectiveAt', 'priorEventId']) {
    assert.match(schema, new RegExp(field));
  }
  assert.match(consentService, /GRANTED/);
  assert.match(consentService, /REFUSED/);
  assert.match(consentService, /WITHDRAWN/);
  assert.match(consentService, /Le retrait produit effet pour l’avenir/);
  assert.match(adminRoutes, /\/reservations\/:id\/image-consent-events/);
  assert.match(adminApi, /createAdminImageConsentEvent/);
  assert.match(adminPanel, /Historique du droit à l’image/);
  assert.match(adminPanel, /n’efface pas les preuves antérieures/);
});
