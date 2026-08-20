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

const inventory = source('src/content/tracker-inventory.js');
const privacy = source('../docs/new docs/politique de confidentialite.txt');
const audit = source('scripts/audit-trackers.mjs');
const packageJson = source('package.json');
const adminAuth = source('../backend/src/services/admin-auth.ts');
const backendIntegration = source('../backend/test/integration/api.test.ts');
const productionConfig = source('playwright.production.config.js');
const e2e = source('e2e/leg-06.spec.js');

test('LEG-06 centralise un inventaire versionné et ne déclare aucun traceur facultatif actif', () => {
  assert.match(inventory, /TRACKER_INVENTORY_VERSION/);
  assert.match(inventory, /__Host-gsp_admin_session/);
  assert.match(inventory, /fonts\.googleapis\.com/);
  assert.match(inventory, /STRICTLY_NECESSARY/);
  assert.match(inventory, /NON_TRACKING_EXTERNAL_RESOURCE/);
  assert.match(inventory, /OPTIONAL_TRACKERS_ENABLED = false/);
  assert.doesNotMatch(inventory, /classification:\s*'OPTIONAL'/);
});

test('LEG-06 bloque au build tout tracker ou stockage non inventorié', () => {
  assert.match(audit, /FORBIDDEN_TRACKER_SIGNATURES/);
  assert.match(audit, /document\\\.cookie|document\.cookie/);
  assert.match(audit, /localStorage/);
  assert.match(audit, /sessionStorage/);
  assert.match(audit, /observedExternalOrigins/);
  assert.match(audit, /tracker-audit-report\.json/);
  assert.match(packageJson, /audit:trackers/);
  assert.match(packageJson, /npm run audit:trackers/);
});

test('LEG-06 publie la section OWNER sur les cookies sans afficher une fausse CMP', () => {
  assert.match(privacy, /Cookies, traceurs et mesure d’audience/);
  assert.match(privacy, /Les traceurs facultatifs sont soumis au choix de l’utilisateur/);
  assert.doesNotMatch(privacy, /Tout accepter|Tout refuser/);
});

test('LEG-06 conserve le cookie admin nécessaire et couvre le scan runtime local et production', () => {
  assert.match(adminAuth, /httpOnly: true/);
  assert.match(adminAuth, /sameSite: 'strict'/);
  assert.match(adminAuth, /ADMIN_SESSION_TTL_SECONDS/);
  assert.match(backendIntegration, /ADMIN_SESSION_COOKIE_PRODUCTION/);
  assert.match(backendIntegration, /not\.toContain\('Domain='\)/);
  assert.match(e2e, /context\.cookies/);
  assert.match(e2e, /localStorage/);
  assert.match(e2e, /sessionStorage/);
  assert.match(productionConfig, /leg-06\.spec\.js/);
});
