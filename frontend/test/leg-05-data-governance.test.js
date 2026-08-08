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
const governance = source('../backend/src/services/data-governance.ts');
const permissions = source('../backend/src/services/admin-permissions.ts');
const routes = source('../backend/src/routes/admin.ts');
const validation = source('../backend/src/validation/schemas.ts');
const adminApi = source('src/lib/api.js');
const adminPanel = source('src/components/AdminDataGovernancePanel.jsx');

test('LEG-05 publie des politiques différenciées sans effacement automatique', () => {
  assert.match(schema, /model DataRetentionPolicy/);
  for (const field of ['category', 'triggerRule', 'activeRule', 'archiveRule', 'dispositionRule', 'backupRule', 'automaticExecution']) {
    assert.match(schema, new RegExp(field));
  }
  assert.match(governance, /automaticExecution: false/);
  assert.match(governance, /BACKUPS/);
  assert.match(adminPanel, /Aucune suppression automatique/);
});

test('LEG-05 trace chaque demande, sa réponse, sa restriction et son échéance', () => {
  assert.match(schema, /model DataRightsRequest/);
  assert.match(schema, /model DataRightsRequestEvent/);
  for (const field of ['requestType', 'targetResponseAt', 'identityStatus', 'processingRestricted', 'retentionAction', 'responseEvidence', 'version']) {
    assert.match(schema, new RegExp(field));
  }
  for (const right of ['ACCESS', 'RECTIFICATION', 'RESTRICTION', 'OBJECTION', 'PORTABILITY', 'CONSENT_WITHDRAWAL', 'ERASURE']) {
    assert.match(validation, new RegExp(right));
  }
  assert.match(governance, /DATA_RIGHTS_VERSION_CONFLICT/);
  assert.match(governance, /runAdminCommand/);
});

test('LEG-05 réserve le registre au propriétaire et ne stocke aucune pièce d’identité brute', () => {
  assert.match(permissions, /DATA_GOVERNANCE_MANAGE/);
  assert.match(routes, /assertAdminPermission\(admin, 'DATA_GOVERNANCE_MANAGE'\)/);
  assert.match(validation, /identityEvidenceReference/);
  assert.doesNotMatch(schema, /identityDocument|identityFile|identityImage|identityBinary/i);
  assert.match(adminPanel, /Ne déposez aucune copie de pièce d’identité/);
});

test('LEG-05 expose un écran ciblé et des commandes administratives dédupliquées', () => {
  assert.match(routes, /\/data-governance/);
  assert.match(routes, /\/data-rights-requests/);
  assert.match(adminApi, /getAdminDataGovernance/);
  assert.match(adminApi, /createAdminDataRightsRequest/);
  assert.match(adminApi, /updateAdminDataRightsRequest/);
  assert.match(adminPanel, /Demandes de droits/);
  assert.match(adminPanel, /Archivage restreint/);
});
