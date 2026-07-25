const LABELS = {
  PENDING_CONFIRMATION: 'En attente de confirmation',
  CONFIRMED: 'Confirmée',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  NO_SHOW: 'Client absent',
  REJECTED: 'Refusée',
  EXPIRED: 'Expirée',
  PENDING: 'En attente',
  PROCESSING: 'Traitement en cours',
  VERIFIED: 'Vérifié',
  FAILED: 'Échec',
  REFUND_PENDING: 'Remboursement en attente',
  REFUNDED: 'Remboursé',
  NEW: 'Nouveau',
  IN_PROGRESS: 'En cours',
  WON: 'Gagné',
  LOST: 'Perdu',
  ARCHIVED: 'Archivé',
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  SENT: 'Envoyé',
  SYNCED: 'Synchronisé',
  UPDATED: 'Mis à jour',
  DELETED: 'Supprimé',
  SKIPPED: 'Ignoré',
  CONTACT: 'Contact',
  B2B: 'Entreprise',
  QUOTE: 'Demande de devis',
  ADMIN: 'Administrateur',
  CUSTOMER: 'Client',
  SYSTEM: 'Système',
  AUCUN: 'Aucun',
  'AUCUN PAIEMENT': 'Aucun paiement',
};

const RESERVATION_ACTIONS = {
  PENDING_CONFIRMATION: [
    { status: 'CONFIRMED', label: 'Confirmer' },
    { status: 'CANCELLED', label: 'Annuler', requiresReason: true, destructive: true },
    { status: 'REJECTED', label: 'Refuser', requiresReason: true, destructive: true },
    { status: 'EXPIRED', label: 'Marquer expirée', requiresReason: true },
  ],
  CONFIRMED: [
    { status: 'COMPLETED', label: 'Marquer terminée' },
    { status: 'NO_SHOW', label: 'Client absent', requiresReason: true },
    { status: 'CANCELLED', label: 'Annuler', requiresReason: true, destructive: true },
  ],
  CANCELLED: [{ status: 'PENDING_CONFIRMATION', label: 'Restaurer', requiresReason: true }],
  REJECTED: [{ status: 'PENDING_CONFIRMATION', label: 'Restaurer', requiresReason: true }],
  EXPIRED: [{ status: 'PENDING_CONFIRMATION', label: 'Restaurer', requiresReason: true }],
  COMPLETED: [],
  NO_SHOW: [],
};

export const statusLabel = (status) => LABELS[status] || String(status || '—').replaceAll('_', ' ');

export const reservationActions = (status) => RESERVATION_ACTIONS[status] || [];

export const transitionActorLabel = (transition) =>
  transition?.adminUser?.name || statusLabel(transition?.actorType || 'SYSTEM');

export const packageReferenceCount = (pack) =>
  Number(pack?._count?.reservations || 0) + Number(pack?._count?.reservationIntents || 0);
