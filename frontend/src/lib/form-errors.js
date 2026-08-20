export const FRENCH_VALIDATION_SUMMARY = 'Corrigez les champs indiqués ci-dessous.';
export const ENGLISH_VALIDATION_SUMMARY = 'Please correct the fields highlighted below.';

const FIELD_COPY = {
  fr: {
    name: { label: 'Le nom', required: 'Renseignez votre nom.' }, firstName: { label: 'Le prénom', required: 'Renseignez votre prénom.' }, lastName: { label: 'Le nom', required: 'Renseignez votre nom.' }, email: { label: 'L’adresse e-mail', required: 'Renseignez votre adresse e-mail.' }, phone: { label: 'Le numéro de téléphone', required: 'Renseignez votre numéro de téléphone.' }, paymentPhone: { label: 'Le numéro de paiement', required: 'Renseignez le numéro utilisé pour le paiement.' }, message: { label: 'Le message', required: 'Renseignez votre message.' }, company: { label: 'L’entreprise', required: 'Renseignez le nom de l’entreprise.' }, rccm: { label: 'Le RCCM', required: 'Renseignez le numéro RCCM.' }, packageId: { label: 'La formule', required: 'Sélectionnez une formule.' }, packageName: { label: 'La prestation', required: 'Sélectionnez une prestation.' }, service: { label: 'La prestation', required: 'Sélectionnez une prestation.' }, gender: { label: 'Le genre', required: 'Sélectionnez votre genre.' }, acceptedTerms: { label: 'Les conditions', required: 'Vous devez accepter les conditions générales.' }, acceptedPrivacy: { label: 'La politique de confidentialité', required: 'Vous devez confirmer avoir lu la politique de confidentialité.' }, consentImage: { label: 'L’autorisation d’image', required: 'Indiquez votre choix concernant l’utilisation des images.' }, transactionRef: { label: 'La référence de transaction', required: 'Renseignez la référence de transaction.' }, paymentMethod: { label: 'Le moyen de paiement', required: 'Sélectionnez un moyen de paiement.' }, date: { label: 'La date', required: 'Sélectionnez une date.' }, startAt: { label: 'L’heure de début', required: 'Sélectionnez une heure de début.' }, endAt: { label: 'L’heure de fin', required: 'Sélectionnez une heure de fin.' },
  },
  en: {
    name: { label: 'Name', required: 'Enter your name.' }, firstName: { label: 'First name', required: 'Enter your first name.' }, lastName: { label: 'Last name', required: 'Enter your last name.' }, email: { label: 'Email address', required: 'Enter your email address.' }, phone: { label: 'Phone number', required: 'Enter your phone number.' }, paymentPhone: { label: 'Payment phone number', required: 'Enter the phone number used for payment.' }, message: { label: 'Message', required: 'Enter your message.' }, company: { label: 'Company', required: 'Enter the company name.' }, rccm: { label: 'RCCM', required: 'Enter the RCCM number.' }, packageId: { label: 'Package', required: 'Select a package.' }, packageName: { label: 'Service', required: 'Select a service.' }, service: { label: 'Service', required: 'Select a service.' }, gender: { label: 'Gender', required: 'Select your gender.' }, acceptedTerms: { label: 'Terms', required: 'You must accept the terms and conditions.' }, acceptedPrivacy: { label: 'Privacy policy', required: 'You must confirm that you have read the privacy policy.' }, consentImage: { label: 'Image consent', required: 'Indicate your choice regarding image use.' }, transactionRef: { label: 'Transaction reference', required: 'Enter the transaction reference.' }, paymentMethod: { label: 'Payment method', required: 'Select a payment method.' }, date: { label: 'Date', required: 'Select a date.' }, startAt: { label: 'Start time', required: 'Select a start time.' }, endAt: { label: 'End time', required: 'Select an end time.' },
  },
};

const copyFor = (path, locale = 'fr') => {
  const key = String(path || '').split('.').at(-1);
  const english = locale === 'en';
  return FIELD_COPY[english ? 'en' : 'fr'][key] || (english ? { label: 'This field', required: 'Enter this field.' } : { label: 'Ce champ', required: 'Renseignez ce champ.' });
};

const localizeDetail = (detail, locale = 'fr') => {
  const copy = copyFor(detail.path, locale);
  const original = String(detail.message || '').trim();
  const english = locale === 'en';
  if (!english && original && /[àâçéèêëîïôûùüÿœ]|renseignez|sélectionnez|acceptez|doit|invalide|requis|caractères|numéro|adresse/i.test(original)) return original;
  if (detail.code === 'invalid_type') return copy.required;
  if (detail.code === 'invalid_value') {
    if (String(detail.path || '').endsWith('acceptedTerms')) return copyFor('acceptedTerms', locale).required;
    if (String(detail.path || '').endsWith('acceptedPrivacy')) return copyFor('acceptedPrivacy', locale).required;
    return english ? `${copy.label} is invalid.` : `${copy.label} est invalide.`;
  }
  if (detail.code === 'too_small') {
    if (detail.minimum === undefined || Number(detail.minimum) <= 1) return copy.required;
    return english ? `${copy.label} must contain at least ${Number(detail.minimum)} characters.` : `${copy.label} doit contenir au moins ${Number(detail.minimum)} caractères.`;
  }
  if (detail.code === 'too_big') return detail.maximum !== undefined
    ? (english ? `${copy.label} must not exceed ${Number(detail.maximum)} characters.` : `${copy.label} ne doit pas dépasser ${Number(detail.maximum)} caractères.`)
    : (english ? `${copy.label} is too long.` : `${copy.label} est trop long.`);
  if (detail.code === 'invalid_format') {
    if (detail.format === 'email' || String(detail.path || '').endsWith('email')) return english ? 'Enter a valid email address.' : 'Saisissez une adresse e-mail valide.';
    if (detail.format === 'date' || detail.format === 'datetime') return english ? 'Enter a valid date.' : 'Saisissez une date valide.';
    return english ? `${copy.label} has an invalid format.` : `${copy.label} a un format invalide.`;
  }
  return english ? `${copy.label} is invalid.` : `${copy.label} est invalide.`;
};

export const validationErrorsFromApi = (error, fieldMap = {}, locale = 'fr') => {
  if ((error?.code && error.code !== 'VALIDATION_ERROR') || !Array.isArray(error?.details)) return {};
  return error.details.reduce((errors, detail) => {
    const field = Object.keys(fieldMap).length === 0 ? detail.path : fieldMap[detail.path];
    if (!field || errors[field]) return errors;
    errors[field] = localizeDetail(detail, locale);
    return errors;
  }, {});
};

export const validationSummaryForApiError = (error, locale = 'fr') =>
  error?.code === 'VALIDATION_ERROR' ? (locale === 'en' ? ENGLISH_VALIDATION_SUMMARY : FRENCH_VALIDATION_SUMMARY) : error?.message;
