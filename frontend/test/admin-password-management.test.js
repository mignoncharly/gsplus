import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboard = await readFile(new URL('../src/pages/AdminDashboard.jsx', import.meta.url), 'utf8');
const api = await readFile(new URL('../src/lib/api.js', import.meta.url), 'utf8');

test('the admin dashboard exposes a secure self-service password change flow', () => {
  assert.match(api, /apiFetch\('\/api\/admin\/password'/);
  assert.match(dashboard, /id="account-current-password"/);
  assert.match(dashboard, /autoComplete="current-password"/);
  assert.match(dashboard, /id="account-new-password"/);
  assert.match(dashboard, /id="account-confirm-password"/);
  assert.match(dashboard, /autoComplete="new-password"/);
  assert.match(dashboard, /minLength=\{12\}/);
  assert.match(dashboard, /newPassword !== passwordForm\.confirmPassword/);
  assert.match(dashboard, /Les autres sessions administrateur ont été déconnectées/);
});
