import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { formatBusinessDateKey, formatBusinessDateTime } from '../src/lib/business-time.js';
import { formatFcfa } from '../src/lib/display-formatters.js';
import { normalizeFrenchPackageName } from '../src/lib/packages.js';
import { STATUS_LABELS, statusLabel } from '../src/lib/status-labels.js';

test('P2-04 centralise les statuts et les termes français affichés', () => {
  assert.equal(statusLabel('PENDING_CONFIRMATION'), 'En attente de confirmation');
  assert.equal(statusLabel('PAYMENT_INFO_REQUIRED'), 'Information de paiement requise');
  assert.equal(statusLabel('ACTIONABLE_REVIEW_REQUIRED'), 'Examen requis avant renvoi');
  assert.equal(statusLabel('UNKNOWN_PROVIDER_STATE'), 'Statut non reconnu');
  assert.equal(statusLabel(''), '—');
  assert.equal(Object.isFrozen(STATUS_LABELS), true);

  assert.equal(
    normalizeFrenchPackageName('Maternite Bebe Fiancailles Pre-mariage Decouverte'),
    'Maternité Bébé Fiançailles Pré-mariage Découverte',
  );
});

test('P2-04 applique les formatteurs FCFA et Douala dans le code et dans les dates', () => {
  assert.match(formatFcfa(50000), /^50\D?000 FCFA$/u);
  assert.match(formatBusinessDateKey('2026-08-08'), /sam.*8.*août.*2026/i);
  assert.match(formatBusinessDateKey('2026-08-08', 'en'), /Sat.*8.*August.*2026/i);

  const doualaMidnight = formatBusinessDateTime('2026-08-08T23:30:00.000Z');
  assert.match(doualaMidnight, /9 août 2026/i);
  assert.match(doualaMidnight, /00:30/);

  const reservation = readFileSync(new URL('../src/pages/Reservation.jsx', import.meta.url), 'utf8');
  const dashboard = readFileSync(new URL('../src/pages/AdminDashboard.jsx', import.meta.url), 'utf8');
  const packagesPanel = readFileSync(new URL('../src/components/AdminPackagesPanel.jsx', import.meta.url), 'utf8');

  for (const source of [reservation, dashboard, packagesPanel]) {
    assert.doesNotMatch(source, /const currency\s*=/);
    assert.doesNotMatch(source, /toLocaleString\('fr-FR'\).*FCFA/);
  }
  assert.match(reservation, /formatBusinessDateKey/);
  // The journal moved to AdminMessagesPanel in Phase 7; an unclassified failure must
  // still read as something rather than as a blank cell.
  const journal = readFileSync(new URL('../src/components/AdminMessagesPanel.jsx', import.meta.url), 'utf8');
  assert.match(journal, /statusLabel\(code \|\| 'UNCLASSIFIED'\)/);
  assert.doesNotMatch(packagesPanel, /FCFA.*XAF/);
});
