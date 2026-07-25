export type SupportedPaymentMethod = 'mtn_momo' | 'orange_money';

export const normalizePaymentReference = (value: string | null | undefined) => {
  const normalized = value?.trim().replaceAll(/\s+/g, '').toUpperCase();
  return normalized || null;
};

const rules: Record<SupportedPaymentMethod, { label: string; min: number; max: number }> = {
  mtn_momo: { label: 'MTN MoMo', min: 8, max: 32 },
  orange_money: { label: 'Orange Money', min: 8, max: 32 },
};

export const paymentReferenceValidationMessage = (
  method: SupportedPaymentMethod | null | undefined,
  value: string | null | undefined,
) => {
  if (!method) return 'A supported payment method is required.';
  const rule = rules[method];
  if (!rule) return 'A supported payment method is required.';
  const normalized = normalizePaymentReference(value);
  if (!normalized) return `The ${rule.label} transaction reference is required.`;
  if (normalized.length < rule.min || normalized.length > rule.max) {
    return `The ${rule.label} transaction reference must contain ${rule.min} to ${rule.max} characters.`;
  }
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(normalized)) {
    return `The ${rule.label} transaction reference may contain only letters, digits and hyphens.`;
  }
  if (!/[0-9]/.test(normalized)) {
    return `The ${rule.label} transaction reference must contain at least one digit.`;
  }

  return null;
};

export const isValidPaymentReference = (
  method: SupportedPaymentMethod | null | undefined,
  value: string | null | undefined,
) => paymentReferenceValidationMessage(method, value) === null;
