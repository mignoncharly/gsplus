const CAMEROON_COUNTRY_CODE = '237';
const CAMEROON_NATIONAL_PATTERN = /^[26]\d{8}$/;
const PHONE_INPUT_PATTERN = /^[0-9+().\- \t]+$/;

const compactPhone = (value: string) => value.trim().replace(/[().\- \t]/g, '');

export const normalizeCameroonPhone = (value: string) => {
  if (!value || !PHONE_INPUT_PATTERN.test(value.trim())) return null;
  const compact = compactPhone(value);
  const national = compact.startsWith(`+${CAMEROON_COUNTRY_CODE}`)
    ? compact.slice(4)
    : compact.startsWith(`00${CAMEROON_COUNTRY_CODE}`)
      ? compact.slice(5)
      : compact;

  if (!CAMEROON_NATIONAL_PATTERN.test(national)) return null;
  return `+${CAMEROON_COUNTRY_CODE}${national}`;
};

export const isValidCameroonPhone = (value: string) => normalizeCameroonPhone(value) !== null;

export const normalizeEmailAddress = (value: string) => {
  const trimmed = value.trim();
  const separator = trimmed.lastIndexOf('@');
  if (separator <= 0) return trimmed;
  return `${trimmed.slice(0, separator)}@${trimmed.slice(separator + 1).toLowerCase()}`;
};

export const isValidEmailAddress = (value: string) => {
  const normalized = normalizeEmailAddress(value);
  if (!normalized || normalized.length > 254 || /\s/.test(normalized)) return false;
  const parts = normalized.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  return labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[A-Za-z0-9-]+$/.test(label) &&
      !label.startsWith('-') &&
      !label.endsWith('-'),
  );
};
