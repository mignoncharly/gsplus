import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  packageSelectionDisabledReason,
  paymentSubmissionDisabledReason,
  slotSelectionDisabledReason,
} from '../src/lib/disabled-actions.js';

test('P2-03 explains each reservation prerequisite and clears the help when available', () => {
  assert.match(packageSelectionDisabledReason({ loading: true, packageCount: 0, packageId: '' }), /chargement/i);
  assert.match(packageSelectionDisabledReason({ loading: false, packageCount: 2, packageId: '' }), /Choisissez une formule/);
  assert.equal(packageSelectionDisabledReason({ loading: false, packageCount: 2, packageId: 'pack-1' }), '');

  assert.match(slotSelectionDisabledReason({ date: '', time: '', checking: false, verified: false }), /jour/);
  assert.match(slotSelectionDisabledReason({ date: '2026-08-10', time: '', checking: false, verified: false }), /horaire/);
  assert.match(slotSelectionDisabledReason({ date: '2026-08-10', time: '10:00', checking: false, verified: false }), /vérifi/i);
  assert.equal(slotSelectionDisabledReason({ date: '2026-08-10', time: '10:00', checking: false, verified: true }), '');

  assert.match(paymentSubmissionDisabledReason({ submitting: false, paymentChoice: 'base', paymentPhone: '', transactionId: '' }), /téléphone.*référence/);
  assert.equal(paymentSubmissionDisabledReason({ submitting: false, paymentChoice: 'quote', paymentPhone: '', transactionId: '' }), '');
});

test('P2-03 uses non-color disabled styles, visible help and accessible unavailable slots', () => {
  const globalCss = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const reservation = readFileSync(new URL('../src/pages/Reservation.jsx', import.meta.url), 'utf8');
  const helper = readFileSync(new URL('../src/components/ActionAvailabilityHint.jsx', import.meta.url), 'utf8');

  assert.match(globalCss, /button:disabled[\s\S]*opacity:[\s\S]*box-shadow: none[\s\S]*border-style: dashed/);
  assert.match(reservation, /aria-describedby={packageDisabledReason/);
  assert.match(reservation, /aria-describedby={slotDisabledReason/);
  assert.match(reservation, /aria-disabled={isUnavail \|\| checkingSlot/);
  assert.match(reservation, /Indisponible — horaire barré/);
  assert.match(helper, /Action indisponible/);
});
