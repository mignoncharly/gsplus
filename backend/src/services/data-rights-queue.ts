import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';

/**
 * `ADM-10` — the register as something to work from.
 *
 * The record already carried everything: `targetResponseAt`, the identity evidence, the
 * response evidence, the closure and a full event trail. What it never had was a way to
 * find a request or to see which ones are running out of time, so a due date sat in the
 * database and nobody was warned by it.
 */
export type DataRightsQuery = {
  q?: string;
  status?: string[];
  requestType?: string[];
  dueWithinDays?: number;
  openOnly?: boolean;
};

/**
 * Lateness is a property of the clock, not of a stored flag, so it is computed on read
 * and cannot drift from the due date it describes. A closed request is never late: it was
 * answered, whenever that happened.
 */
export const responseWindow = (request: { targetResponseAt: Date; closedAt: Date | null }, now = new Date()) => {
  const dueInMs = request.targetResponseAt.getTime() - now.getTime();
  const dueInDays = Math.floor(dueInMs / 86_400_000);
  const closed = request.closedAt !== null;
  return {
    dueAt: request.targetResponseAt,
    dueInDays,
    isOverdue: !closed && dueInMs < 0,
    // "Due soon" is the window in which acting still helps.
    isDueSoon: !closed && dueInMs >= 0 && dueInDays <= 3,
    closed,
    // Recorded so a late answer stays visibly late after the fact.
    answeredLate: closed && request.closedAt!.getTime() > request.targetResponseAt.getTime(),
  };
};

export const listDataRightsRequests = async (query: DataRightsQuery, now = new Date()) => {
  const and: Prisma.DataRightsRequestWhereInput[] = [];

  if (query.q) {
    const value = query.q.trim();
    const insensitive = { contains: value, mode: 'insensitive' as const };
    and.push({
      OR: [
        { reference: { equals: value.toUpperCase() } },
        { requesterName: insensitive },
        { requesterEmail: insensitive },
        { requesterPhone: insensitive },
        { reservationReference: { equals: value.toUpperCase() } },
        { requestSummary: insensitive },
      ],
    });
  }
  if (query.status?.length) and.push({ status: { in: query.status } });
  if (query.requestType?.length) and.push({ requestType: { in: query.requestType } });
  if (query.openOnly) and.push({ closedAt: null });
  if (query.dueWithinDays !== undefined) {
    and.push({
      closedAt: null,
      targetResponseAt: { lte: new Date(now.getTime() + query.dueWithinDays * 86_400_000) },
    });
  }

  const where: Prisma.DataRightsRequestWhereInput = and.length ? { AND: and } : {};
  const [rows, total] = await Promise.all([
    prisma.dataRightsRequest.findMany({
      where,
      // Soonest due first: the list is a work queue, not an archive.
      orderBy: [{ targetResponseAt: 'asc' }, { receivedAt: 'desc' }],
      include: {
        createdBy: { select: { id: true, name: true } },
        events: { orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }], include: { recordedBy: { select: { id: true, name: true } } } },
      },
    }),
    prisma.dataRightsRequest.count({ where }),
  ]);

  const items = rows.map((row) => ({ ...row, window: responseWindow(row, now) }));
  return {
    items,
    total,
    summary: {
      open: items.filter((item) => !item.window.closed).length,
      overdue: items.filter((item) => item.window.isOverdue).length,
      dueSoon: items.filter((item) => item.window.isDueSoon).length,
      answeredLate: items.filter((item) => item.window.answeredLate).length,
    },
  };
};

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const dataRightsCsv = (items: Awaited<ReturnType<typeof listDataRightsRequests>>['items']) => {
  const header = ['reference', 'type', 'statut', 'demandeur', 'email', 'telephone', 'reservation', 'canal',
    'identite', 'preuve_identite', 'recue_le', 'echeance', 'en_retard', 'cloturee_le', 'preuve_reponse', 'resume_reponse'];
  const rows = items.map((item) => [
    item.reference, item.requestType, item.status, item.requesterName, item.requesterEmail, item.requesterPhone,
    item.reservationReference, item.requestChannel, item.identityStatus, item.identityEvidenceReference,
    item.receivedAt.toISOString(), item.targetResponseAt.toISOString(),
    item.window.isOverdue ? 'oui' : 'non', item.closedAt?.toISOString() ?? '',
    item.responseEvidence, item.responseSummary,
  ].map(csvCell).join(','));
  return [header.join(','), ...rows].join('\r\n');
};

/**
 * Response templates. Deliberately plain text with named holes rather than a second
 * message library: these are answers an operator adapts and sends from their own mailbox,
 * not messages the outbox renders.
 */
export const DATA_RIGHTS_RESPONSE_TEMPLATES = [
  {
    code: 'IDENTITY_REQUEST',
    label: 'Demander une preuve d’identité',
    body: [
      'Bonjour [nom_demandeur],',
      '',
      'Nous avons bien reçu votre demande [reference] du [date_reception].',
      'Avant d’y répondre, nous devons nous assurer que vous êtes bien la personne concernée.',
      'Merci de nous transmettre une pièce justificative d’identité.',
      '',
      'Golden Studio Plus',
    ],
  },
  {
    code: 'ACCESS_GRANTED',
    label: 'Communiquer les données',
    body: [
      'Bonjour [nom_demandeur],',
      '',
      'Votre demande [reference] a été traitée. Vous trouverez ci-joint les données que nous détenons à votre sujet.',
      '',
      'Golden Studio Plus',
    ],
  },
  {
    code: 'ERASURE_DONE',
    label: 'Confirmer la suppression',
    body: [
      'Bonjour [nom_demandeur],',
      '',
      'Votre demande [reference] a été traitée : les données concernées ont été supprimées.',
      'Certaines informations sont conservées lorsque la loi nous l’impose ; le détail figure dans notre politique de conservation.',
      '',
      'Golden Studio Plus',
    ],
  },
  {
    code: 'REFUSAL',
    label: 'Refuser en motivant',
    body: [
      'Bonjour [nom_demandeur],',
      '',
      'Votre demande [reference] ne peut pas être satisfaite pour le motif suivant : [motif].',
      'Vous pouvez contester cette décision en nous répondant directement.',
      '',
      'Golden Studio Plus',
    ],
  },
] as const;

export const renderResponseTemplate = (
  code: string,
  request: { reference: string; requesterName: string; receivedAt: Date },
  reason = '',
) => {
  const template = DATA_RIGHTS_RESPONSE_TEMPLATES.find((item) => item.code === code);
  if (!template) return null;
  const values: Record<string, string> = {
    nom_demandeur: request.requesterName,
    reference: request.reference,
    date_reception: request.receivedAt.toISOString().slice(0, 10),
    motif: reason || '[motif]',
  };
  return {
    code: template.code,
    label: template.label,
    text: template.body
      .map((line) => line.replace(/\[([a-z0-9_]+)]/g, (match, name: string) => values[name] ?? match))
      .join('\n'),
  };
};
