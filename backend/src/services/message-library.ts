import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';
import {
  EMAIL_TEMPLATE_CODES,
  type EmailTemplateCode,
  emailTemplateRegistry,
  englishTemplateRegistry,
  renderEmailTemplate,
} from '../emails/templates.js';
import { refreshTemplateOverrides } from './message-template-overrides.js';
import { GOVERNED_EVENTS, UNSILENCEABLE_EVENTS, isGovernedEvent, refreshMessageRules } from './message-rules.js';

const isKnownCode = (code: string): code is EmailTemplateCode =>
  (EMAIL_TEMPLATE_CODES as readonly string[]).includes(code);

const compiledFor = (code: EmailTemplateCode, locale: string) =>
  (locale === 'en' ? englishTemplateRegistry[code] ?? emailTemplateRegistry[code] : emailTemplateRegistry[code]);

type DeliveryInput = {
  senderName?: string | null;
  fromAddress?: string | null;
  replyTo?: string | null;
  channel?: string | null;
  fallbackChannel?: string | null;
};

const deliveryFor = (value?: DeliveryInput | null) => ({
  senderName: value?.senderName?.trim() || null,
  fromAddress: value?.fromAddress?.trim() || null,
  replyTo: value?.replyTo?.trim() || null,
  channel: 'email' as const,
  fallbackChannel: value?.fallbackChannel === 'whatsapp' ? 'whatsapp' as const : null,
});

const templateVersion = (row: { version: number; subject: string; preheader: string; body: unknown; publishedAt?: Date | null; publishedBy?: unknown; updatedAt?: Date; updatedBy?: unknown } & DeliveryInput) => ({
  version: row.version,
  subject: row.subject,
  preheader: row.preheader,
  body: row.body,
  delivery: deliveryFor(row),
});

/** Every template with its compiled copy, published override and current draft. */
export const listMessageTemplates = async (locale = 'fr') => {
  const rows = await prisma.messageTemplate.findMany({
    where: { locale },
    orderBy: [{ code: 'asc' }, { version: 'desc' }],
    include: { updatedBy: { select: { id: true, name: true } }, publishedBy: { select: { id: true, name: true } } },
  });

  return EMAIL_TEMPLATE_CODES.map((code) => {
    const compiled = compiledFor(code, locale);
    const versions = rows.filter((row) => row.code === code);
    const published = versions.find((row) => row.status === 'PUBLISHED') ?? null;
    const draft = versions.find((row) => row.status === 'DRAFT') ?? null;
    return {
      code,
      audience: compiled.audience,
      channel: 'email',
      locale,
      variables: compiled.requiredVariables,
      compiled: { subject: compiled.subject, preheader: compiled.preheader, body: [...compiled.body], delivery: deliveryFor() },
      published: published ? { ...templateVersion(published), publishedAt: published.publishedAt, publishedBy: published.publishedBy } : null,
      draft: draft ? { ...templateVersion(draft), updatedAt: draft.updatedAt, updatedBy: draft.updatedBy } : null,
      isOverridden: Boolean(published),
      history: versions.map((row) => ({ id: row.id, version: row.version, status: row.status, publishedAt: row.publishedAt, updatedAt: row.updatedAt })),
    };
  });
};

export const saveTemplateDraft = async (
  code: string,
  locale: string,
  input: { subject: string; preheader: string; body: string[] } & DeliveryInput,
  adminUserId?: string,
) => {
  if (!isKnownCode(code)) throw new HttpError(404, 'TEMPLATE_NOT_FOUND', 'Modèle inconnu.');
  const body = input.body.map((line) => String(line)).filter((line) => line.trim().length > 0);
  if (!input.subject.trim() || body.length === 0) {
    throw new HttpError(400, 'TEMPLATE_EMPTY', 'Un modèle doit avoir un objet et au moins une ligne de contenu.');
  }
  const delivery = deliveryFor(input);
  const existing = await prisma.messageTemplate.findFirst({ where: { code, locale, status: 'DRAFT' } });
  const saved = existing
    ? await prisma.messageTemplate.update({
      where: { id: existing.id },
      data: { subject: input.subject, preheader: input.preheader, body, ...delivery, updatedById: adminUserId ?? null },
    })
    : await (async () => {
      const highest = await prisma.messageTemplate.findFirst({ where: { code, locale }, orderBy: { version: 'desc' } });
      return prisma.messageTemplate.create({
        data: {
          code, locale, version: (highest?.version ?? 0) + 1, status: 'DRAFT',
          subject: input.subject, preheader: input.preheader, body, ...delivery, updatedById: adminUserId ?? null,
        },
      });
    })();

  await prisma.auditLog.create({
    data: { adminUserId, action: 'message_template.draft.save', entityType: 'MessageTemplate', entityId: saved.id, metadata: { code, locale, version: saved.version, delivery } },
  });
  return saved;
};

export const publishTemplate = async (code: string, locale: string, adminUserId?: string) => {
  if (!isKnownCode(code)) throw new HttpError(404, 'TEMPLATE_NOT_FOUND', 'Modèle inconnu.');
  const draft = await prisma.messageTemplate.findFirst({ where: { code, locale, status: 'DRAFT' } });
  if (!draft) throw new HttpError(409, 'NO_DRAFT_TO_PUBLISH', 'Aucun brouillon à publier pour ce modèle.');

  const published = await prisma.$transaction(async (tx) => {
    await tx.messageTemplate.updateMany({ where: { code, locale, status: 'PUBLISHED' }, data: { status: 'ARCHIVED' } });
    return tx.messageTemplate.update({
      where: { id: draft.id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), publishedById: adminUserId ?? null },
    });
  });
  await refreshTemplateOverrides();
  await prisma.auditLog.create({
    data: { adminUserId, action: 'message_template.publish', entityType: 'MessageTemplate', entityId: published.id, metadata: { code, locale, version: published.version, delivery: deliveryFor(published) } },
  });
  return published;
};

