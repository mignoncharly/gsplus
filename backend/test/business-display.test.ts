import { describe, expect, it } from 'vitest';
import { PaymentStatus, ReservationStatus } from '../src/generated/prisma/enums.js';
import { financialTaskStatusLabel, formatBusinessDuration, formatRelativeBusinessDuration, paymentMethodLabel, paymentStatusLabel, reservationStatusLabel } from '../src/utils/business-display.js';

describe('Phase 4 human-facing business formatting', () => {
  it('centralizes operator and status labels without raw enums', () => {
    expect(paymentMethodLabel('mtn_momo')).toBe('MTN MoMo');
    expect(paymentMethodLabel('orange_money', 'en')).toBe('Orange Money');
    expect(paymentStatusLabel(PaymentStatus.PENDING)).toBe('En attente de vérification');
    expect(reservationStatusLabel(ReservationStatus.PENDING_CONFIRMATION)).toBe('En attente de confirmation');
    expect(financialTaskStatusLabel('IN_PROGRESS')).toBe('En cours');
  });
  it('formats long durations without decimal-hour strings', () => {
    const duration = (((9 * 24 + 15) * 60) + 36) * 60_000;
    expect(formatBusinessDuration(duration, 'fr')).toBe('9 j 15 h 36 min');
    expect(formatBusinessDuration(duration, 'en')).toBe('9 days 15 hours 36 minutes');
    expect(formatRelativeBusinessDuration(-duration, 'fr')).toBe('9 j 15 h 36 min après le début prévu');
  });
});
