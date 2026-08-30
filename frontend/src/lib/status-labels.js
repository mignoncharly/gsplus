export const STATUS_LABELS = Object.freeze({
  PENDING_CONFIRMATION: 'En attente de confirmation',
  CONFIRMED: 'Confirmée',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  NO_SHOW: 'Client absent',
  REJECTED: 'Refusée',
  EXPIRED: 'Expirée',
  PENDING: 'En attente',
  NOT_REQUIRED: 'Non requise',
  SYNCING: 'Synchronisation en cours',
  RETRYING: 'Nouvelle tentative planifiée',
  PAYMENT_INFO_REQUIRED: 'Information de paiement requise',
  VERIFICATION_BLOCKED: 'Vérification temporairement bloquée',
  PROCESSING: 'Traitement en cours',
  VERIFIED: 'Vérifié',
  PAID: 'Payé',
  FAILED: 'Échec',
  REFUND_PENDING: 'Remboursement en attente',
  REFUNDED: 'Remboursé',
  NEW: 'Nouveau',
  IN_PROGRESS: 'En cours',
  HANDLED: 'Traité',
  // Kept only so historical rows stay readable; nothing writes these any more.
  WON: 'Gagné',
  LOST: 'Perdu',
  DRAFT: 'Brouillon',
  VALIDATED: 'Mentions validées',
  PUBLISHED: 'Publié',
  ARCHIVED: 'Archivé',
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  AVAILABLE: 'Disponible',
  ACCEPTED: 'Acceptée',
  SENT: 'Envoyé',
  SYNCED: 'Synchronisé',
  UPDATED: 'Mis à jour',
  DELETED: 'Supprimé',
  SKIPPED: 'Ignoré',
  OPEN: 'Ouvert',
  READ: 'Lu',
  CONTACT: 'Contact',
  B2B: 'Entreprise',
  QUOTE: 'Demande de devis',
  CREATIVE: 'Service créatif',
  OWNER: 'Propriétaire',
  STAFF: 'Collaborateur',
  ADMIN: 'Administrateur',
  CUSTOMER: 'Client',
  STUDIO: 'Studio',
  SYSTEM: 'Système',
  OBSOLETE: 'Obsolète — ne pas renvoyer',
  DUPLICATE: 'Doublon',
  PERMANENTLY_FAILED: 'Échec définitif',
  ACTIONABLE_REVIEW_REQUIRED: 'Examen requis avant renvoi',
  REPLACED: 'Remplacée par une autre notification',
  UNCLASSIFIED: 'Non classée',
  AUCUN: 'Aucun',
  'AUCUN PAIEMENT': 'Aucun paiement',
});

export const PAYMENT_METHOD_LABELS = Object.freeze({ mtn_momo: 'MTN MoMo', orange_money: 'Orange Money' });

export const paymentMethodLabel = (method) => PAYMENT_METHOD_LABELS[String(method || '').trim()] || 'Mode non communiqué';

const warnedCodes = new Set();

/**
 * `STATUS_LABELS` covers status enums only. Routing any other value through it
 * produces "Statut non reconnu", which is what ADM-07 and ADM-08 reported. This
 * warns once per unknown code during development so a missing entry surfaces at
 * the point of use instead of in the interface.
 */
const warnUnknownCode = (registry, code) => {
  if (!import.meta.env?.DEV) return;
  const key = `${registry}:${code}`;
  if (warnedCodes.has(key)) return;
  warnedCodes.add(key);
  console.warn(`[status-labels] "${code}" is absent from ${registry}. Add it in frontend/src/lib/status-labels.js, or use the registry that matches this value.`);
};

export const statusLabel = (status) => {
  const code = String(status || '').trim();
  if (!code) return '—';
  if (!STATUS_LABELS[code]) warnUnknownCode('STATUS_LABELS', code);
  return STATUS_LABELS[code] || 'Statut non reconnu';
};

export const NOTIFICATION_AUDIENCE_LABELS = Object.freeze({
  CLIENT: 'Client',
  INTERNAL: 'Interne',
  FINANCIAL: 'Financier',
});

const clientMessage = (name, trigger) => ({ name, trigger, audience: 'CLIENT' });
const internalMessage = (name, trigger) => ({ name, trigger, audience: 'INTERNAL' });
const financialMessage = (name, trigger) => ({ name, trigger, audience: 'FINANCIAL' });

/**
 * Business names for `NotificationEvent.type`, which is a snake_case outbox code
 * and never a status enum. Keys must stay in step with the `type:` values queued
 * in backend/src/emails/notifications.ts, delivery-notifications.ts,
 * email-delivery-reports.ts and services/integrity-incidents.ts.
 */
