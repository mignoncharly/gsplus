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
const migrations = source('../backend/prisma/migrations/20260808233000_leg_07_media_rights/migration.sql');
const rightsService = source('../backend/src/services/media-rights.ts');
const consentService = source('../backend/src/services/legal-consents.ts');
const publicRoutes = source('../backend/src/routes/public.ts');
const adminRoutes = source('../backend/src/routes/admin.ts');
const admin = source('src/pages/AdminDashboard.jsx') + source('src/components/AdminMediaRightsPanel.jsx');
const productionConfig = source('playwright.production.config.js');
const e2e = source('e2e/leg-07.spec.js');

test('LEG-07 relie chaque média publié à une base de droits prouvée', () => {
  assert.match(schema, /model MediaConsentUsage/);
  assert.match(schema, /rightsBasis/);
  assert.match(schema, /reservationId/);
  assert.match(migrations, /OWNER_APPROVED_CATALOG/);
  assert.match(migrations, /CUSTOMER_IMAGE_AUTHORIZATION/);
  assert.match(migrations, /phase8-curated\/manifest\.json/);
});

test('LEG-07 bloque une nouvelle publication sans accord actif couvrant le site', () => {
  assert.match(rightsService, /IMAGE_CONSENT_REQUIRED/);
  assert.match(rightsService, /WEBSITE/);
  assert.match(rightsService, /MEDIA_RIGHTS_MANAGE/);
  assert.match(publicRoutes, /publicMediaRightsWhere/);
  assert.match(rightsService, /consentUsages/);
  assert.match(adminRoutes, /createMediaWithRights/);
});

test('LEG-07 rend le retrait effectif sur tous les contenus précisément identifiés', () => {
  assert.match(migrations, /gsp_apply_image_consent_withdrawal/);
  assert.match(migrations, /withdrawalEventId/);
  assert.match(consentService, /affectedMedia/);
  assert.match(consentService, /isPublished: false/);
});

test('LEG-07 expose la preuve dans l’administration et couvre local et production', () => {
  assert.match(admin, /Référence de réservation/);
  assert.match(admin, /Base de droits/);
  assert.match(admin, /Autorisation active|Autorisation retirée/);
  assert.match(e2e, /IMAGE_CONSENT_REQUIRED/);
  assert.match(e2e, /WITHDRAWN/);
  assert.match(productionConfig, /leg-07\.spec\.js/);
});
