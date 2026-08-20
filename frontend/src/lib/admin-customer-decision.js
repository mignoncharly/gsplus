import { previewAdminCustomerDecision } from './api';

const OPTIONS = {
  RESERVATION_REJECTION: [{ value: 'SLOT_UNAVAILABLE', label: 'Le créneau demandé n’est plus disponible.' }, { value: 'OPERATIONAL_CONSTRAINT', label: 'Une contrainte opérationnelle empêche de maintenir la demande.' }],
  STUDIO_CANCELLATION: [{ value: 'STUDIO_UNAVAILABLE', label: 'Le Studio ne pourra exceptionnellement pas assurer la séance.' }, { value: 'OPERATIONAL_CONSTRAINT', label: 'Une contrainte opérationnelle empêche de maintenir la demande.' }],
  RESERVATION_EXPIRATION: [{ value: 'REQUEST_DEADLINE_EXPIRED', label: 'Le délai de finalisation est dépassé.' }],
  PAYMENT_REJECTION: [{ value: 'PAYMENT_UNVERIFIED', label: 'Les éléments transmis ne permettent pas de valider le paiement.' }, { value: 'PAYMENT_REFERENCE_REQUIRED', label: 'Une référence de transaction vérifiable est nécessaire.' }],
  PAYMENT_INFORMATION_REQUEST: [{ value: 'PAYMENT_REFERENCE_REQUIRED', label: 'Une référence de transaction vérifiable est nécessaire.' }],
  PAYMENT_VERIFICATION_BLOCKAGE: [{ value: 'PAYMENT_REVIEW_DELAYED', label: 'La vérification est temporairement retardée.' }],
  RESCHEDULE_REJECTION: [{ value: 'RESCHEDULE_UNAVAILABLE', label: 'Le nouveau créneau demandé n’est pas disponible.' }],
  WITHDRAWAL_REJECTION: [{ value: 'WITHDRAWAL_REQUIREMENTS_NOT_MET', label: 'Les conditions de rétractation ne sont pas réunies.' }],
};

export const customerDecisionFields = (scope, maxInternal = 1000) => [
  { name: 'internalReason', label: 'Note interne privée', type: 'textarea', required: true, help: 'Contexte réservé à l’audit interne. Il ne sera jamais transmis au client.', validate: (value) => String(value).trim().length > maxInternal ? `Maximum ${maxInternal} caractères.` : '' },
  { name: 'customerReasonCode', label: 'Motif client approuvé', type: 'select', required: true, defaultValue: OPTIONS[scope][0].value, options: OPTIONS[scope] },
  { name: 'customerReasonText', label: 'Adaptation client facultative', type: 'textarea', help: '280 caractères maximum. Laissez vide pour le texte approuvé dans la langue figée du dossier.', validate: (value) => String(value || '').trim().length > 280 ? 'Maximum 280 caractères.' : '' },
];

export const previewDecision = (scope, entityId, values) => previewAdminCustomerDecision({
  scope,
  entityId,
  internalReason: values.internalReason.trim(),
  customerReasonCode: values.customerReasonCode,
  customerReasonText: values.customerReasonText?.trim() || undefined,
});
