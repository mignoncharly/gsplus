const copyFor = (locale = 'fr') => locale === 'en' ? {
  loadingPackages: 'Packages are loading.', noPackages: 'No package can currently be booked.', choosePackage: 'Choose a package to continue.', checkingSlot: 'The time slot is being checked.', chooseDay: 'Choose a day.', chooseTime: 'Choose an available time.', verifySlot: 'Verify the selected time slot.', saving: 'Booking is being saved.', paymentBoth: 'Enter the payment phone number and reference.', paymentPhone: 'Enter the phone number used for payment.', transaction: 'Enter the transaction reference received by SMS.',
} : {
  loadingPackages: 'Chargement des formules en cours.', noPackages: 'Aucune formule réservable actuellement.', choosePackage: 'Choisissez une formule pour continuer.', checkingSlot: 'Vérification du créneau en cours.', chooseDay: 'Choisissez un jour.', chooseTime: 'Choisissez un horaire disponible.', verifySlot: 'Vérifiez le créneau choisi.', saving: 'Enregistrement de la réservation en cours.', paymentBoth: 'Renseignez le téléphone et la référence de paiement.', paymentPhone: 'Renseignez le téléphone utilisé pour le paiement.', transaction: 'Renseignez la référence de transaction reçue par SMS.',
};

export const packageSelectionDisabledReason = ({ loading, packageCount, packageId, locale }) => {
  const copy = copyFor(locale);
  if (packageId) return '';
  if (loading) return copy.loadingPackages;
  if (packageCount === 0) return copy.noPackages;
  return copy.choosePackage;
};

export const slotSelectionDisabledReason = ({ date, time, checking, verified, locale }) => {
  const copy = copyFor(locale);
  if (checking) return copy.checkingSlot;
  if (!date) return copy.chooseDay;
  if (!time) return copy.chooseTime;
  if (!verified) return copy.verifySlot;
  return '';
};

export const paymentSubmissionDisabledReason = ({ submitting, paymentChoice, paymentPhone, transactionId, locale }) => {
  const copy = copyFor(locale);
  if (submitting) return copy.saving;
  if (paymentChoice !== 'base') return '';
  if (!paymentPhone && !transactionId) return copy.paymentBoth;
  if (!paymentPhone) return copy.paymentPhone;
  if (!transactionId) return copy.transaction;
  return '';
};
