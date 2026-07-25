import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, '..');
const projectDir = path.resolve(backendDir, '..');
dotenv.config({ path: path.join(backendDir, '.env'), quiet: true });
const { prisma } = await import('../dist/db/prisma.js');
const qaRunId = process.argv.find((argument) => argument.startsWith('--qa-run='))?.split('=')[1];
if (!qaRunId?.startsWith('QA-GSP-')) throw new Error('Provide --qa-run=QA-GSP-...');

const reservation = await prisma.reservation.findFirst({
  where: { customer: { firstName: qaRunId } },
  include: {
    customer: { select: { id: true } },
    payments: { include: { transitions: { orderBy: { createdAt: 'asc' } } } },
    notifications: true,
    calendarSyncLogs: true,
    reservationIntent: true,
    transitions: { orderBy: { createdAt: 'asc' } },
  },
});
if (!reservation) throw new Error(`No reservation found for ${qaRunId}.`);
const leads = await prisma.lead.findMany({
  where: { name: { startsWith: qaRunId } },
  include: { notifications: true },
  orderBy: { type: 'asc' },
});
const auditLogs = await prisma.auditLog.findMany({
  where: {
    OR: [
      { entityId: reservation.id },
      { entityId: { in: reservation.payments.map((payment) => payment.id) } },
      { entityId: { in: leads.map((lead) => lead.id) } },
    ],
  },
  orderBy: { createdAt: 'asc' },
});
const notifications = [...reservation.notifications, ...leads.flatMap((lead) => lead.notifications)];
const qaBlocks = await prisma.availabilityBlock.count({ where: { reason: { startsWith: qaRunId } } });
const globalPendingNotifications = await prisma.notificationEvent.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } });
const reservationCount = await prisma.reservation.count({ where: { id: reservation.id } });
const paymentCount = await prisma.payment.count({ where: { reservationId: reservation.id } });
const verifiedTransitions = reservation.payments.flatMap((payment) => payment.transitions).filter((transition) => transition.toStatus === 'VERIFIED');
const externalCalendarEvents = reservation.calendarSyncLogs.filter((log) => log.externalEventId);
const leadTypes = new Set(leads.map((lead) => lead.type));

const checks = {
  reservationTerminal: reservation.status === 'CANCELLED',
  oneReservation: reservationCount === 1,
  onePayment: paymentCount === 1,
  syntheticPaymentRejected: reservation.payments.length === 1 && reservation.payments[0].status === 'REJECTED',
  syntheticPaymentNeverVerified: verifiedTransitions.length === 0,
  threeLeadTypesPresent: ['CONTACT', 'B2B', 'QUOTE'].every((type) => leadTypes.has(type)) && leads.length === 3,
  leadsArchived: leads.every((lead) => lead.status === 'ARCHIVED'),
  noQaNotificationPending: notifications.every((event) => !['PENDING', 'PROCESSING'].includes(event.status)),
  allQaEmailsProviderAccepted: notifications.every((event) => event.channel !== 'email' || (event.status === 'SENT' && event.providerStatus === 'accepted' && event.providerMessageId)),
  noGlobalNotificationPending: globalPendingNotifications === 0,
  noTemporaryAvailabilityBlock: qaBlocks === 0,
  noExternalCalendarEvent: externalCalendarEvents.length === 0,
  cancellationCalendarRecorded: reservation.calendarSyncLogs.some((log) => log.action === 'DELETE' && log.status === 'SKIPPED'),
  auditHistoryRetained: auditLogs.length > 0 && reservation.transitions.some((transition) => transition.toStatus === 'CANCELLED'),
};
if (Object.values(checks).some((value) => !value)) throw new Error(`Phase 17 reconciliation failed: ${JSON.stringify(checks)}`);

const evidence = {
  qaRunId,
  reconciledAt: new Date().toISOString(),
  executionNote: 'The real-browser run completed every production API submission. Its first runner exited only because the expected creative-form success phrase was stale; automatic cleanup completed and this independent reconciliation proves the terminal state.',
  checks,
  reservation: {
    id: reservation.id,
    reference: reservation.reference,
    startAtUtc: reservation.startAt,
    startAtDouala: new Intl.DateTimeFormat('fr-CM', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Douala' }).format(reservation.startAt),
    status: reservation.status,
    intentId: reservation.reservationIntent?.id,
    transitionStatuses: reservation.transitions.map((transition) => transition.toStatus),
  },
  payment: reservation.payments.map((payment) => ({
    id: payment.id,
    status: payment.status,
    syntheticReference: true,
    transitionStatuses: payment.transitions.map((transition) => transition.toStatus),
  })),
  leads: leads.map((lead) => ({ id: lead.id, type: lead.type, status: lead.status, submissionKey: lead.submissionKey })),
  notifications: notifications.map((event) => ({
    id: event.id,
    channel: event.channel,
    type: event.type,
    status: event.status,
    attemptCount: event.attemptCount,
    providerStatus: event.providerStatus,
    providerMessageId: event.providerMessageId,
  })),
  calendar: reservation.calendarSyncLogs.map((log) => ({ id: log.id, action: log.action, status: log.status, providerStatus: log.providerStatus, externalEventId: log.externalEventId, error: log.error })),
  cleanup: { globalPendingNotifications, temporaryAvailabilityBlocks: qaBlocks, externalCalendarEvents: externalCalendarEvents.length },
  externalGates: {
    mailboxReceipt: 'OWNER_CONFIRMATION_REQUIRED',
    genuinePaymentVerification: 'REQUIRES_OPERATOR_SANDBOX_OR_OWNER_AUTHORIZED_REAL_TRANSACTION',
    calendarCreateUpdateDeleteAfterGenuinePayment: 'DEPENDS_ON_GENUINE_PAYMENT',
    whatsapp: 'DEFERRED_BY_OWNER',
    legalCompanyParticulars: 'DEFERRED_BY_OWNER',
  },
};
const evidenceDir = path.join(projectDir, 'private-media', 'qa-evidence');
await fs.mkdir(evidenceDir, { recursive: true, mode: 0o700 });
const evidencePath = path.join(evidenceDir, `${qaRunId}.json`);
await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
await fs.chmod(evidencePath, 0o600);
console.log(JSON.stringify({ qaRunId, evidencePath, checks, externalGates: evidence.externalGates }, null, 2));
await prisma.$disconnect();
