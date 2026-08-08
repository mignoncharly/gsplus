export type ValidationIssue = {
  code?: string;
  path?: ReadonlyArray<PropertyKey>;
  message?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  format?: string;
};

const FIELD_COPY: Record<string, { label: string; required: string }> = {
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
  acceptedTerms: { label: 'Les conditions', required: 'Vous devez accepter les conditions générales et la politique de confidentialité.' },
  consentImage: { label: 'L’autorisation d’image', required: 'Indiquez votre choix concernant l’utilisation des images.' },
  transactionRef: { label: 'La référence de transaction', required: 'Renseignez la référence de transaction.' },
  paymentMethod: { label: 'Le moyen de paiement', required: 'Sélectionnez un moyen de paiement.' },
  date: { label: 'La date', required: 'Sélectionnez une date.' },
  startAt: { label: 'L’heure de début', required: 'Sélectionnez une heure de début.' },
  endAt: { label: 'L’heure de fin', required: 'Sélectionnez une heure de fin.' },
};

const CUSTOM_MESSAGES: Record<string, string> = {
  'endAt must be after startAt': 'L’heure de fin doit être postérieure à l’heure de début.',
  'to must be greater than or equal to from': 'La date de fin doit être postérieure ou égale à la date de début.',
  'Availability range cannot exceed 60 days': 'La période de disponibilité ne peut pas dépasser 60 jours.',
  'At least one field must be provided': 'Modifiez au moins un champ avant de continuer.',
};

const looksFrench = (message: string) =>
  /[àâçéèêëîïôûùüÿœ]|\b(renseignez|sélectionnez|acceptez|doit|invalide|requis|caractères|numéro|adresse)\b/i.test(message);

const fieldName = (issue: ValidationIssue) => String(issue.path?.at(-1) ?? 'champ');

const fieldCopy = (issue: ValidationIssue) => {
  const key = fieldName(issue);
  return FIELD_COPY[key] ?? { label: 'Ce champ', required: 'Renseignez ce champ.' };
};

const numericLimit = (value: number | bigint | undefined) =>
  typeof value === 'bigint' ? Number(value) : value;

export const formatValidationIssues = (issues: ReadonlyArray<ValidationIssue>) =>
  issues.map((issue) => {
    const details: Record<string, unknown> = {
      path: issue.path?.map(String).join('.') ?? '',
      code: issue.code,
      message: localizeValidationIssue(issue),
    };

    if (issue.minimum !== undefined) details.minimum = Number(issue.minimum);
    if (issue.maximum !== undefined) details.maximum = Number(issue.maximum);
    if (issue.format !== undefined) details.format = issue.format;

    return details;
  });

export const localizeValidationIssue = (issue: ValidationIssue): string => {
  const copy = fieldCopy(issue);
  const original = issue.message?.trim() ?? '';
  const minimum = numericLimit(issue.minimum);
  const maximum = numericLimit(issue.maximum);

  if (CUSTOM_MESSAGES[original]) return CUSTOM_MESSAGES[original];
  if (original && looksFrench(original)) return original;

  if (issue.code === 'invalid_type') return copy.required;
  if (issue.code === 'invalid_value') {
    if (fieldName(issue) === 'acceptedTerms') return FIELD_COPY.acceptedTerms.required;
    return copy.label + ' est invalide.';
  }
  if (issue.code === 'too_small') {
    if (minimum === undefined || minimum <= 1) return copy.required;
    return copy.label + ' doit contenir au moins ' + minimum + ' caractères.';
  }
  if (issue.code === 'too_big') {
    if (maximum !== undefined) return copy.label + ' ne doit pas dépasser ' + maximum + ' caractères.';
    return copy.label + ' est trop long.';
  }
  if (issue.code === 'invalid_format') {
    if (issue.format === 'email' || fieldName(issue) === 'email') return 'Saisissez une adresse e-mail valide.';
    if (issue.format === 'date' || issue.format === 'datetime') return 'Saisissez une date valide.';
    return copy.label + ' a un format invalide.';
  }

  return copy.label + ' est invalide.';
};
