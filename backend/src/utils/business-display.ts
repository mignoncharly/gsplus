import { PaymentStatus, ReservationStatus } from '../generated/prisma/enums.js';

export type DisplayLocale = 'fr' | 'en';

export const paymentMethodLabel = (method: string | null | undefined, locale: DisplayLocale = 'fr') => {
  const labels: Record<string, string> = { mtn_momo: 'MTN MoMo', orange_money: 'Orange Money' };
  return method ? labels[method] ?? method.replaceAll('_', ' ') : locale === 'en' ? 'Not provided' : 'Non communiqué';
};

export const paymentStatusLabel = (status: PaymentStatus | undefined, locale: DisplayLocale = 'fr') => {
  const labels = locale === 'en'
    ? { PENDING: 'Awaiting verification', PAYMENT_INFO_REQUIRED: 'Additional information required', VERIFICATION_BLOCKED: 'Verification temporarily blocked', VERIFIED: 'Verified', PAID: 'Paid', REJECTED: 'Rejected', FAILED: 'Failed', EXPIRED: 'Expired', REFUND_PENDING: 'Refund in progress', REFUNDED: 'Refunded' }
    : { PENDING: 'En attente de vérification', PAYMENT_INFO_REQUIRED: 'Information complémentaire requise', VERIFICATION_BLOCKED: 'Vérification temporairement bloquée', VERIFIED: 'Vérifié', PAID: 'Payé', REJECTED: 'Rejeté', FAILED: 'Échec', EXPIRED: 'Expiré', REFUND_PENDING: 'Remboursement en cours', REFUNDED: 'Remboursé' };
  return labels[status ?? PaymentStatus.PENDING];
};

export const reservationStatusLabel = (status: ReservationStatus, locale: DisplayLocale = 'fr') => {
  const labels = locale === 'en'
    ? { PENDING_CONFIRMATION: 'Awaiting confirmation', CONFIRMED: 'Confirmed', COMPLETED: 'Completed', CANCELLED: 'Cancelled', NO_SHOW: 'No-show', REJECTED: 'Rejected', EXPIRED: 'Expired' }
    : { PENDING_CONFIRMATION: 'En attente de confirmation', CONFIRMED: 'Confirmée', COMPLETED: 'Terminée', CANCELLED: 'Annulée', NO_SHOW: 'Absence non signalée', REJECTED: 'Refusée', EXPIRED: 'Expirée' };
  return labels[status];
};

export const financialTaskStatusLabel = (status: string, locale: DisplayLocale = 'fr') => {
  const labels = locale === 'en'
    ? { PENDING: 'Pending', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', FAILED: 'Failed' }
    : { PENDING: 'À traiter', IN_PROGRESS: 'En cours', COMPLETED: 'Terminée', FAILED: 'En échec' };
  return labels[status as keyof typeof labels] ?? (locale === 'en' ? 'Unknown status' : 'Statut inconnu');
};

export const formatBusinessDuration = (durationMs: number, locale: DisplayLocale = 'fr') => {
  let minutes = Math.max(0, Math.round(Math.abs(durationMs) / 60_000));
  const days = Math.floor(minutes / 1_440); minutes %= 1_440;
  const hours = Math.floor(minutes / 60); minutes %= 60;
  const units = locale === 'en'
    ? [[days, days === 1 ? 'day' : 'days'], [hours, hours === 1 ? 'hour' : 'hours'], [minutes, minutes === 1 ? 'minute' : 'minutes']] as const
    : [[days, 'j'], [hours, 'h'], [minutes, 'min']] as const;
  return units.filter(([value]) => value > 0).map(([value, label]) => `${value} ${label}`).join(' ') || (locale === 'en' ? '0 minutes' : '0 min');
};

export const formatRelativeBusinessDuration = (leadTimeMs: number, locale: DisplayLocale = 'fr') => {
  const duration = formatBusinessDuration(leadTimeMs, locale);
  if (locale === 'en') return leadTimeMs >= 0 ? `${duration} before the session` : `${duration} after the scheduled start`;
  return leadTimeMs >= 0 ? `${duration} avant la séance` : `${duration} après le début prévu`;
};
