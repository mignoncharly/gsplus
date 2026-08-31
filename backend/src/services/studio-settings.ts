import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';

/**
 * The eight groups the report asks to be administrable.
 *
 * Each field carries the value that was hard-coded before this phase, so an absent row
 * produces exactly today's behaviour. Nothing is backfilled and nothing is seeded:
 * deploying this changes nothing anyone can see until someone edits a value.
 *
 * Secrets are deliberately absent. Provider tokens stay in the environment; only the
 * flags and the operator-facing text live here.
 */
export type SettingFieldKind = 'text' | 'multiline' | 'url' | 'phone' | 'email' | 'number' | 'boolean';

export type SettingField = {
  key: string;
  label: string;
  kind: SettingFieldKind;
  help?: string;
  default: string | number | boolean;
};

export type SettingGroup = {
  key: string;
  label: string;
  description: string;
  fields: SettingField[];
};

export const SETTING_GROUPS: SettingGroup[] = [
  {
    key: 'identity',
    label: 'Identité',
    description: 'Nom public, coordonnées, réseaux sociaux et bouton WhatsApp.',
    fields: [
      { key: 'publicName', label: 'Nom public', kind: 'text', default: 'Golden Studio Plus' },
      { key: 'addressLine', label: 'Adresse', kind: 'text', default: 'Douala, Cameroun' },
      { key: 'phoneE164', label: 'Téléphone (format +237…)', kind: 'phone', default: '+237673026654',
        help: 'Utilisé pour le lien d’appel, le lien WhatsApp et les données structurées.' },
      { key: 'phoneDisplay', label: 'Téléphone affiché', kind: 'text', default: '+237 673 026 654' },
      { key: 'email', label: 'Adresse e-mail publique', kind: 'email', default: 'info@gsplus.vip' },
      { key: 'whatsappEnabled', label: 'Afficher le bouton WhatsApp', kind: 'boolean', default: true },
      { key: 'instagramUrl', label: 'Instagram', kind: 'url', default: 'https://www.instagram.com/goldenstudioplus/' },
      { key: 'facebookUrl', label: 'Facebook', kind: 'url', default: 'https://www.facebook.com/people/Golden-Studio-Plus/61574353412752/' },
      { key: 'linkedinUrl', label: 'LinkedIn', kind: 'url', default: '' },
    ],
  },
  {
    key: 'payment',
    label: 'Paiement',
    description: 'Numéros mobiles, instructions et délai de vérification annoncé.',
    fields: [
      { key: 'mtnNumber', label: 'Numéro MTN MoMo', kind: 'phone', default: '' },
      { key: 'orangeNumber', label: 'Numéro Orange Money', kind: 'phone', default: '' },
      { key: 'instructionsFr', label: 'Instructions de paiement (FR)', kind: 'multiline',
        default: 'via MTN MoMo ou Orange Money à notre numéro de réception.' },
      { key: 'instructionsEn', label: 'Instructions de paiement (EN)', kind: 'multiline',
        default: 'via MTN MoMo or Orange Money to our receiving number.' },
      { key: 'verificationDelayHours', label: 'Délai de vérification annoncé, en heures', kind: 'number', default: 24 },
    ],
  },
  {
    key: 'booking',
    label: 'Réservation',
    description: 'Textes affichés autour des règles de réservation. Les règles elles-mêmes se modifient dans Planning.',
    fields: [
      { key: 'cancellationNoticeHours', label: 'Préavis d’annulation annoncé, en heures', kind: 'number', default: 48 },
      { key: 'lateArrivalPolicyFr', label: 'Politique de retard (FR)', kind: 'multiline', default: '' },
      { key: 'lateArrivalPolicyEn', label: 'Politique de retard (EN)', kind: 'multiline', default: '' },
    ],
  },
  {
    key: 'delivery',
    label: 'Livraison',
    description: 'Canaux et délais de référence communiqués aux clients.',
    fields: [
      { key: 'channelsFr', label: 'Canaux de livraison (FR)', kind: 'multiline', default: '' },
      { key: 'channelsEn', label: 'Canaux de livraison (EN)', kind: 'multiline', default: '' },
      { key: 'referenceDelayDays', label: 'Délai de référence, en jours', kind: 'number', default: 0 },
    ],
  },
  {
    key: 'legal',
    label: 'Juridique',
    description: 'Dates de publication et mentions courtes. Les textes complets restent dans Conformité.',
    fields: [
      { key: 'companyName', label: 'Raison sociale', kind: 'text', default: 'Golden Studio Plus' },
      { key: 'rccm', label: 'RCCM', kind: 'text', default: '' },
      { key: 'lastLegalUpdate', label: 'Dernière mise à jour des textes', kind: 'text', default: '' },
    ],
  },
  {
    key: 'integrations',
    label: 'Intégrations',
    description: 'Activation et état. Les secrets restent dans l’environnement du serveur et ne sont jamais éditables ici.',
    fields: [
      { key: 'calendarEnabled', label: 'Synchronisation Cal.com active', kind: 'boolean', default: true },
      { key: 'emailEnabled', label: 'Envoi d’e-mails actif', kind: 'boolean', default: true },
      { key: 'whatsappEnabled', label: 'Envoi WhatsApp actif', kind: 'boolean', default: false },
    ],
  },
  {
    key: 'seo',
    label: 'SEO',
    description: 'Titres, descriptions et image sociale par défaut.',
    fields: [
      { key: 'defaultTitle', label: 'Titre par défaut', kind: 'text', default: 'Golden Studio Plus | Studio photo premium à Douala' },
      { key: 'defaultDescription', label: 'Description par défaut', kind: 'multiline',
        default: 'Studio photo premium à Douala : portraits, familles, maternité, événements et images corporate, avec une expérience guidée.' },
      { key: 'socialImagePath', label: 'Image sociale', kind: 'text', default: '/images/og-golden-studio-plus-2026.jpg' },
    ],
  },
  {
    key: 'features',
    label: 'Fonctionnalités',
    description: 'Activation contrôlée d’un formulaire ou d’un canal public.',
    fields: [
      { key: 'contactFormEnabled', label: 'Formulaire de contact', kind: 'boolean', default: true },
      { key: 'quoteFormEnabled', label: 'Demande de devis', kind: 'boolean', default: true },
      { key: 'b2bFormEnabled', label: 'Formulaire entreprise', kind: 'boolean', default: true },
    ],
  },
];

