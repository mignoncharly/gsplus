import { HttpError } from '../errors/http-error.js';

export const CUSTOMER_COPY_VERSION = '2026-08-20.1';
export const CUSTOMER_REASON_CODES = ['SLOT_UNAVAILABLE', 'STUDIO_UNAVAILABLE', 'OPERATIONAL_CONSTRAINT', 'PAYMENT_UNVERIFIED', 'PAYMENT_REFERENCE_REQUIRED', 'PAYMENT_REVIEW_DELAYED', 'REQUEST_DEADLINE_EXPIRED', 'RESCHEDULE_UNAVAILABLE', 'WITHDRAWAL_REQUIREMENTS_NOT_MET'] as const;
export type CustomerReasonCode = typeof CUSTOMER_REASON_CODES[number];
export type CustomerLocale = 'fr' | 'en';
export type CustomerDecisionContext = 'RESERVATION_REJECTION' | 'STUDIO_CANCELLATION' | 'RESERVATION_EXPIRATION' | 'PAYMENT_REJECTION' | 'PAYMENT_INFORMATION_REQUEST' | 'PAYMENT_VERIFICATION_BLOCKAGE' | 'RESCHEDULE_REJECTION' | 'WITHDRAWAL_REJECTION';

const catalogue: Record<CustomerReasonCode, Record<CustomerLocale, string>> = {
  SLOT_UNAVAILABLE: { fr: 'Le créneau demandé n’est plus disponible.', en: 'The requested time slot is no longer available.' },
  STUDIO_UNAVAILABLE: { fr: 'Le Studio ne pourra exceptionnellement pas assurer la séance prévue.', en: 'The Studio is exceptionally unable to provide the scheduled session.' },
  OPERATIONAL_CONSTRAINT: { fr: 'Une contrainte opérationnelle empêche de maintenir cette demande.', en: 'An operational constraint prevents us from maintaining this request.' },
  PAYMENT_UNVERIFIED: { fr: 'Les éléments transmis ne permettent pas de valider le paiement.', en: 'The information provided does not allow us to approve the payment.' },
  PAYMENT_REFERENCE_REQUIRED: { fr: 'Une référence de transaction vérifiable est nécessaire.', en: 'A verifiable transaction reference is required.' },
  PAYMENT_REVIEW_DELAYED: { fr: 'La vérification est temporairement retardée par un contrôle complémentaire.', en: 'Verification is temporarily delayed by an additional review.' },
  REQUEST_DEADLINE_EXPIRED: { fr: 'le délai prévu pour finaliser la demande est dépassé', en: 'the deadline for completing the request has passed' },
  RESCHEDULE_UNAVAILABLE: { fr: 'Le nouveau créneau demandé n’est pas disponible.', en: 'The requested new time slot is not available.' },
  WITHDRAWAL_REQUIREMENTS_NOT_MET: { fr: 'Les conditions applicables à cette demande de rétractation ne sont pas réunies.', en: 'The applicable requirements for this withdrawal request are not met.' },
};

const allowedByContext: Record<CustomerDecisionContext, readonly CustomerReasonCode[]> = {
  RESERVATION_REJECTION: ['SLOT_UNAVAILABLE', 'OPERATIONAL_CONSTRAINT'],
  STUDIO_CANCELLATION: ['STUDIO_UNAVAILABLE', 'OPERATIONAL_CONSTRAINT'],
  RESERVATION_EXPIRATION: ['REQUEST_DEADLINE_EXPIRED'],
  PAYMENT_REJECTION: ['PAYMENT_UNVERIFIED', 'PAYMENT_REFERENCE_REQUIRED'],
  PAYMENT_INFORMATION_REQUEST: ['PAYMENT_REFERENCE_REQUIRED'],
  PAYMENT_VERIFICATION_BLOCKAGE: ['PAYMENT_REVIEW_DELAYED'],
  RESCHEDULE_REJECTION: ['RESCHEDULE_UNAVAILABLE', 'SLOT_UNAVAILABLE'],
  WITHDRAWAL_REJECTION: ['WITHDRAWAL_REQUIREMENTS_NOT_MET'],
};

export type CustomerDecisionCopyInput = { internalReason: string; customerReasonCode: CustomerReasonCode; customerReasonText?: string | null };
export type PersistedCustomerDecisionCopy = { internalReason: string; customerReasonCode: CustomerReasonCode; customerReasonText: string; customerLocale: CustomerLocale; customerCopyVersion: string };
export const normalizeCustomerLocale = (locale: string | null | undefined): CustomerLocale => locale === 'en' ? 'en' : 'fr';

export const resolveCustomerDecisionCopy = (context: CustomerDecisionContext, locale: string | null | undefined, input: CustomerDecisionCopyInput): PersistedCustomerDecisionCopy => {
  const internalReason = input.internalReason.trim();
  const override = input.customerReasonText?.trim() ?? '';
  if (!internalReason) throw new HttpError(400, 'INTERNAL_REASON_REQUIRED', 'Le motif interne est obligatoire.');
  if (!allowedByContext[context].includes(input.customerReasonCode)) throw new HttpError(400, 'CUSTOMER_REASON_CODE_INVALID', 'Le motif client ne correspond pas à cette décision.');
  if (override.length > 280) throw new HttpError(400, 'CUSTOMER_REASON_TEXT_TOO_LONG', 'Le texte client ne peut pas dépasser 280 caractères.');
  const customerLocale = normalizeCustomerLocale(locale);
  return { internalReason, customerReasonCode: input.customerReasonCode, customerReasonText: override || catalogue[input.customerReasonCode][customerLocale], customerLocale, customerCopyVersion: CUSTOMER_COPY_VERSION };
};

export const customerReasonOptions = (context: CustomerDecisionContext, locale: CustomerLocale = 'fr') => allowedByContext[context].map((value) => ({ value, label: catalogue[value][locale] }));
