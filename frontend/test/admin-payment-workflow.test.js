import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canConfirmReservation,
  canVerifyAndConfirm,
  isReservationEndReached,
  isTemporalOverrideTransition,
  paymentActions,
  reservationActions,
  statusLabel,
} from '../src/lib/admin-workflow.js';

test('P0-04 exposes every distinct payment decision with French labels', () => {
  assert.equal(statusLabel('PAYMENT_INFO_REQUIRED'), 'Information de paiement requise');
  assert.equal(statusLabel('VERIFICATION_BLOCKED'), 'Vérification temporairement bloquée');
  assert.equal(statusLabel('PAID'), 'Payé');
  assert.deepEqual(
    paymentActions('PENDING').map((action) => action.status),
    ['VERIFIED', 'PAYMENT_INFO_REQUIRED', 'VERIFICATION_BLOCKED', 'REJECTED'],
  );
  assert.deepEqual(
    paymentActions('PAYMENT_INFO_REQUIRED').map((action) => action.status),
    ['PENDING', 'VERIFIED', 'VERIFICATION_BLOCKED', 'REJECTED'],
  );
  assert.deepEqual(
    paymentActions('VERIFICATION_BLOCKED').map((action) => action.status),
    ['PENDING', 'PAYMENT_INFO_REQUIRED', 'VERIFIED', 'REJECTED'],
  );
});

test('P0-04 disables confirmation until payment is authorized', () => {
  for (const status of ['PENDING', 'PAYMENT_INFO_REQUIRED', 'VERIFICATION_BLOCKED', 'REJECTED']) {
    assert.equal(canConfirmReservation(status), false, status);
  }
  assert.equal(canConfirmReservation('VERIFIED'), true);
  assert.equal(canConfirmReservation('PAID'), true);
  assert.equal(canVerifyAndConfirm('PENDING_CONFIRMATION', 'PENDING'), true);
  assert.equal(canVerifyAndConfirm('CONFIRMED', 'PENDING'), false);
  assert.equal(canVerifyAndConfirm('PENDING_CONFIRMATION', 'REJECTED'), false);
});

test('P0-03 exposes temporal closure rules at -1, exact and +1 minute', () => {
  const endAt = new Date('2030-01-02T00:00:00.000Z');
  assert.equal(isReservationEndReached(endAt, new Date('2030-01-01T23:59:00.000Z')), false);
  assert.equal(isReservationEndReached(endAt, new Date('2030-01-02T00:00:00.000Z')), true);
  assert.equal(isReservationEndReached(endAt, new Date('2030-01-02T00:01:00.000Z')), true);
  assert.deepEqual(
    reservationActions('CONFIRMED').filter((action) => action.temporalClosure).map((action) => action.status),
    ['COMPLETED', 'NO_SHOW'],
  );
});

test('P0-03 recognizes only persisted temporal override metadata', () => {
  assert.equal(isTemporalOverrideTransition({ metadata: { temporalOverride: { applied: true } } }), true);
  assert.equal(isTemporalOverrideTransition({ metadata: { temporalOverride: { applied: false } } }), false);
  assert.equal(isTemporalOverrideTransition({ metadata: null }), false);
});
