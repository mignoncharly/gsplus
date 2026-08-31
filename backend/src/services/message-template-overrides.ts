import { prisma } from '../db/prisma.js';

/**
 * Published overrides of the compiled e-mail templates, held in memory.
 *
 * `renderEmailTemplate` is synchronous and is called from inside notification
 * transactions. Making it query the database would make it asynchronous, touch every
 * call site, and — worse — make rendering fail when the database is briefly
 * unavailable, which is exactly when the outbox must keep working.
 *
 * So overrides are cached. A lookup is a Map read that cannot throw and cannot block.
 * An empty cache simply means every template renders from code, which is the state the
 * system is in today and the state it falls back to if a refresh ever fails.
 */
export type TemplateOverride = {
  subject: string;
  preheader: string;
  body: string[];
  version: number;
  senderName: string | null;
  fromAddress: string | null;
  replyTo: string | null;
  channel: 'email';
  fallbackChannel: 'whatsapp' | null;
};

const overrides = new Map<string, TemplateOverride>();
let lastLoadedAt: Date | null = null;
let lastError: string | null = null;

const cacheKey = (code: string, locale: string) => `${code}:${locale}`;

const parseBody = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((line): line is string => typeof line === 'string') : [];

export const refreshTemplateOverrides = async () => {
  try {
    const rows = await prisma.messageTemplate.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { version: 'desc' },
    });
    const next = new Map<string, TemplateOverride>();
    for (const row of rows) {
      const key = cacheKey(row.code, row.locale);
      // Rows arrive newest first, so the first one seen is the live version.
      if (next.has(key)) continue;
      const body = parseBody(row.body);
      // An override with no body would silently blank a customer e-mail; skip it and
      // let the compiled template stand.
      if (!row.subject.trim() || body.length === 0) continue;
      next.set(key, {
        subject: row.subject, preheader: row.preheader, body, version: row.version,
        senderName: row.senderName, fromAddress: row.fromAddress, replyTo: row.replyTo,
        channel: 'email', fallbackChannel: row.fallbackChannel === 'whatsapp' ? 'whatsapp' : null,
      });
    }
    overrides.clear();
    for (const [key, value] of next) overrides.set(key, value);
    lastLoadedAt = new Date();
    lastError = null;
  } catch (error) {
    // Keep whatever is already cached; rendering continues from code either way.
    lastError = error instanceof Error ? error.message : 'unknown error';
  }
};

export const getTemplateOverride = (code: string, locale: string): TemplateOverride | null =>
  overrides.get(cacheKey(code, locale)) ?? null;

export const templateOverrideStatus = () => ({
  count: overrides.size,
  lastLoadedAt,
  lastError,
});

/** Exposed for tests, which need a deterministic cache. */
export const resetTemplateOverrides = () => {
  overrides.clear();
  lastLoadedAt = null;
  lastError = null;
};
