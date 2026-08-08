import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { ADMIN_REFRESH_INTERVAL_MS, shouldRunAdminRefresh } from '../src/lib/admin-refresh.js';

test('P2-02 uses moderate polling only for a visible authenticated admin', () => {
  assert.equal(ADMIN_REFRESH_INTERVAL_MS, 60_000);
  assert.equal(shouldRunAdminRefresh({ isAuthenticated: true, visibilityState: 'visible' }), true);
  assert.equal(shouldRunAdminRefresh({ isAuthenticated: false, visibilityState: 'visible' }), false);
  assert.equal(shouldRunAdminRefresh({ isAuthenticated: true, visibilityState: 'hidden' }), false);
});

test('P2-02 exposes targeted refresh, freshness and no full-page reload', () => {
  const source = readFileSync(new URL('../src/pages/AdminDashboard.jsx', import.meta.url), 'utf8');
  assert.match(source, /Dernière actualisation/);
  assert.match(source, /Actualiser/);
  assert.match(source, /refreshAdminTab\(activeTab/);
  assert.match(source, /visibilitychange/);
  assert.doesNotMatch(source, /(?:window\.)?location\.reload\s*\(/);
});
