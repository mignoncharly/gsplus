import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { businessDayWindow } from '../utils/business-time.js';

/**
 * §12 — a view over what the administration already records.
 *
 * `AuditLog` and `AdminCommand` have been written to since the beginning and read by
 * nobody: there was no way to ask "what did this account do last week", which is the only
 * question an audit trail exists to answer.
 */
export type AuditQuery = {
  limit: number;
  offset: number;
  q?: string;
  adminUserId?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
};

export const listAuditLog = async (query: AuditQuery) => {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (query.q) {
    const insensitive = { contains: query.q.trim(), mode: 'insensitive' as const };
    and.push({ OR: [{ action: insensitive }, { entityType: insensitive }, { entityId: insensitive }] });
  }
  if (query.adminUserId) and.push({ adminUserId: query.adminUserId });
  if (query.action) and.push({ action: { startsWith: query.action } });
  if (query.entityType) and.push({ entityType: query.entityType });
  if (query.from) and.push({ createdAt: { gte: businessDayWindow(query.from).start } });
  if (query.to) and.push({ createdAt: { lt: businessDayWindow(query.to).end } });

  const where: Prisma.AuditLogWhereInput = and.length ? { AND: and } : {};
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset,
      include: { adminUser: { select: { id: true, name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total, limit: query.limit, offset: query.offset };
};

/** The distinct actions actually present, so the filter offers what exists rather than a guess. */
export const auditActionFacets = async () => {
  const rows = await prisma.auditLog.groupBy({ by: ['action'], _count: { action: true }, orderBy: { action: 'asc' } });
  return rows.map((row) => ({ action: row.action, count: row._count.action }));
};

/** Versioned business commands are shown beside descriptive audit entries. */
export const listAdminCommands = async (query: AuditQuery) => {
  const and: Prisma.AdminCommandWhereInput[] = [];
  if (query.q) {
    const insensitive = { contains: query.q.trim(), mode: 'insensitive' as const };
    and.push({ OR: [{ id: insensitive }, { action: insensitive }, { entityType: insensitive }, { entityId: insensitive }] });
  }
  if (query.adminUserId) and.push({ adminUserId: query.adminUserId });
  if (query.action) and.push({ action: { startsWith: query.action } });
  if (query.entityType) and.push({ entityType: query.entityType });
  if (query.from) and.push({ createdAt: { gte: businessDayWindow(query.from).start } });
  if (query.to) and.push({ createdAt: { lt: businessDayWindow(query.to).end } });
  const where: Prisma.AdminCommandWhereInput = and.length ? { AND: and } : {};
  const [items, total] = await Promise.all([
    prisma.adminCommand.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset,
      include: { adminUser: { select: { id: true, name: true, email: true } } },
    }),
    prisma.adminCommand.count({ where }),
  ]);
  return { items, total, limit: query.limit, offset: query.offset };
};

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const auditLogCsv = (items: Awaited<ReturnType<typeof listAuditLog>>['items']) => {
  const header = ['horodatage', 'auteur', 'email_auteur', 'action', 'type_entite', 'entite', 'details'];
  const rows = items.map((item) => [
    item.createdAt.toISOString(),
    item.adminUser?.name ?? 'Système',
    item.adminUser?.email ?? '',
    item.action, item.entityType, item.entityId, item.metadata,
  ].map(csvCell).join(','));
  return [header.join(','), ...rows].join('\r\n');
};

export const adminCommandCsv = (items: Awaited<ReturnType<typeof listAdminCommands>>['items']) => {
  const header = ['horodatage', 'auteur', 'email_auteur', 'commande', 'action', 'type_entite', 'entite', 'statut', 'terminee_a'];
  const rows = items.map((item) => [
    item.createdAt.toISOString(), item.adminUser?.name ?? 'Système', item.adminUser?.email ?? '',
    item.id, item.action, item.entityType, item.entityId, item.status, item.completedAt?.toISOString() ?? '',
  ].map(csvCell).join(','));
  return [header.join(','), ...rows].join('\r\n');
};

/**
 * Sign-in attempts, and what in them is worth being told about.
 *
 * "Unusual" is deliberately narrow: repeated failures against one address, and a success
 * from an address that has never signed in before. Anything broader produces noise, and a
 * security alert nobody reads is worse than none.
 */
export const signInActivity = async (windowHours = 24, now = new Date()) => {
  const since = new Date(now.getTime() - windowHours * 3_600_000);
  const attempts = await prisma.adminSignInAttempt.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const failuresByEmail = new Map<string, number>();
  const failuresByIp = new Map<string, number>();
  for (const attempt of attempts) {
    if (attempt.succeeded) continue;
    failuresByEmail.set(attempt.email, (failuresByEmail.get(attempt.email) ?? 0) + 1);
    if (attempt.ipAddress) failuresByIp.set(attempt.ipAddress, (failuresByIp.get(attempt.ipAddress) ?? 0) + 1);
  }

  const alerts: { code: string; detail: string; count: number }[] = [];
  for (const [email, count] of failuresByEmail) {
    if (count >= 5) alerts.push({ code: 'REPEATED_FAILURES_FOR_ACCOUNT', detail: email, count });
  }
  for (const [ip, count] of failuresByIp) {
    if (count >= 10) alerts.push({ code: 'REPEATED_FAILURES_FROM_ADDRESS', detail: ip, count });
  }

  return {
    windowHours,
    attempts: attempts.slice(0, 100),
    total: attempts.length,
    failed: attempts.filter((attempt) => !attempt.succeeded).length,
    alerts: alerts.sort((a, b) => b.count - a.count),
  };
};
