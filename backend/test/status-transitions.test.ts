import { describe, expect, it } from 'vitest';

import { PaymentStatus, ReservationStatus } from '../src/generated/prisma/enums.js';
import { allowedPaymentTargets, allowedReservationTargets } from '../src/services/status-transitions.js';

const paymentTransitions = {
  PENDING: ['PAYMENT_INFO_REQUIRED', 'VERIFICATION_BLOCKED', 'VERIFIED', 'PAID', 'REJECTED', 'FAILED', 'EXPIRED'],
  PAYMENT_INFO_REQUIRED: ['PENDING', 'VERIFICATION_BLOCKED', 'VERIFIED', 'REJECTED'],
  VERIFICATION_BLOCKED: ['PENDING', 'PAYMENT_INFO_REQUIRED', 'VERIFIED', 'REJECTED'],
  VERIFIED: ['PAID', 'REFUND_PENDING'],
  PAID: ['REFUND_PENDING'],
  REJECTED: ['PENDING'],
  FAILED: ['PENDING'],
  EXPIRED: ['PENDING'],
  REFUND_PENDING: ['REFUNDED', 'FAILED'],
  REFUNDED: [],
};

const reservationTransitions = {
  PENDING_CONFIRMATION: ['CONFIRMED', 'CANCELLED', 'REJECTED', 'EXPIRED'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
  CANCELLED: ['PENDING_CONFIRMATION'],
  REJECTED: ['PENDING_CONFIRMATION'],
  EXPIRED: ['PENDING_CONFIRMATION'],
  COMPLETED: [],
  NO_SHOW: [],
};

describe('P0-04 centralized transition matrices', () => {
  it('classifies every payment state pair as allowed or forbidden', () => {
    const statuses = Object.values(PaymentStatus);
    for (const from of statuses) {
      const actual = allowedPaymentTargets(from);
      expect(actual).toEqual(paymentTransitions[from]);
      for (const to of statuses) {
        expect(actual.includes(to), `${from} -> ${to}`).toBe(paymentTransitions[from].includes(to));
      }
    }
  });

  it('classifies every reservation state pair as allowed or forbidden', () => {
    const statuses = Object.values(ReservationStatus);
    for (const from of statuses) {
      const actual = allowedReservationTargets(from);
      expect(actual).toEqual(reservationTransitions[from]);
      for (const to of statuses) {
        expect(actual.includes(to), `${from} -> ${to}`).toBe(reservationTransitions[from].includes(to));
      }
    }
  });
});
