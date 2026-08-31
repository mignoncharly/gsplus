import { Prisma } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';

/** Public page copy is versioned independently for each locale. A published
 * version is immutable; editing or restoring always opens a draft. */
export type ContentLocale = 'fr' | 'en';
export type ContentFieldKind = 'text' | 'multiline';
export type TranslationStatus = 'QUEUED' | 'GENERATED' | 'FAILED' | 'REVIEWED';

export type ContentDefinition = {
  key: string;
  label: string;
  description: string;
  fields: Array<{ key: string; label: string; kind: ContentFieldKind; default: Record<ContentLocale, string> }>;
};

const bilingual = (fr: string, en: string) => ({ fr, en });

/** Defaults reproduce the public bundle in both locales until an owner publishes copy. */
export const CONTENT_DEFINITIONS: ContentDefinition[] = [
  {
    key: 'contact.hours', label: 'Contact — horaires affichés',
    description: 'Bloc « Horaires d’ouverture » de la page Contact.',
    fields: [
      { key: 'weekdaysLabel', label: 'Libellé jours ouvrés', kind: 'text', default: bilingual('Du lundi au samedi :', 'Monday to Saturday:') },
      { key: 'weekdaysValue', label: 'Horaires jours ouvrés', kind: 'text', default: bilingual('9 h - 18 h', '09:00 - 18:00') },
      { key: 'sundayLabel', label: 'Libellé dimanche', kind: 'text', default: bilingual('Dimanche :', 'Sunday:') },
      { key: 'sundayValue', label: 'Valeur dimanche', kind: 'text', default: bilingual('Fermé, sauf rendez-vous VIP préalable', 'Closed, except by prior VIP appointment') },
    ],
  },
  {
    key: 'contact.intro', label: 'Contact — texte d’accueil',
    description: 'Phrase d’introduction de la page Contact.',
    fields: [{ key: 'lead', label: 'Introduction', kind: 'multiline', default: bilingual(
      'Vous avez une question, un projet spécial ou besoin d’assistance ? Notre équipe est à votre écoute pour donner vie à vos envies.',
      'Have a question, a special project or need support? Our team is here to bring your ideas to life.',
    ) }],
  },
  {
    key: 'faq.general', label: 'FAQ générale',
    description: 'Questions fréquentes affichées publiquement. Une paire question/réponse par bloc.',
    fields: [
      { key: 'q1', label: 'Question 1', kind: 'text', default: bilingual('', '') }, { key: 'a1', label: 'Réponse 1', kind: 'multiline', default: bilingual('', '') },
      { key: 'q2', label: 'Question 2', kind: 'text', default: bilingual('', '') }, { key: 'a2', label: 'Réponse 2', kind: 'multiline', default: bilingual('', '') },
      { key: 'q3', label: 'Question 3', kind: 'text', default: bilingual('', '') }, { key: 'a3', label: 'Réponse 3', kind: 'multiline', default: bilingual('', '') },
    ],
  },
];

const definitionByKey = new Map(CONTENT_DEFINITIONS.map((item) => [item.key, item]));
const localeOf = (locale: string): ContentLocale => locale === 'en' ? 'en' : 'fr';
const fieldLimit = (kind: ContentFieldKind) => kind === 'text' ? 160 : 2_000;

export const contentDefaults = (definition: ContentDefinition, locale: ContentLocale = 'fr') =>
  Object.fromEntries(definition.fields.map((field) => [field.key, field.default[locale]]));

const merge = (definition: ContentDefinition, body: unknown, locale: ContentLocale = 'fr'): Record<string, string> => {
  const object = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  return Object.fromEntries(definition.fields.map((field) => [field.key,
    typeof object[field.key] === 'string' ? object[field.key] as string : field.default[locale],
  ]));
};

const validateBody = (definition: ContentDefinition, body: Record<string, string>) => {
  for (const field of definition.fields) {
    const value = body[field.key];
    if (typeof value !== 'string' || value.length > fieldLimit(field.kind)) {
      throw new HttpError(400, 'INVALID_CONTENT_VALUE', `${field.label} dépasse la longueur autorisée.`);
    }
  }
};

const currentPublished = async (key: string, locale: ContentLocale) => prisma.siteContent.findFirst({
  where: { key, locale, status: 'PUBLISHED' }, orderBy: { version: 'desc' },
});