/** Going back to the compiled template: the override is archived, not deleted. */
export const revertTemplate = async (code: string, locale: string, adminUserId?: string) => {
  if (!isKnownCode(code)) throw new HttpError(404, 'TEMPLATE_NOT_FOUND', 'Modèle inconnu.');
  const published = await prisma.messageTemplate.findFirst({ where: { code, locale, status: 'PUBLISHED' } });
  if (!published) throw new HttpError(409, 'NO_OVERRIDE', 'Ce modèle utilise déjà la version d’origine.');
  await prisma.messageTemplate.update({ where: { id: published.id }, data: { status: 'ARCHIVED' } });
  await refreshTemplateOverrides();
  await prisma.auditLog.create({
    data: { adminUserId, action: 'message_template.revert', entityType: 'MessageTemplate', entityId: published.id, metadata: { code, locale } },
  });
};

/** Fake but plausible values, so a preview never needs a real reservation. */
export const sampleVariables = (variables: readonly string[]) => Object.fromEntries(variables.map((name) => {
  if (name.includes('reference')) return [name, 'GSP-260830-EXEMPLE'];
  if (name.includes('date')) return [name, '30 août 2026'];
  if (name.includes('heure')) return [name, '10:00'];
  if (name.includes('montant') || name.includes('prix')) return [name, '25 000 FCFA'];
  if (name.includes('lien') || name.includes('url')) return [name, 'https://gsplus.vip/exemple'];
  if (name.includes('email')) return [name, 'client@exemple.test'];
  if (name.includes('telephone') || name.includes('phone')) return [name, '+237 6XX XX XX XX'];
  if (name.includes('nom') || name.includes('prenom')) return [name, 'Exemple'];
  return [name, `[${name}]`];
}));

export const previewTemplate = (code: string, locale: string, overrides?: ({ subject: string; preheader: string; body: string[] } & DeliveryInput)) => {
  if (!isKnownCode(code)) throw new HttpError(404, 'TEMPLATE_NOT_FOUND', 'Modèle inconnu.');
  const compiled = compiledFor(code, locale);
  const source = overrides ?? { subject: compiled.subject, preheader: compiled.preheader, body: [...compiled.body] };
  const placeholders = new Set<string>();
  for (const part of [source.subject, source.preheader, ...source.body]) {
    for (const match of part.matchAll(/\[([a-z0-9_]+)\]/g)) placeholders.add(match[1]);
  }
  const variables = sampleVariables([...placeholders]);
  const replace = (text: string) => text.replace(/\[([a-z0-9_]+)\]/g, (_match, name) => String(variables[name] ?? `[${name}]`));
  return {
    code, locale, audience: compiled.audience,
    subject: replace(source.subject), preheader: replace(source.preheader), text: source.body.map(replace).join('\n'), variables,
    delivery: deliveryFor(source),
  };
};

/** Renders through the real pipeline, so a test send exercises what customers receive. */
export const renderWithSampleData = (code: string, locale: 'fr' | 'en') => {
  if (!isKnownCode(code)) throw new HttpError(404, 'TEMPLATE_NOT_FOUND', 'Modèle inconnu.');
  const compiled = compiledFor(code, locale);
  return renderEmailTemplate(code, sampleVariables(compiled.requiredVariables), locale);
};

/** Every governed event, whether or not a rule has been stored for it. */
export const listMessageRules = async () => {
  const rows = await prisma.messageRule.findMany({ include: { updatedBy: { select: { id: true, name: true } } } });
  const stored = new Map(rows.map((row) => [row.event, row]));
  return GOVERNED_EVENTS.map((event) => {
    const row = stored.get(event);
    return {
      event,
      canBeDisabled: !UNSILENCEABLE_EVENTS.has(event),
      isConfigured: Boolean(row),
      delayMinutes: row?.delayMinutes ?? null,
      groupingWindowMinutes: row?.groupingWindowMinutes ?? null,
      maxAttempts: row?.maxAttempts ?? null,
      fallbackChannel: row?.fallbackChannel === 'whatsapp' ? 'whatsapp' : null,
      isEnabled: row ? row.isEnabled || UNSILENCEABLE_EVENTS.has(event) : true,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  });
};

export const upsertMessageRule = async (input: {
  event: string;
  delayMinutes: number | null;
  groupingWindowMinutes: number | null;
  maxAttempts: number | null;
  fallbackChannel: 'whatsapp' | null;
  isEnabled: boolean;
}, adminUserId?: string) => {
  if (!isGovernedEvent(input.event)) throw new HttpError(404, 'MESSAGE_EVENT_NOT_FOUND', 'Événement inconnu.');
  if (!input.isEnabled && UNSILENCEABLE_EVENTS.has(input.event)) {
    throw new HttpError(422, 'MESSAGE_EVENT_UNSILENCEABLE', 'Cette alerte ne peut pas être désactivée : elle est le seul signal d’une panne. Vous pouvez la retarder ou la regrouper.');
  }
  const data = {
    delayMinutes: input.delayMinutes,
    groupingWindowMinutes: input.groupingWindowMinutes,
    maxAttempts: input.maxAttempts,
    fallbackChannel: input.fallbackChannel,
    isEnabled: input.isEnabled,
    updatedById: adminUserId ?? null,
  };
  const saved = await prisma.messageRule.upsert({ where: { event: input.event }, update: data, create: { event: input.event, ...data } });
  await prisma.auditLog.create({
    data: { adminUserId, action: 'message_rule.update', entityType: 'MessageRule', entityId: saved.event, metadata: { ...input } },
  });
  await refreshMessageRules();
  return saved;
};
