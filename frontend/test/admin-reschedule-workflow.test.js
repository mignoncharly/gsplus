import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const apiSource = await readFile(new URL('../src/lib/api.js', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../src/pages/AdminDashboard.jsx', import.meta.url), 'utf8');
const panelSource = await readFile(new URL('../src/components/AdminRescheduleRequestsPanel.jsx', import.meta.url), 'utf8');

test('E-08/E-10/I-04 exposes a durable request and separate owner decision workflow', () => {
  assert.match(apiSource, /\/reservations\/\$\{id\}\/reschedule-requests/);
  assert.match(apiSource, /\/reschedule-requests\/\$\{id\}\/decision/);
  assert.match(dashboardSource, /Demander un report/);
  assert.match(dashboardSource, /AdminOpsPanel/);
  assert.match(panelSource, /onDecision\(request, 'ACCEPTED'\)/);
  assert.match(panelSource, /onDecision\(request, 'REJECTED'\)/);
});
