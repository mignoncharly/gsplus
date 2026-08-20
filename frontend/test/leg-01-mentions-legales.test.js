import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (path) => readFileSync(`${root}${path}`, 'utf8');
const mentions = source('../docs/new docs/mentions legales.txt');

test('LEG-01 publie la source OWNER du 11 août 2026 sans réécriture', () => {
  assert.equal(createHash('sha256').update(mentions).digest('hex'), '45f0f15aa26b2a9f25e071ed2795e47eec3b4a9c5082f470ec4f6f0281593f71');
  for (const heading of ['1. Éditeur et propriété intellectuelle', '2. Responsabilité', '3. Droit applicable et différends', '4. Documents associés']) {
    assert.match(mentions, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(source('src/content/owner-legal-documents.js'), /mentions legales\.txt\?raw/);
  assert.match(source('src/pages/Legal.jsx'), /OWNER_LEGAL_DOCUMENTS\.legalNotice/);
  assert.match(source('src/content/legal.js'), /LEGAL_MENTIONS_LAST_UPDATED = '11 août 2026'/);
});

test('LEG-01 n’invente aucune mention officielle absente de la nouvelle source', () => {
  for (const absent of ['forme juridique', 'capital social', 'RCCM', 'NIU', 'directeur de publication', 'directrice de publication']) {
    assert.doesNotMatch(mentions, new RegExp(absent, 'i'));
  }
});
