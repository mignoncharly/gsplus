import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (path) => readFileSync(`${root}${path}`, 'utf8');
const legalPage = source('src/pages/Legal.jsx');
const legalContent = source('src/content/legal.js');
const legalLayout = source('src/components/LegalPageLayout.jsx');

test('LEG-01 publie fidèlement les quatre sections normatives du 31 juillet 2026', () => {
  assert.match(legalContent, /LEGAL_MENTIONS_LAST_UPDATED = '31 juillet 2026'/);
  assert.match(legalLayout, /lastUpdated/);

  for (const heading of [
    '1. Éditeur et propriété intellectuelle',
    '2. Responsabilité',
    '3. Droit applicable et différends',
    '4. Documents associés',
  ]) {
    assert.match(legalPage, new RegExp(heading.replace('.', '\\.')));
  }

  assert.match(legalPage, /L’accès au site n’emporte aucune cession de droits/);
  assert.match(legalPage, /l’extraction automatisée ou répétée des contenus/);
  assert.match(legalPage, /entraîner, tester ou alimenter un système automatisé ou d’intelligence artificielle/);
  assert.match(legalPage, /compétence exclusive des tribunaux matériellement compétents du ressort de Douala/);
});

test('LEG-01 conserve les informations vérifiées et signale les mentions officielles absentes', () => {
  for (const verified of [
    'Cité des Palmiers, Douala, Cameroun',
    '+237 673 026 654',
    'info@gsplus.vip',
    'HOSTING_PROVIDER',
  ]) {
    assert.match(legalPage, new RegExp(verified.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(legalPage, /PENDING_LEGAL_PARTICULARS/);
  assert.match(legalPage, /Aucun numéro, nom ou renseignement juridique non vérifié n’est publié/);
});