/** What the public site reads: published version only, otherwise locale fallback. */
export const getPublishedContent = async (rawLocale = 'fr') => {
  const locale = localeOf(rawLocale);
  const rows = await prisma.siteContent.findMany({ where: { locale, status: 'PUBLISHED' }, orderBy: { version: 'desc' } });
  const latest = new Map<string, Prisma.JsonValue>();
  for (const row of rows) if (!latest.has(row.key)) latest.set(row.key, row.body);
  return Object.fromEntries(CONTENT_DEFINITIONS.map((definition) => [definition.key, merge(definition, latest.get(definition.key), locale)]));
};

const translationSummary = (row: { translationStatus: string | null; translationSourceVersion: number | null; translationError: string | null } | null, sourceVersion: number | null) => ({
  status: row?.translationStatus ?? null,
  sourceVersion: row?.translationSourceVersion ?? sourceVersion,
  error: row?.translationError ?? null,
});

export const listAdminContent = async (rawLocale = 'fr') => {
  const locale = localeOf(rawLocale);
  const [rows, frenchPublished] = await Promise.all([
    prisma.siteContent.findMany({
      where: { locale }, orderBy: [{ key: 'asc' }, { version: 'desc' }],
      include: { updatedBy: { select: { id: true, name: true } }, publishedBy: { select: { id: true, name: true } } },
    }),
    locale === 'en' ? prisma.siteContent.findMany({ where: { locale: 'fr', status: 'PUBLISHED' }, orderBy: { version: 'desc' } }) : Promise.resolve([]),
  ]);
  const frenchByKey = new Map<string, number>();
  for (const row of frenchPublished) if (!frenchByKey.has(row.key)) frenchByKey.set(row.key, row.version);
  return CONTENT_DEFINITIONS.map((definition) => {
    const versions = rows.filter((row) => row.key === definition.key);
    const published = versions.find((row) => row.status === 'PUBLISHED') ?? null;
    const draft = versions.find((row) => row.status === 'DRAFT') ?? null;
    return {
      ...definition, locale,
      published: published ? { ...published, body: merge(definition, published.body, locale) } : null,
      draft: draft ? { ...draft, body: merge(definition, draft.body, locale) } : null,
      effective: merge(definition, published?.body, locale),
      translation: locale === 'en' ? translationSummary(draft ?? published, frenchByKey.get(definition.key) ?? null) : null,
      history: versions.map((row) => ({ id: row.id, version: row.version, status: row.status, publishedAt: row.publishedAt, updatedAt: row.updatedAt, translationStatus: row.translationStatus })),
    };
  });
};

const findOrCreateDraft = async (key: string, locale: ContentLocale, body: Record<string, string>, adminUserId?: string) => {
  const existing = await prisma.siteContent.findFirst({ where: { key, locale, status: 'DRAFT' } });
  return existing
    ? prisma.siteContent.update({ where: { id: existing.id }, data: { body, updatedById: adminUserId ?? null } })
    : (async () => {
      const highest = await prisma.siteContent.findFirst({ where: { key, locale }, orderBy: { version: 'desc' } });
      return prisma.siteContent.create({ data: { key, locale, version: (highest?.version ?? 0) + 1, status: 'DRAFT', body, updatedById: adminUserId ?? null } });
    })();
};

export const saveContentDraft = async (key: string, rawLocale: string, body: Record<string, unknown>, adminUserId?: string) => {
  const definition = definitionByKey.get(key);
  if (!definition) throw new HttpError(404, 'CONTENT_NOT_FOUND', 'Contenu inconnu.');
  const locale = localeOf(rawLocale);
  const cleaned = merge(definition, body, locale);
  validateBody(definition, cleaned);
  const saved = await findOrCreateDraft(key, locale, cleaned, adminUserId);
  // An owner’s edit is the explicit review step for EN text, whether it began as a
  // generated proposal or was translated manually.
  const reviewed = locale === 'en'
    ? await prisma.siteContent.update({ where: { id: saved.id }, data: { translationStatus: 'REVIEWED', translationError: null } })
    : saved;
  await prisma.auditLog.create({ data: { adminUserId, action: 'content.draft.save', entityType: 'SiteContent', entityId: reviewed.id, metadata: { key, locale, version: reviewed.version } } });
  return { ...reviewed, body: cleaned };
};

