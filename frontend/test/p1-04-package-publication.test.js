import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const api = await readFile(new URL('../src/lib/api.js', import.meta.url), 'utf8');
const packagePanel = await readFile(new URL('../src/components/AdminPackagesPanel.jsx', import.meta.url), 'utf8');

test('P1-04 exposes explicit draft, validation, publication and archive actions', () => {
  assert.match(api, /\/packages\/\$\{id\}\/validate/);
  assert.match(api, /\/packages\/\$\{id\}\/publish/);
  assert.match(api, /\/packages\/\$\{id\}\/archive/);
  assert.match(packagePanel, /Valider les mentions/);
  assert.match(packagePanel, /Publier la formule/);
  assert.match(packagePanel, /publicationStatus/);
});

test('P1-04 captures every mandatory publication field in the admin workflow', () => {
  for (const field of ['content', 'inclusions', 'conditions', 'legalText', 'effectiveAt']) {
    assert.match(packagePanel, new RegExp(`name: ['"]${field}['"]`));
  }
  assert.match(packagePanel, /Aperçu avant publication/);
  assert.match(packagePanel, /Mentions obligatoires/);
});
