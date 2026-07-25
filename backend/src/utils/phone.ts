const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export const normalizeE164Phone = (value: string) => {
  const compact = value.trim().replace(/[^\d+]/g, '');
  const normalized =
    compact.startsWith('+')
      ? `+${compact.slice(1).replace(/\D/g, '')}`
      : compact.startsWith('00')
        ? `+${compact.slice(2).replace(/\D/g, '')}`
        : compact.replace(/\D/g, '').length === 9
          ? `+237${compact.replace(/\D/g, '')}`
          : `+${compact.replace(/\D/g, '')}`;

  return normalized;
};

export const isE164Phone = (value: string) => E164_PATTERN.test(value);