const translationDraft = async (key: string, adminUserId?: string) => {
  const source = await currentPublished(key, 'fr');
  if (!source) throw new HttpError(409, 'NO_FRENCH_SOURCE_TO_TRANSLATE', 'Publiez d’abord la version française avant de lancer sa traduction.');
  const definition = definitionByKey.get(key)!;
  const existing = await prisma.siteContent.findFirst({ where: { key, locale: 'en', status: 'DRAFT' } });
  const draft = existing ?? await findOrCreateDraft(key, 'en', merge(definition, undefined, 'en'), adminUserId);
  return { source, draft, definition };
};

export const queueEnglishTranslation = async (key: string, adminUserId?: string) => {
  if (!definitionByKey.has(key)) throw new HttpError(404, 'CONTENT_NOT_FOUND', 'Contenu inconnu.');
  const { source, draft } = await translationDraft(key, adminUserId);
  const queued = await prisma.siteContent.update({ where: { id: draft.id }, data: { translationStatus: 'QUEUED', translationSourceVersion: source.version, translationError: null, updatedById: adminUserId ?? null } });
  await prisma.auditLog.create({ data: { adminUserId, action: 'content.translation.queue', entityType: 'SiteContent', entityId: queued.id, metadata: { key, sourceVersion: source.version } } });
  return queued;
};

