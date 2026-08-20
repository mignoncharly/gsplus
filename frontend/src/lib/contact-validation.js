const messagesFor = (locale = 'fr') => locale === 'en'
  ? { phoneInvalid: 'Enter a valid Cameroon phone number, for example 640 70 32 49.', phoneWhatsAppRequired: 'Enter a Cameroon phone number to receive information on WhatsApp.', emailInvalid: 'Enter a valid email address.' }
  : { phoneInvalid: 'Saisissez un numéro camerounais valide, par exemple 640 70 32 49.', phoneWhatsAppRequired: 'Renseignez un téléphone camerounais pour recevoir les informations sur WhatsApp.', emailInvalid: 'Saisissez une adresse e-mail valide.' };

export const PHONE_INVALID_MESSAGE = messagesFor().phoneInvalid;
export const PHONE_WHATSAPP_REQUIRED_MESSAGE = messagesFor().phoneWhatsAppRequired;
export const EMAIL_INVALID_MESSAGE = messagesFor().emailInvalid;

const CAMEROON_NATIONAL_PATTERN = /^[26]\d{8}$/;
const PHONE_INPUT_PATTERN = /^[0-9+().\- \t]+$/;

export const normalizeCameroonPhone = (value = '') => {
  const trimmed = String(value).trim();
  if (!trimmed || !PHONE_INPUT_PATTERN.test(trimmed)) return null;
  const compact = trimmed.replace(/[().\- \t]/g, '');
  const national = compact.startsWith('+237')
    ? compact.slice(4)
    : compact.startsWith('00237')
      ? compact.slice(5)
      : compact;
  return CAMEROON_NATIONAL_PATTERN.test(national) ? `+237${national}` : null;
};

export const isValidCameroonPhone = (value) => normalizeCameroonPhone(value) !== null;

export const normalizeEmailAddress = (value = '') => {
  const trimmed = String(value).trim();
  const separator = trimmed.lastIndexOf('@');
  if (separator <= 0) return trimmed;
  return `${trimmed.slice(0, separator)}@${trimmed.slice(separator + 1).toLowerCase()}`;
};

export const isValidEmailAddress = (value) => {
  const normalized = normalizeEmailAddress(value);
  if (!normalized || normalized.length > 254 || /\s/.test(normalized)) return false;
  const parts = normalized.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
  const labels = domain.split('.');
  return labels.length >= 2 && labels.every((label) =>
    label.length > 0 && label.length <= 63 && /^[A-Za-z0-9-]+$/.test(label) &&
    !label.startsWith('-') && !label.endsWith('-'));
};

export const validateContactFields = ({
  phone = '',
  email = '',
  phoneRequired = false,
  emailRequired = false,
  whatsappConsent = false,
  locale = 'fr',
} = {}) => {
  const errors = {};
  const messages = messagesFor(locale);
  const trimmedPhone = String(phone).trim();
  const trimmedEmail = String(email).trim();

  if (!trimmedPhone && whatsappConsent) errors.phone = messages.phoneWhatsAppRequired;
  else if ((!trimmedPhone && phoneRequired) || (trimmedPhone && !isValidCameroonPhone(trimmedPhone))) {
    errors.phone = messages.phoneInvalid;
  }

  if ((!trimmedEmail && emailRequired) || (trimmedEmail && !isValidEmailAddress(trimmedEmail))) {
    errors.email = messages.emailInvalid;
  }

  return errors;
};

export { validationErrorsFromApi } from './form-errors.js';
