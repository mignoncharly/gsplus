export const FRENCH_VALIDATION_SUMMARY = 'Corrigez les champs indiqués ci-dessous.';

const FIELD_COPY = {
  name: { label: 'Le nom', required: 'Renseignez votre nom.' },
  firstName: { label: 'Le prénom', required: 'Renseignez votre prénom.' },
  lastName: { label: 'Le nom', required: 'Renseignez votre nom.' },
  email: { label: 'L’adresse e-mail', required: 'Renseignez votre adresse e-mail.' },
  phone: { label: 'Le numéro de téléphone', required: 'Renseignez votre numéro de téléphone.' },
  paymentPhone: { label: 'Le numéro de paiement', required: 'Renseignez le numéro utilisé pour le paiement.' },
  message: { label: 'Le message', required: 'Renseignez votre message.' },
  company: { label: 'L’entreprise', required: 'Renseignez le nom de l’entreprise.' },
  rccm: { label: 'Le RCCM', required: 'Renseignez le numéro RCCM.' },
  packageId: { label: 'La formule', required: 'Sélectionnez une formule.' },
  packageName: { label: 'La prestation', required: 'Sélectionnez une prestation.' },
  service: { label: 'La prestation', required: 'Sélectionnez une prestation.' },
  gender: { label: 'Le genre', required: 'Sélectionnez votre genre.' },
  acceptedTerms: { label: 'Les conditions', required: 'Vous devez accepter les conditions générales.' },
  acceptedPrivacy: { label: 'La politique de confidentialité', required: 'Vous devez confirmer avoir lu la politique de confidentialité.' },
  consentImage: { label: 'L’autorisation d’image', required: 'Indiquez votre choix concernant l’utilisation des images.' },
  transactionRef: { label: 'La référence de transaction', required: 'Renseignez la référence de transaction.' },
  paymentMethod: { label: 'Le moyen de paiement', required: 'Sélectionnez un moyen de paiement.' },
  date: { label: 'La date', required: 'Sélectionnez une date.' },
  startAt: { label: 'L’heure de début', required: 'Sélectionnez une heure de début.' },
  endAt: { label: 'L’heure de fin', required: 'Sélectionnez une heure de fin.' },
};

const looksFrench = (message) =>
  /[àâçéèêëîïôûùüÿœ]|\b(renseignez|sélectionnez|acceptez|doit|invalide|requis|caractères|numéro|adresse)\b/i.test(message);

const copyFor = (path) => {
  const key = String(path || '').split('.').at(-1);
  return FIELD_COPY[key] || { label: 'Ce champ', required: 'Renseignez ce champ.' };
};

const localizeDetail = (detail) => {
  const copy = copyFor(detail.path);
  const original = String(detail.message || '').trim();

  if (original && looksFrench(original)) return original;
  if (detail.code === 'invalid_type') return copy.required;
  if (detail.code === 'invalid_value') {
    if (String(detail.path || '').endsWith('acceptedTerms')) return FIELD_COPY.acceptedTerms.required;
    if (String(detail.path || '').endsWith('acceptedPrivacy')) return FIELD_COPY.acceptedPrivacy.required;
    return copy.label + ' est invalide.';
  }
  if (detail.code === 'too_small') {
    if (detail.minimum === undefined || Number(detail.minimum) <= 1) return copy.required;
    return copy.label + ' doit contenir au moins ' + Number(detail.minimum) + ' caractères.';
  }
  if (detail.code === 'too_big') {
    if (detail.maximum !== undefined) return copy.label + ' ne doit pas dépasser ' + Number(detail.maximum) + ' caractères.';
    return copy.label + ' est trop long.';
  }
  if (detail.code === 'invalid_format') {
    if (detail.format === 'email' || String(detail.path || '').endsWith('email')) return 'Saisissez une adresse e-mail valide.';
    if (detail.format === 'date' || detail.format === 'datetime') return 'Saisissez une date valide.';
    return copy.label + ' a un format invalide.';
  }
  return copy.label + ' est invalide.';
};

export const validationErrorsFromApi = (error, fieldMap = {}) => {
  if ((error?.code && error.code !== 'VALIDATION_ERROR') || !Array.isArray(error?.details)) return {};

  return error.details.reduce((errors, detail) => {
    const field = Object.keys(fieldMap).length === 0 ? detail.path : fieldMap[detail.path];
    if (!field || errors[field]) return errors;
    errors[field] = localizeDetail(detail);
    return errors;
  }, {});
};

export const validationSummaryForApiError = (error) =>
  error?.code === 'VALIDATION_ERROR' ? FRENCH_VALIDATION_SUMMARY : error?.message;