const translateWithDeepL = async (definition: ContentDefinition, source: Record<string, string>): Promise<Record<string, string>> => {
  if (env.NODE_ENV === 'test' || !env.DEEPL_API_KEY) throw new Error('Aucun service de traduction n’est configuré sur le serveur.');
  const fields = definition.fields.filter((field) => source[field.key].trim());
  if (!fields.length) return contentDefaults(definition, 'en');
  const baseUrl = env.DEEPL_API_URL || (env.DEEPL_API_KEY.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.CONTENT_TRANSLATION_TIMEOUT_MS);
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v2/translate`, {
    method: 'POST', signal: controller.signal,
    headers: { 'content-type': 'application/json', authorization: `DeepL-Auth-Key ${env.DEEPL_API_KEY}`, 'x-deepl-reporting-tag': 'golden-studio-plus-content' },
    body: JSON.stringify({ text: fields.map((field) => source[field.key]), source_lang: 'FR', target_lang: 'EN', formality: 'prefer_more', context: 'Public photography studio website copy. Keep Golden Studio Plus unchanged.' }),
  }).finally(() => clearTimeout(timeout));
  const payload = await response.json() as { message?: string; translations?: Array<{ text?: string }> };
  if (!response.ok) throw new Error(payload.message || `DeepL a répondu ${response.status}.`);
  if (!payload.translations || payload.translations.length !== fields.length || payload.translations.some((item) => typeof item.text !== 'string')) throw new Error('Réponse DeepL de traduction invalide.');
  return { ...contentDefaults(definition, 'en'), ...Object.fromEntries(fields.map((field, index) => [field.key, payload.translations![index].text as string])) };
};

/** Uses a custom gateway when configured, otherwise DeepL directly; credentials remain server-only. */
export const generateEnglishTranslation = async (key: string, adminUserId?: string) => {
  if (!definitionByKey.has(key)) throw new HttpError(404, 'CONTENT_NOT_FOUND', 'Contenu inconnu.');
  const { source, draft, definition } = await translationDraft(key, adminUserId);
  try {
    const sourceBody = merge(definition, source.body, 'fr');
    const body = env.CONTENT_TRANSLATION_URL
      ? await (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), env.CONTENT_TRANSLATION_TIMEOUT_MS);
        const response = await fetch(env.CONTENT_TRANSLATION_URL, {
          method: 'POST', signal: controller.signal,
          headers: { 'content-type': 'application/json', ...(env.CONTENT_TRANSLATION_TOKEN ? { authorization: `Bearer ${env.CONTENT_TRANSLATION_TOKEN}` } : {}) },
          body: JSON.stringify({ key, source: sourceBody, sourceLocale: 'fr', targetLocale: 'en' }),
        }).finally(() => clearTimeout(timeout));
        if (!response.ok) throw new Error(`Le service de traduction a répondu ${response.status}.`);
        const payload = await response.json() as { body?: Record<string, unknown> };
        return merge(definition, payload.body, 'en');
      })()
      : await translateWithDeepL(definition, sourceBody);
    validateBody(definition, body);
    const generated = await prisma.siteContent.update({ where: { id: draft.id }, data: { body, translationStatus: 'GENERATED', translationSourceVersion: source.version, translationError: null, updatedById: adminUserId ?? null } });
    await prisma.auditLog.create({ data: { adminUserId, action: 'content.translation.generated', entityType: 'SiteContent', entityId: generated.id, metadata: { key, sourceVersion: source.version } } });
    return { ...generated, body };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Échec inconnu du service de traduction.';
    const failed = await prisma.siteContent.update({ where: { id: draft.id }, data: { translationStatus: 'FAILED', translationSourceVersion: source.version, translationError: message, updatedById: adminUserId ?? null } });
    await prisma.auditLog.create({ data: { adminUserId, action: 'content.translation.failed', entityType: 'SiteContent', entityId: failed.id, metadata: { key, sourceVersion: source.version, error: message } } });
    return failed;
  }
};

export const markEnglishTranslationReviewed = async (key: string, adminUserId?: string) => {
  const draft = await prisma.siteContent.findFirst({ where: { key, locale: 'en', status: 'DRAFT' } });
  if (!draft) throw new HttpError(409, 'NO_DRAFT_TO_REVIEW', 'Aucun brouillon anglais à relire.');
  const reviewed = await prisma.siteContent.update({ where: { id: draft.id }, data: { translationStatus: 'REVIEWED', translationError: null, updatedById: adminUserId ?? null } });
  await prisma.auditLog.create({ data: { adminUserId, action: 'content.translation.reviewed', entityType: 'SiteContent', entityId: reviewed.id, metadata: { key, version: reviewed.version } } });
  return reviewed;
};

export const publishContent = async (key: string, rawLocale: string, adminUserId?: string) => {
  const definition = definitionByKey.get(key);
  if (!definition) throw new HttpError(404, 'CONTENT_NOT_FOUND', 'Contenu inconnu.');
  const locale = localeOf(rawLocale);
  const draft = await prisma.siteContent.findFirst({ where: { key, locale, status: 'DRAFT' } });
  if (!draft) throw new HttpError(409, 'NO_DRAFT_TO_PUBLISH', 'Aucun brouillon à publier pour ce contenu.');
  if (locale === 'en' && draft.translationStatus !== 'REVIEWED') throw new HttpError(409, 'EN_TRANSLATION_REVIEW_REQUIRED', 'La version anglaise doit être relue avant publication.');
  const published = await prisma.$transaction(async (tx) => {
    await tx.siteContent.updateMany({ where: { key, locale, status: 'PUBLISHED' }, data: { status: 'ARCHIVED' } });
    return tx.siteContent.update({ where: { id: draft.id }, data: { status: 'PUBLISHED', publishedAt: new Date(), publishedById: adminUserId ?? null } });
  });
  await prisma.auditLog.create({ data: { adminUserId, action: 'content.publish', entityType: 'SiteContent', entityId: published.id, metadata: { key, locale, version: published.version } } });
  return published;
};

/** Restoring history opens a draft and requires an English review before publication. */
export const restoreContentVersion = async (key: string, rawLocale: string, version: number, adminUserId?: string) => {
  const definition = definitionByKey.get(key);
  if (!definition) throw new HttpError(404, 'CONTENT_NOT_FOUND', 'Contenu inconnu.');
  const locale = localeOf(rawLocale);
  const source = await prisma.siteContent.findFirst({ where: { key, locale, version } });
  if (!source) throw new HttpError(404, 'CONTENT_VERSION_NOT_FOUND', 'Version introuvable.');
  const draft = await saveContentDraft(key, locale, merge(definition, source.body, locale), adminUserId);
  await prisma.auditLog.create({ data: { adminUserId, action: 'content.restore_to_draft', entityType: 'SiteContent', entityId: draft.id, metadata: { key, locale, sourceVersion: version, draftVersion: draft.version } } });
  return draft;
};
