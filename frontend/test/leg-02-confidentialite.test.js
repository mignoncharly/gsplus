import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (path) => readFileSync(`${root}${path}`, 'utf8');
const privacy = source('src/pages/Privacy.jsx');
const legalContent = source('src/content/legal.js');

test('LEG-02 publie les dix sections consolidées du 31 juillet 2026', () => {
  assert.match(legalContent, /PRIVACY_LAST_UPDATED = '31 juillet 2026'/);
  for (const heading of [
    '1. Responsable du traitement et contact',
    '2. Données collectées',
    '3. Finalités et fondements des traitements',
    '4. Destinataires, prestataires et transferts',
    '5. Traitement numérique des images',
    '6. Durées de conservation et archivage',
    '7. Cookies, traceurs et mesure d’audience',
    '8. Sécurité',
    '9. Vos droits et modalités d’exercice',
    '10. Documents associés',
  ]) {
    assert.match(privacy, new RegExp(heading.replace('.', '\\.')));
  }
});

test('LEG-02 couvre finalités, transferts, archivage, sécurité et exercice des droits', () => {
  for (const required of [
    'détecter les erreurs, incohérences, doublons ou tentatives de fraude',
    'Les données ne sont pas vendues comme une activité commerciale autonome',
    'archive intermédiaire à accès restreint',
    'les sauvegardes peuvent conserver temporairement des copies résiduelles',
    'confidentialité, l’intégrité, la disponibilité et la traçabilité',
    'Le droit à l’effacement n’est pas absolu',
    'Une preuve d’identité proportionnée',
    'Le retrait d’une autorisation relative au droit à l’image est traité séparément',
  ]) {
    assert.match(privacy, new RegExp(required));
  }
  assert.match(privacy, /ACTIVE_PROCESSORS/);
  assert.match(privacy, /DATA_RETENTION/);
  assert.match(privacy, /Le site public n’utilise actuellement ni cookie publicitaire ni outil de mesure d’audience/);
});
