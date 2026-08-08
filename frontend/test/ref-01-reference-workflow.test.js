import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (path) => readFileSync(`${root}${path}`, 'utf8');

test('REF-01 admin API performs an indexed lookup by normalized public reference', () => {
  const api = source('src/lib/api.js');
  assert.match(api, /getAdminReservations = async \(\{ reference \} = \{\}\)/);
  assert.match(api, /URLSearchParams/);
  assert.match(api, /reference\.trim\(\)\.toUpperCase\(\)/);
});

test('REF-01 admin exposes a labelled reference search and displays the public value', () => {
  const dashboard = source('src/pages/AdminDashboard.jsx');
  assert.match(dashboard, /reservation-reference-search/);
  assert.match(dashboard, /Rechercher par référence/);
  assert.match(dashboard, /Référence publique/);
  assert.match(dashboard, /reservation\.reference/);
});
