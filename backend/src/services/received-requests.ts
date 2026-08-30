import { Prisma } from '../generated/prisma/client.js';
import { LeadStatus } from '../generated/prisma/enums.js';
import { prisma } from '../db/prisma.js';
import { businessDayWindow } from '../utils/business-time.js';

/**
 * The requests the studio receives, from the four public forms.
 *
 * The report's instruction is explicit about what this is *not*: no assignment, no
 * pipeline, no opportunity value, no automated follow-up, no conversion measurement. It
 * is a list the studio can search, work through, and close.
 */
export type ReceivedRequestQuery = {
  limit: number;
  offset: number;
  q?: string;
  type?: string[];
  status?: string[];
  from?: string;
  to?: string;
};

const searchFilter = (term: string): Prisma.LeadWhereInput => {
  const value = term.trim();
  const insensitive = { contains: value, mode: 'insensitive' as const };
  return {
    OR: [
      // A reference is written in capitals and quoted back by the customer as they see it.
      { reference: { equals: value.toUpperCase() } },
      { name: insensitive },
      { email: insensitive },
      { phone: insensitive },
      { company: insensitive },
      { subject: insensitive },
      { message: insensitive },
    ],
  };
};

export const listReceivedRequests = async (query: ReceivedRequestQuery) => {
  const where: Prisma.LeadWhereInput = {};
  const and: Prisma.LeadWhereInput[] = [];

  if (query.q) and.push(searchFilter(query.q));
  if (query.type?.length) and.push({ type: { in: query.type as never[] } });
  if (query.status?.length) and.push({ status: { in: query.status as never[] } });
  // Dates are Douala business days, not UTC calendar days, so a request submitted at
  // 23:30 local time is found on the day the studio would say it arrived.
  if (query.from) and.push({ createdAt: { gte: businessDayWindow(query.from).start } });
  if (query.to) and.push({ createdAt: { lt: businessDayWindow(query.to).end } });
  if (and.length) where.AND = and;

  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset,
      include: {
        handledBy: { select: { id: true, name: true } },
        // The e-mails this request produced, so the studio can see what the customer was
        // told without leaving the record.
        notifications: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, type: true, channel: true, status: true, recipient: true, createdAt: true, sentAt: true, resolution: true },
        },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return { items, total, limit: query.limit, offset: query.offset };
};

export const updateReceivedRequest = async (
  id: string,
  input: { status?: string; internalNote?: string | null },
  adminUserId?: string,
) => {
  const lead = await prisma.lead.findFirst({ where: { OR: [{ id }, { reference: id.toUpperCase() }] } });
  if (!lead) return null;

  const data: Prisma.LeadUpdateInput = {};
  if (input.status !== undefined) {
    data.status = input.status as LeadStatus;
    // "Traité" is the one status that answers a question the studio asks later — who
    // closed this, and when — so it is the one that records an author.
    if (input.status === 'HANDLED') {
      data.handledAt = new Date();
      if (adminUserId) data.handledBy = { connect: { id: adminUserId } };
    } else {
      data.handledAt = null;
      data.handledBy = { disconnect: true };
    }
  }
  if (input.internalNote !== undefined) data.internalNote = input.internalNote?.trim() || null;

  return prisma.lead.update({ where: { id: lead.id }, data, include: { handledBy: { select: { id: true, name: true } } } });
};

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const receivedRequestsCsv = (items: Awaited<ReturnType<typeof listReceivedRequests>>['items']) => {
  const header = ['reference', 'type', 'statut', 'nom', 'societe', 'email', 'telephone', 'consentement_whatsapp', 'sujet', 'message', 'recu_le', 'traite_le', 'traite_par', 'note_interne'];
  const rows = items.map((item) => [
    item.reference, item.type, item.status, item.name, item.company, item.email, item.phone,
    item.whatsappConsentAt ? 'oui' : 'non', item.subject, item.message,
    item.createdAt.toISOString(), item.handledAt?.toISOString() ?? '', item.handledBy?.name ?? '', item.internalNote ?? '',
  ].map(csvCell).join(','));
  return [header.join(','), ...rows].join('\r\n');
};
