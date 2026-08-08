import { statusLabel } from './status-labels.js';

export { statusLabel } from './status-labels.js';

const RESERVATION_ACTIONS = {
  PENDING_CONFIRMATION: [
    { status: 'CONFIRMED', label: 'Confirmer' },
    { status: 'CANCELLED', label: 'Annuler', requiresReason: true, destructive: true },
    { status: 'REJECTED', label: 'Refuser', requiresReason: true, destructive: true },
    { status: 'EXPIRED', label: 'Marquer expirée', requiresReason: true },
  ],
  CONFIRMED: [
    { status: 'COMPLETED', label: 'Marquer terminée', temporalClosure: true },
    { status: 'NO_SHOW', label: 'Client absent', requiresReason: true, temporalClosure: true },
    { status: 'CANCELLED', label: 'Annuler', requiresReason: true, destructive: true },
  ],
  CANCELLED: [{ status: 'PENDING_CONFIRMATION', label: 'Restaurer', requiresReason: true }],
  REJECTED: [{ status: 'PENDING_CONFIRMATION', label: 'Restaurer', requiresReason: true }],
  EXPIRED: [{ status: 'PENDING_CONFIRMATION', label: 'Restaurer', requiresReason: true }],
  COMPLETED: [],
  NO_SHOW: [],
};

const VERIFY_ACTION = {
  status: 'VERIFIED',
  label: 'Vérifier le paiement',
  requiresTransactionReference: true,
};
const REJECT_ACTION = { status: 'REJECTED', label: 'Rejeter le paiement', requiresReason: true, destructive: true };
const PAYMENT_ACTIONS = {
  PENDING: [
    VERIFY_ACTION,
    { status: 'PAYMENT_INFO_REQUIRED', label: 'Demander une information', requiresReason: true },
    { status: 'VERIFICATION_BLOCKED', label: 'Marquer la vérification bloquée', requiresReason: true },
    REJECT_ACTION,
  ],
  PAYMENT_INFO_REQUIRED: [
    { status: 'PENDING', label: 'Reprendre la vérification', requiresReason: true },
    VERIFY_ACTION,
    { status: 'VERIFICATION_BLOCKED', label: 'Marquer la vérification bloquée', requiresReason: true },
    REJECT_ACTION,
  ],
  VERIFICATION_BLOCKED: [
    { status: 'PENDING', label: 'Reprendre la vérification', requiresReason: true },
    { status: 'PAYMENT_INFO_REQUIRED', label: 'Demander une information', requiresReason: true },
    VERIFY_ACTION,
    REJECT_ACTION,
  ],
  REJECTED: [{ status: 'PENDING', label: 'Reprendre la vérification', requiresReason: true }],
};

const CONFIRMABLE_PAYMENT_STATUSES = new Set(['VERIFIED', 'PAID']);
const COMBINED_PAYMENT_STATUSES = new Set(['PENDING', 'PAYMENT_INFO_REQUIRED', 'VERIFICATION_BLOCKED']);


export const reservationActions = (status) => RESERVATION_ACTIONS[status] || [];

export const paymentActions = (status) => PAYMENT_ACTIONS[status] || [];

export const isReservationEndReached = (endAt, now = new Date()) =>
  Boolean(endAt) && now.getTime() >= new Date(endAt).getTime();

export const isTemporalOverrideTransition = (transition) =>
  transition?.metadata?.temporalOverride?.applied === true;

export const canConfirmReservation = (paymentStatus) => CONFIRMABLE_PAYMENT_STATUSES.has(paymentStatus);

export const canVerifyAndConfirm = (reservationStatus, paymentStatus) =>
  reservationStatus === 'PENDING_CONFIRMATION' && COMBINED_PAYMENT_STATUSES.has(paymentStatus);

export const transitionActorLabel = (transition) =>
  transition?.adminUser?.name || statusLabel(transition?.actorType || 'SYSTEM');

export const packageReferenceCount = (pack) =>
  Number(pack?._count?.reservations || 0) + Number(pack?._count?.reservationIntents || 0);

export const buildWhatsAppCustomerLink = (reservation) => {
  const snapshot = reservation?.snapshot;
  if (!snapshot?.whatsappConsent || !snapshot.notificationPhoneE164) return null;
  const phone = String(snapshot.notificationPhoneE164).replace(/\D/g, '');
  if (!phone) return null;
  const firstName = String(snapshot.firstName || 'client').trim();
  const reference = String(reservation.reference || '').trim();
  const packageName = String(reservation.package?.name || snapshot.packageName || 'votre séance').trim();
  const message = `Bonjour ${firstName}, nous vous contactons au sujet de votre réservation ${reference} (${packageName}) chez Golden Studio Plus.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

export const isDeliveryAccessActive = (delivery, now = new Date()) =>
  delivery?.status === "AVAILABLE" && new Date(delivery.expiresAt).getTime() > now.getTime();
