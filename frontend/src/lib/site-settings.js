/**
 * Published studio settings and content, read once per page load.
 *
 * The compiled fallbacks below are the values that were hard-coded in the bundle
 * before Phase 6. They matter for more than convenience: if the API is unreachable the
 * public site must still render a correct phone number rather than an empty link.
 */
export const SETTINGS_FALLBACK = Object.freeze({
  identity: {
    publicName: 'Golden Studio Plus',
    addressLine: 'Douala, Cameroun',
    phoneE164: '+237673026654',
    phoneDisplay: '+237 673 026 654',
    email: 'info@gsplus.vip',
    whatsappEnabled: true,
    instagramUrl: 'https://www.instagram.com/goldenstudioplus/',
    facebookUrl: 'https://www.facebook.com/people/Golden-Studio-Plus/61574353412752/',
    linkedinUrl: '',
  },
  payment: {
    instructionsFr: 'via MTN MoMo ou Orange Money à notre numéro de réception.',
    instructionsEn: 'via MTN MoMo or Orange Money to our receiving number.',
  },
  features: { contactFormEnabled: true, quoteFormEnabled: true, b2bFormEnabled: true },
});

export const CONTENT_FALLBACK = Object.freeze({
  'contact.hours': {
    weekdaysLabel: 'Du lundi au samedi :',
    weekdaysValue: '9 h - 18 h',
    sundayLabel: 'Dimanche :',
    sundayValue: 'Fermé, sauf rendez-vous VIP préalable',
  },
});

/** A phone number is a link target, so non-digits are stripped for wa.me and tel:. */
export const whatsappLink = (phoneE164, text) => {
  const digits = String(phoneE164 || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};

export const telLink = (phoneE164) => {
  const trimmed = String(phoneE164 || '').trim();
  return trimmed ? `tel:${trimmed}` : null;
};

const deepMerge = (fallback, incoming) => {
  if (!incoming || typeof incoming !== 'object') return fallback;
  const merged = { ...fallback };
  for (const [group, values] of Object.entries(incoming)) {
    merged[group] = values && typeof values === 'object' && !Array.isArray(values)
      ? { ...(fallback[group] ?? {}), ...values }
      : values;
  }
  return merged;
};

export const mergeSettings = (incoming) => deepMerge(SETTINGS_FALLBACK, incoming);
export const mergeContent = (incoming) => deepMerge(CONTENT_FALLBACK, incoming);
