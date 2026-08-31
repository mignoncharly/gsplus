import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboard = await readFile(new URL('../src/pages/AdminDashboard.jsx', import.meta.url), 'utf8');
const security = await readFile(new URL('../src/components/AdminSecurityPanel.jsx', import.meta.url), 'utf8');
const api = await readFile(new URL('../src/lib/api.js', import.meta.url), 'utf8');

test('the extracted security panel exposes a secure self-service password change flow', () => {
  assert.match(api, /apiFetch\('\/api\/admin\/password'/);
  assert.match(dashboard, /AdminSecurityPanel/);
  assert.match(security, /autoComplete="current-password"/);
  assert.match(security, /autoComplete="new-password"/);
  assert.match(security, /minLength="12"/);
  assert.match(security, /passwords\.newPassword !== passwords\.confirmPassword/);
  assert.match(security, /La modification retire toutes les autres sessions/);
});
test("the invitation form is reset from its captured form before async work completes", () => {
  assert.match(security, /const form = event\.currentTarget;/);
  assert.match(security, /form\.reset\(\);/);
  assert.doesNotMatch(security, /event\.currentTarget\.reset\(\);/);
});
