import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';

/**
 * Editable page copy, versioned with the same draft -> published lifecycle the
 * catalogue already uses: a draft is edited freely, publishing freezes it and the
 * next edit opens a new version, so history is never overwritten.
 *
 * Automatic translation is already in place, so the report is explicit that the
 * administration should not present French and English side by side. Each entry is
 * therefore edited in one locale at a time, with the generation state visible.
 */

export type ContentFieldKind = 'text' | 'multiline';

export type ContentDefinition = {
  key: string;
  label: string;
  description: string;
  fields: Array<{ key: string; label: string; kind: ContentFieldKind; default: string }>;
};

/** Defaults reproduce the copy that ships in the bundle today. */
export const CONTENT_DEFINITIONS: ContentDefinition[] = [
  {
    key: 'contact.hours',
    label: 'Contact — horaires affichés',
    description: 'Bloc « Horaires d’ouverture » de la page Contact.',
    fields: [
      { key: 'weekdaysLabel', label: 'Libellé jours ouvrés', kind: 'text', default: 'Du lundi au samedi :' },
      { key: 'weekdaysValue', label: 'Horaires jours ouvrés', kind: 'text', default: '9 h - 18 h' },
      { key: 'sundayLabel', label: 'Libellé dimanche', kind: 'text', default: 'Dimanche :' },
      { key: 'sundayValue', label: 'Valeur dimanche', kind: 'text', default: 'Fermé, sauf rendez-vous VIP préalable' },
    ],
  },
  {
    key: 'contact.intro',
    label: 'Contact — texte d’accueil',
    description: 'Phrase d’introduction de la page Contact.',
    fields: [
      { key: 'lead', label: 'Introduction', kind: 'multiline',
        default: 'Vous avez une question, un projet spécial ou besoin d’assistance ? Notre équipe est à votre écoute pour donner vie à vos envies.' },
    ],
  },
  {
    key: 'faq.general',
    label: 'FAQ générale',
    description: 'Questions fréquentes affichées publiquement. Une paire question/réponse par bloc.',
    fields: [
      { key: 'q1', label: 'Question 1', kind: 'text', default: '' },
      { key: 'a1', label: 'Réponse 1', kind: 'multiline', default: '' },
      { key: 'q2', label: 'Question 2', kind: 'text', default: '' },
      { key: 'a2', label: 'Réponse 2', kind: 'multiline', default: '' },
      { key: 'q3', label: 'Question 3', kind: 'text', default: '' },
      { key: 'a3', label: 'Réponse 3', kind: 'multiline', default: '' },
    ],
  },
];

const definitionByKey = new Map(CONTENT_DEFINITIONS.map((item) => [item.key, item]));

export const contentDefaults = (definition: ContentDefinition) =>
  Object.fromEntries(definition.fields.map((field) => [field.key, field.default]));

const merge = (definition: ContentDefinition, body: unknown): Record<string, string> => {
  const object = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  return Object.fromEntries(definition.fields.map((field) => [
    field.key,
    typeof object[field.key] === 'string' ? object[field.key] as string : field.default,
  ]));
};

/** What the public site reads: the published version, or the compiled default. */
export const getPublishedContent = async (locale = 'fr') => {
  const rows = await prisma.siteContent.findMany({
    where: { locale, status: 'PUBLISHED' },
    orderBy: { version: 'desc' },
  });
  const latest = new Map<string, Prisma.JsonValue>();
  for (const row of rows) if (!latest.has(row.key)) latest.set(row.key, row.body);
  return Object.fromEntries(CONTENT_DEFINITIONS.map((definition) => [
    definition.key,
    merge(definition, latest.get(definition.key)),
  ]));
};

export const listAdminContent = async (locale = 'fr') => {
  const rows = await prisma.siteContent.findMany({
    where: { locale },
    orderBy: [{ key: 'asc' }, { version: 'desc' }],
    include: { updatedBy: { select: { id: true, name: true } }, publishedBy: { select: { id: true, name: true } } },
  });
  return CONTENT_DEFINITIONS.map((definition) => {
    const versions = rows.filter((row) => row.key === definition.key);
    const published = versions.find((row) => row.status === 'PUBLISHED') ?? null;
    const draft = versions.find((row) => row.status === 'DRAFT') ?? null;
    return {
      ...definition,
      locale,
      published: published ? { ...published, body: merge(definition, published.body) } : null,
      draft: draft ? { ...draft, body: merge(definition, draft.body) } : null,
      // What the site shows right now, so the editor never has to guess.
      effective: merge(definition, published?.body),
      history: versions.map((row) => ({ id: row.id, version: row.version, status: row.status, publishedAt: row.publishedAt, updatedAt: row.updatedAt })),
    };
  });
};

export const saveContentDraft = async (key: string, locale: string, body: Record<string, unknown>, adminUserId?: string) => {
  const definition = definitionByKey.get(key);
  if (!definition) throw new HttpError(404, 'CONTENT_NOT_FOUND', 'Contenu inconnu.');
  const cleaned = merge(definition, body);

  const existingDraft = await prisma.siteContent.findFirst({ where: { key, locale, status: 'DRAFT' } });
  const saved = existingDraft
    ? await prisma.siteContent.update({ where: { id: existingDraft.id }, data: { body: cleaned, updatedById: adminUserId ?? null } })
    : await (async () => {
      // A published version is never edited in place; the draft opens the next version.
      const highest = await prisma.siteContent.findFirst({ where: { key, locale }, orderBy: { version: 'desc' } });
      return prisma.siteContent.create({
        data: { key, locale, version: (highest?.version ?? 0) + 1, status: 'DRAFT', body: cleaned, updatedById: adminUserId ?? null },
      });
    })();

  await prisma.auditLog.create({
    data: { adminUserId, action: 'content.draft.save', entityType: 'SiteContent', entityId: saved.id, metadata: { key, locale, version: saved.version } },
  });
  return { ...saved, body: cleaned };
};

export const publishContent = async (key: string, locale: string, adminUserId?: string) => {
  const definition = definitionByKey.get(key);
  if (!definition) throw new HttpError(404, 'CONTENT_NOT_FOUND', 'Contenu inconnu.');
  const draft = await prisma.siteContent.findFirst({ where: { key, locale, status: 'DRAFT' } });
  if (!draft) throw new HttpError(409, 'NO_DRAFT_TO_PUBLISH', 'Aucun brouillon à publier pour ce contenu.');

  const published = await prisma.$transaction(async (tx) => {
    // The previous published version becomes history rather than disappearing.
    await tx.siteContent.updateMany({ where: { key, locale, status: 'PUBLISHED' }, data: { status: 'ARCHIVED' } });
    return tx.siteContent.update({
      where: { id: draft.id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), publishedById: adminUserId ?? null },
    });
  });

  await prisma.auditLog.create({
    data: { adminUserId, action: 'content.publish', entityType: 'SiteContent', entityId: published.id, metadata: { key, locale, version: published.version } },
  });
  return published;
};
