import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (path) => readFileSync(`${root}${path}`, 'utf8');
const terms = source('../docs/new docs/cgv.txt');

test('LEG-03 publie les huit sections de la source OWNER du 11 août 2026', () => {
  assert.equal(createHash('sha256').update(terms).digest('hex'), '1bb97bc010c71237a4494cf842e4cfe3146c7c249fd715593e02d20eeb868e7d');
  for (let index = 1; index <= 8; index += 1) assert.match(terms, new RegExp(`\\n${index}\\. `));
  assert.match(source('src/content/owner-legal-documents.js'), /cgv\.txt\?raw/);
  assert.match(source('src/pages/Terms.jsx'), /OWNER_LEGAL_DOCUMENTS\.terms/);
  assert.match(source('src/content/legal.js'), /TERMS_LAST_UPDATED = '11 août 2026'/);
});

test('LEG-03 conserve les clauses OWNER de paiement, annulation, rétractation et livraison', () => {
  for (const clause of [
    'deux décisions distinctes',
    'heure locale de Douala',
    'quinze (15) jours',
    'Les délais et canaux de livraison annoncés',
    'celle mise à la disposition du client et acceptée',
  ]) assert.match(terms, new RegExp(clause.replace(/[()]/g, '\\$&')));
});

test('LEG-03 conserve une demande explicite et une décision humaine motivée sans automatiser le remboursement', () => {
  const admin = source('src/pages/AdminDashboard.jsx');
  assert.match(admin, /motif/i);
  assert.doesNotMatch(terms, /remboursement automatique/i);
});
