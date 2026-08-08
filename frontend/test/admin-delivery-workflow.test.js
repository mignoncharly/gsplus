import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const apiSource = await readFile(new URL('../src/lib/api.js', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../src/pages/AdminDashboard.jsx', import.meta.url), 'utf8');
const panelSource = await readFile(new URL('../src/components/AdminDeliveriesPanel.jsx', import.meta.url), 'utf8');

test('completed reservations expose the verified delivery publication workflow', () => {
  assert.match(apiSource, /publishAdminReservationDelivery/);
  assert.match(apiSource, /\/deliveries/);
  assert.match(dashboardSource, /AdminOpsPanel/);
  assert.match(panelSource, /expectedReservationVersion: reservation\.version/);
  assert.match(panelSource, /reservation\.status !== 'COMPLETED'/);
  assert.match(panelSource, /Vérifier le lien et informer le client/);
  assert.match(panelSource, /type="url"/);
  assert.doesNotMatch(panelSource, /window\.(prompt|alert|confirm)/);
});
