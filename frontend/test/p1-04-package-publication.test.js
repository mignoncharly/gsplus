import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const api = await readFile(new URL('../src/lib/api.js', import.meta.url), 'utf8');
const packagePanel = await readFile(new URL('../src/components/AdminPackagesPanel.jsx', import.meta.url), 'utf8');
const publishGate = await readFile(new URL('../../backend/src/services/packages.ts', import.meta.url), 'utf8');

test('P1-04 exposes explicit draft, validation, publication and archive actions', () => {
  assert.match(api, /\/packages\/\$\{id\}\/validate/);
  assert.match(api, /\/packages\/\$\{id\}\/publish/);
  assert.match(api, /\/packages\/\$\{id\}\/archive/);
  assert.match(packagePanel, /Valider les mentions/);
  assert.match(packagePanel, /Publier la formule/);
  assert.match(packagePanel, /publicationStatus/);
});

test('P1-04 keeps every mandatory publication field gated at publication, not at the draft', () => {
  // Phase 8 (report §6.2) made the public presentation optional while a formula is a
  // draft. That is only safe because the server refuses to publish an incomplete one, so
  // this guard now watches the gate rather than the form's asterisks: moving a field out
  // of assertPublishable would let a half-written formula reach a client.
  for (const field of ['description', 'content', 'inclusions', 'conditions', 'legalText', 'deliveryLabel', 'effectiveAt']) {
    assert.match(publishGate, new RegExp(`missing\\.push\\('${field}'\\)`));
  }
  // And the form has to say so, rather than letting the refusal come as a surprise.
  for (const field of ['description', 'content', 'inclusions', 'conditions']) {
    const declaration = packagePanel.match(new RegExp(`name: '${field}'[\\s\\S]{0,320}?\\},`));
    assert.ok(declaration, `no declaration found for ${field}`);
    assert.doesNotMatch(declaration[0], /required: true/, `${field} must not be required to save a draft`);
    assert.match(declaration[0], /Obligatoire pour publier/, `${field} must state that publication requires it`);
  }
  assert.match(packagePanel, /Aperçu avant publication/);
  assert.match(packagePanel, /Mentions obligatoires/);
});
