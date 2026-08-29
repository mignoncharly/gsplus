import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (path) => readFileSync(`${root}${path}`, 'utf8');
const backend = (path) => readFileSync(`${root}../backend/${path}`, 'utf8');

// Phase 4 moved reference lookup from a dedicated client-side call into the general
// server-side search, and the search UI into AdminReservationsPanel. The guarantees
// REF-01 protects are unchanged and asserted here at their new locations.

test('REF-01 admin looks a reservation up by its normalized public reference', () => {
  const api = source('src/lib/api.js');
  assert.match(api, /getAdminReservations = async \(filters = \{\}\)/);
  assert.match(api, /searchAdminReservations/);

  // Normalisation is now the server's job, so a lower-case reference still matches.
  const schemas = backend('src/validation/schemas.ts');
  assert.match(schemas, /reference: z\.string\(\)[\s\S]{0,120}toUpperCase\(\)/);
  const search = backend('src/services/reservation-search.ts');
  assert.match(search, /reference: \{ contains: term\.toUpperCase\(\) \}/);
  assert.match(search, /if \(filters\.reference\) and\.push\(\{ reference: filters\.reference \}\)/);
});

test('REF-01 admin exposes a labelled search and displays the public value, not an id', () => {
  const panel = source('src/components/AdminReservationsPanel.jsx');
  assert.match(panel, /htmlFor="reservation-q"/);
  assert.match(panel, /Rechercher</);
  assert.match(panel, /Référence publique/);
  assert.match(panel, /admin-public-reference/);
  assert.match(panel, /reservation\.reference/);

  // The internal identifier is only ever used as a React key or handler argument.
  assert.doesNotMatch(panel, /\{reservation\.id\}</, 'the technical id must not be rendered');
});
