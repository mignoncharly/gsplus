export const PUBLIC_MEDIA_CATEGORIES = [
  'Portrait',
  'Couple',
  'Maternité',
  'Corporate',
  'Famille',
  'Événementiel',
] as const;

export type PublicMediaCategory = (typeof PUBLIC_MEDIA_CATEGORIES)[number];