export const NOTIFICATION_TYPE_LABELS = Object.freeze({
  booking_received_customer: clientMessage('Demande de réservation reçue', 'Le client vient d’envoyer sa demande.'),
  payment_added_customer: clientMessage('Paiement enregistré', 'Le client a déclaré une référence de paiement.'),
  payment_verified_customer: clientMessage('Paiement vérifié', 'Le Studio a vérifié le paiement déclaré.'),
  reschedule_request_received_customer: clientMessage('Demande de report reçue', 'Le client a demandé un nouveau créneau.'),
  reschedule_request_rejected_customer: clientMessage('Report refusé', 'Le Studio a refusé le nouveau créneau demandé.'),
  booking_change_deadline_reminder_customer: clientMessage('Rappel — échéance de modification', 'L’échéance de modification de la séance approche.'),
  booking_24h_reminder_customer: clientMessage('Rappel — séance dans 24 heures', 'La séance a lieu le lendemain.'),
  deliverables_available_customer: clientMessage('Livrables disponibles', 'Le Studio a publié les livrables de la séance.'),
  lead_received_customer: clientMessage('Accusé de réception de la demande', 'Le client a envoyé un formulaire public.'),
  booking_confirmed_customer: clientMessage('Réservation confirmée', 'Le Studio a confirmé la réservation.'),
  booking_rejected_customer: clientMessage('Réservation refusée', 'Le Studio a refusé la demande de réservation.'),
  booking_expired_customer: clientMessage('Demande expirée', 'La demande n’a pas été décidée dans le délai prévu.'),
  booking_no_show_customer: clientMessage('Absence constatée', 'Le client ne s’est pas présenté à la séance.'),
  booking_completed_followup_customer: clientMessage('Séance terminée — suivi', 'La séance est terminée et les prochaines étapes sont communiquées.'),
  booking_rescheduled_customer: clientMessage('Nouvel horaire confirmé', 'Le report demandé a été accepté et le créneau déplacé.'),
  booking_cancelled_by_studio_customer: clientMessage('Annulation par le Studio', 'Le Studio a dû annuler la séance.'),
  booking_cancelled_customer_refund: clientMessage('Annulation — remboursement à traiter', 'Le client a annulé et un remboursement est applicable.'),
  booking_cancelled_customer_no_refund: clientMessage('Annulation — sans remboursement', 'Le client a annulé et aucun remboursement n’est applicable.'),
  payment_info_required_customer: clientMessage('Information de paiement requise', 'Le paiement déclaré est incomplet ou illisible.'),
  payment_rejected_customer: clientMessage('Paiement rejeté', 'Le paiement déclaré a été rejeté après vérification.'),
  payment_verification_blocked_customer: clientMessage('Vérification de paiement bloquée', 'La vérification du paiement est temporairement bloquée.'),
  refund_engaged_customer: clientMessage('Remboursement engagé', 'L’opération de remboursement a été engagée auprès de l’opérateur.'),
  refund_completed_customer: clientMessage('Remboursement effectué', 'L’opération de remboursement est finalisée.'),

  booking_received_admin: internalMessage('Nouvelle réservation à traiter', 'Une réservation vient d’être créée.'),
  payment_added_admin: internalMessage('Paiement à vérifier', 'Une référence de paiement a été ajoutée à un dossier.'),
  reschedule_request_review_admin: internalMessage('Demande de report à décider', 'Un client demande un nouveau créneau.'),
  reservation_decision_overdue_admin: internalMessage('Dossier sans décision', 'Un dossier attend une décision au-delà du délai prévu.'),
  daily_operations_digest_admin: internalMessage('Récapitulatif opérationnel quotidien', 'Envoi programmé une fois par jour.'),
  lead_created_admin: internalMessage('Nouvelle demande reçue', 'Un formulaire public vient d’être soumis.'),
  calendar_sync_failed_admin: internalMessage('Échec de synchronisation Cal.com', 'L’événement calendrier n’a pas pu être créé.'),
  whatsapp_delivery_failed_admin: internalMessage('WhatsApp non livré', 'Le message n’a pas été livré après les reprises prévues.'),
  email_permanent_bounce_admin: internalMessage('E-mail client non distribué', 'L’adresse du client a rejeté définitivement l’envoi.'),
  data_integrity_incident_admin: internalMessage('Incohérence de données client', 'Un dossier risque d’utiliser l’identité d’un autre client.'),
  message_template_test_admin: internalMessage('Test de modèle de message', 'Un administrateur a demandé un envoi de test depuis la bibliothèque.'),

  refund_action_required_admin: financialMessage('Remboursement à traiter', 'Une opération de remboursement doit être engagée ou reprise.'),
  cancellation_financial_action_required_admin: financialMessage('Annulation — action financière', 'Une annulation payée exige un traitement financier.'),
});

const humanisedNotificationType = (code) => {
  const words = code.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Always returns something an operator can read. An unregistered code degrades to
 * a humanised form and an audience inferred from its suffix rather than to
 * "Statut non reconnu", so a new backend message stays comprehensible until its
 * entry lands here.
 */
export const notificationTypeDescriptor = (type) => {
  const code = String(type || '').trim();
  if (!code) return { code: '', name: '—', audience: null, trigger: '', isRegistered: false };

  const registered = NOTIFICATION_TYPE_LABELS[code];
  if (registered) return { code, ...registered, isRegistered: true };

  warnUnknownCode('NOTIFICATION_TYPE_LABELS', code);
  return {
    code,
    name: humanisedNotificationType(code),
    audience: code.endsWith('_admin') ? 'INTERNAL' : code.endsWith('_customer') ? 'CLIENT' : null,
    trigger: '',
    isRegistered: false,
  };
};

export const notificationTypeLabel = (type) => notificationTypeDescriptor(type).name;
