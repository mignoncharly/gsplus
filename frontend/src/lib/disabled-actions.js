export const packageSelectionDisabledReason = ({ loading, packageCount, packageId }) => {
  if (packageId) return '';
  if (loading) return 'Chargement des formules en cours.';
  if (packageCount === 0) return 'Aucune formule réservable actuellement.';
  return 'Choisissez une formule pour continuer.';
};

export const slotSelectionDisabledReason = ({ date, time, checking, verified }) => {
  if (checking) return 'Vérification du créneau en cours.';
  if (!date) return 'Choisissez un jour.';
  if (!time) return 'Choisissez un horaire disponible.';
  if (!verified) return 'Vérifiez le créneau choisi.';
  return '';
};

export const paymentSubmissionDisabledReason = ({ submitting, paymentChoice, paymentPhone, transactionId }) => {
  if (submitting) return 'Enregistrement de la réservation en cours.';
  if (paymentChoice !== 'base') return '';
  if (!paymentPhone && !transactionId) {
    return 'Renseignez le téléphone et la référence de paiement.';
  }
  if (!paymentPhone) return 'Renseignez le téléphone utilisé pour le paiement.';
  if (!transactionId) return 'Renseignez la référence de transaction reçue par SMS.';
  return '';
};
