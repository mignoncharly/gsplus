import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (path) => {
  try {
    return readFileSync(`${root}${path}`, 'utf8');
  } catch {
    return '';
  }
};
const terms = source('src/pages/Terms.jsx');
const legalContent = source('src/content/legal.js');
const schema = source('../backend/prisma/schema.prisma');
const adminRoutes = source('../backend/src/routes/admin.ts');
const withdrawalService = source('../backend/src/services/reservation-withdrawals.ts');
const adminApi = source('src/lib/api.js');
const adminDashboard = source('src/pages/AdminDashboard.jsx');
const withdrawalPanel = source('src/components/AdminWithdrawalRequestsPanel.jsx');

test('LEG-03 publie les huit sections consolidées du 31 juillet 2026', () => {
  assert.match(legalContent, /TERMS_LAST_UPDATED = '31 juillet 2026'/);
  for (const heading of [
    '1. Réservation, prix et paiement',
    '2. Retards, annulations et report',
    '3. Droit de rétractation applicable aux réservations en ligne',
    '4. Droit à l’image et droits d’auteur',
    '5. Traitement numérique de l’image',
    '6. Exécution, livraison et responsabilité',
    '7. Réclamations et litiges',
    '8. Documents associés et mise à jour',
  ]) {
    assert.match(terms, new RegExp(heading.replace('.', '\\.')));
  }
});

test('LEG-03 couvre paiement, seuil Douala, rétractation, livraison et version acceptée', () => {
  for (const required of [
    'deux décisions distinctes',
    'Un remboursement n’est réputé effectué qu’après exécution et confirmation effectives',
    'sous réserve de tout droit impératif de rétractation ou de remboursement',
    'Les délais sont calculés selon l’heure locale de Douala',
    'quinze (15) jours à compter de la conclusion du contrat',
    'La rétractation doit être adressée sans ambiguïté',
    'fichiers bruts, essais, réglages et autres éléments de travail intermédiaires',
    'La version applicable à une réservation est celle mise à la disposition du client et acceptée',
  ]) assert.ok(terms.includes(required), `Clause absente : ${required}`);
});

test('LEG-03 conserve une demande explicite et une décision humaine motivée sans automatiser le remboursement', () => {
  for (const required of [
    'model ReservationWithdrawalRequest',
    'contractConcludedAt',
    'legalDeadlineAt',
    'receivedAt',
    'serviceStatus',
    'executionStartedAt',
    'decisionReason',
    'requestEvidence',
  ]) assert.match(schema, new RegExp(required));
  assert.match(adminRoutes, /\/reservations\/:id\/withdrawal-requests/);
  assert.match(adminRoutes, /\/withdrawal-requests\/:id\/decision/);
  assert.match(withdrawalService, /receivedWithinLegalWindow/);
  assert.match(withdrawalService, /Aucune annulation ni aucun remboursement n’est exécuté automatiquement/);
  assert.match(adminApi, /createAdminWithdrawalRequest/);
  assert.match(adminApi, /decideAdminWithdrawalRequest/);
  assert.match(adminDashboard, /État du service à la réception/);
  assert.match(adminDashboard, /Analyse et motif de la décision/);
  assert.match(withdrawalPanel, /reçue dans la fenêtre de 15 jours/);
  assert.match(withdrawalPanel, /ne marque aucun remboursement comme effectué/);
});