const groupByKey = new Map(SETTING_GROUPS.map((group) => [group.key, group]));

export const defaultsFor = (group: SettingGroup) =>
  Object.fromEntries(group.fields.map((field) => [field.key, field.default]));

/** A stored value only overrides a default when its type matches the field's kind. */
const coerce = (field: SettingField, raw: unknown) => {
  if (raw === undefined || raw === null) return field.default;
  if (field.kind === 'boolean') return typeof raw === 'boolean' ? raw : field.default;
  if (field.kind === 'number') return typeof raw === 'number' && Number.isFinite(raw) ? raw : field.default;
  return typeof raw === 'string' ? raw : field.default;
};

export const effectiveGroupValue = (group: SettingGroup, stored: unknown) => {
  const object = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored as Record<string, unknown> : {};
  return Object.fromEntries(group.fields.map((field) => [field.key, coerce(field, object[field.key])]));
};

/** Every group, with stored values layered over the compiled defaults. */
export const getEffectiveSettings = async () => {
  const rows = await prisma.studioSetting.findMany();
  const stored = new Map(rows.map((row) => [row.group, row.value]));
  return Object.fromEntries(SETTING_GROUPS.map((group) => [group.key, effectiveGroupValue(group, stored.get(group.key))]));
};

const MAX_LENGTH_BY_KIND: Record<SettingFieldKind, number> = {
  text: 160, multiline: 2_000, url: 500, phone: 32, email: 254, number: 0, boolean: 0,
};

const isValidPublicUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch { return false; }
};

const validateSettingValue = (field: SettingField, value: string | number | boolean) => {
  if (field.kind === 'boolean') {
    if (typeof value !== 'boolean') throw new HttpError(400, 'INVALID_SETTING_VALUE', `${field.label} doit être vrai ou faux.`);
    return;
  }
  if (field.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10_000) throw new HttpError(400, 'INVALID_SETTING_VALUE', `${field.label} doit être un nombre compris entre 0 et 10 000.`);
    return;
  }
  if (typeof value !== 'string' || value.length > MAX_LENGTH_BY_KIND[field.kind]) throw new HttpError(400, 'INVALID_SETTING_VALUE', `${field.label} dépasse la longueur autorisée.`);
  if (field.kind === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new HttpError(400, 'INVALID_EMAIL', `${field.label} est invalide.`);
  if (field.kind === 'phone' && value && !/^\+?[1-9]\d{7,14}$/.test(value.replace(/[\s().-]/g, ''))) throw new HttpError(400, 'INVALID_PHONE', `${field.label} est invalide.`);
  if (field.kind === 'url' && value && !isValidPublicUrl(value)) throw new HttpError(400, 'INVALID_URL', `${field.label} doit être une URL http(s) valide.`);
};

const validateGroupValues = (group: SettingGroup, values: Record<string, string | number | boolean>) => {
  for (const field of group.fields) validateSettingValue(field, values[field.key]);
};

export const getAdminSettings = async () => {
  const rows = await prisma.studioSetting.findMany({ include: { updatedBy: { select: { id: true, name: true } } } });
  const stored = new Map(rows.map((row) => [row.group, row]));
  return SETTING_GROUPS.map((group) => {
    const row = stored.get(group.key);
    return { ...group, values: effectiveGroupValue(group, row?.value), isCustomised: Boolean(row), updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedBy ?? null };
  });
};

export const updateSettingGroup = async (groupKey: string, values: Record<string, unknown>, adminUserId?: string) => {
  const group = groupByKey.get(groupKey);
  if (!group) throw new HttpError(404, 'SETTING_GROUP_NOT_FOUND', 'Groupe de paramètres inconnu.');

  // Unknown keys are dropped rather than stored, so the registry stays the contract.
  const cleaned = effectiveGroupValue(group, values);
  validateGroupValues(group, cleaned);
  const saved = await prisma.studioSetting.upsert({
    where: { group: groupKey },
    update: { value: cleaned, updatedById: adminUserId ?? null },
    create: { group: groupKey, value: cleaned, updatedById: adminUserId ?? null },
  });
  await prisma.auditLog.create({
    data: { adminUserId, action: 'settings.update', entityType: 'StudioSetting', entityId: saved.id, metadata: { group: groupKey, values: cleaned } },
  });
  return { ...group, values: cleaned, isCustomised: true, updatedAt: saved.updatedAt };
};
