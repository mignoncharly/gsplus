import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (path) => readFileSync(`${root}${path}`, 'utf8');
const privacy = source('../docs/new docs/politique de confidentialite.txt');

test('LEG-02 publie les dix sections de la source OWNER du 11 août 2026', () => {
  assert.equal(createHash('sha256').update(privacy).digest('hex'), 'dff41d3a34d86d4298f13daab306009fd585e3cffb9c33c7cf22a36d5ed4244a');
  for (let index = 1; index <= 10; index += 1) assert.match(privacy, new RegExp(`\\n${index}\\. `));
  assert.match(source('src/content/owner-legal-documents.js'), /politique de confidentialite\.txt\?raw/);
  assert.match(source('src/pages/Privacy.jsx'), /OWNER_LEGAL_DOCUMENTS\.privacy/);
  assert.match(source('src/content/legal.js'), /PRIVACY_LAST_UPDATED = '11 août 2026'/);
});

test('LEG-02 conserve les clauses OWNER de finalité, sécurité, droits et cookies', () => {
  for (const clause of [
    'détecter les erreurs, incohérences, doublons ou tentatives de fraude',
    'Certains prestataires peuvent traiter des données depuis un autre pays',
    'Durées de conservation et archivage',
    'Cookies, traceurs et mesure d’audience',
    'loi n° 2024/017 du 23 décembre 2024',
  ]) assert.match(privacy, new RegExp(clause));
});
