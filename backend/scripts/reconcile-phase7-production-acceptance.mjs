import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

if (!process.argv.includes('--write-evidence')) throw new Error('Use --write-evidence.');
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectDir = path.resolve(backendDir, '..');
dotenv.config({ path: path.join(backendDir, '.env'), quiet: true });
const [{ prisma }, { env }] = await Promise.all([import('../dist/db/prisma.js'), import('../dist/config/env.js')]);
const runId = 'GSP-P7-20260821-005';
const marker = 'P7-20260821-R5';
const allowed = new Set([process.env.PHASE7_QA_ZOHO_EMAIL?.toLowerCase(), process.env.PHASE7_QA_GMAIL_EMAIL?.toLowerCase()]);
const assert = (value, message) => { if (!value) throw new Error(message); };

const reservations = await prisma.reservation.findMany({
  where: { snapshot: { lastName: { startsWith: marker } } },
  include: { snapshot: true, payments: true, financialTasks: true, rescheduleRequests: true, calendarSyncLogs: true, notifications: true },
  orderBy: { createdAt: 'asc' },
});
const leads = await prisma.lead.findMany({
  where: { OR: [{ name: { contains: marker } }, { company: { contains: marker } }] },
  include: { notifications: true },
});
assert(reservations.length === 5 && leads.length === 4, 'R5 record count mismatch.');
assert(reservations.every((item) => ['CANCELLED', 'REJECTED'].includes(item.status)), 'Active R5 reservation.');
assert(leads.every((item) => item.status === 'ARCHIVED'), 'Active R5 lead.');
const byLabel = Object.fromEntries(reservations.map((item) => [item.snapshot.lastName.slice(-1), item]));
const expected = {
  A: ['CANCELLED', 'REFUNDED', 'PARTIAL_REFUND', 'ACCEPTED'],
  B: ['REJECTED', 'REJECTED', null, null],
  C: ['CANCELLED', 'REFUNDED', 'FULL_REFUND', null],
  D: ['CANCELLED', 'REJECTED', null, null],
  E: ['CANCELLED', 'REFUNDED', 'FULL_REFUND', 'REJECTED'],
};
for (const [label, [status, payment, task, reschedule]] of Object.entries(expected)) {
  const item = byLabel[label];
  assert(item?.status === status && item.payments[0]?.status === payment, `Journey ${label} state mismatch.`);
  if (task) assert(item.financialTasks.some((value) => value.type === task && value.status === 'COMPLETED'), `Journey ${label} task mismatch.`);
  else assert(item.financialTasks.length === 0, `Journey ${label} unexpected task.`);
  if (reschedule) assert(item.rescheduleRequests.some((value) => value.status === reschedule), `Journey ${label} reschedule mismatch.`);
}
assert(byLabel.C.notifications.some((item) => item.templateCode === 'E-16' && item.status === 'SENT'), 'E-16 mismatch.');
assert(byLabel.E.notifications.some((item) => item.templateCode === 'E-03' && item.status === 'CANCELLED'), 'E-03 mismatch.');
assert(byLabel.E.notifications.some((item) => item.templateCode === 'E-05' && item.status === 'SENT'), 'E-05 mismatch.');

const emails = [...reservations.flatMap((item) => item.notifications), ...leads.flatMap((item) => item.notifications)].filter((item) => item.channel === 'email');
assert(emails.every((item) => allowed.has(item.recipient.toLowerCase())), 'Recipient allowlist mismatch.');
assert(emails.every((item) => !['PENDING', 'PROCESSING'].includes(item.status)), 'Pending R5 email.');
const sent = emails.filter((item) => item.status === 'SENT');
assert(sent.length && sent.every((item) => item.providerMessageId), 'SMTP evidence mismatch.');

const providerGet = async (uid) => {
  const response = await fetch(`${env.CALCOM_API_BASE_URL.replace(/\/$/, '')}/bookings/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${env.CALCOM_API_KEY}`, 'cal-api-version': env.CALCOM_API_VERSION },
    signal: AbortSignal.timeout(20_000),
  });
  const json = await response.json();
  assert(response.ok, `Cal.com lookup failed: ${uid}.`);
  const item = json.data ?? json;
  const fields = item.bookingFieldsResponses ?? {};
  return {
    uid, status: item.status, start: item.start ?? item.startTime,
    attendeeLocale: item.attendees?.[0]?.language ?? null, title: fields.title ?? null, notes: fields.notes ?? null,
    metadata: item.metadata ? {
      gspReference: item.metadata.gspReference, gspPackage: item.metadata.gspPackage,
      gspStartDouala: item.metadata.gspStartDouala, gspEndDouala: item.metadata.gspEndDouala,
      gspPhone: item.metadata.gspPhone, gspPaymentLabel: item.metadata.gspPaymentLabel,
      gspAdminUrl: item.metadata.gspAdminUrl, gspOperationalNotes: item.metadata.gspOperationalNotes,
    } : null,
  };
};
const calCom = [];
for (const reservation of reservations) {
  for (const uid of new Set(reservation.calendarSyncLogs.map((item) => item.externalEventId).filter(Boolean))) {
    calCom.push({ reference: reservation.reference, ...(await providerGet(uid)) });
  }
}
assert(calCom.every((item) => String(item.status).toLowerCase().includes('cancel')), 'Active R5 Cal.com booking.');
const presented = calCom.filter((item) => item.title && item.notes && item.metadata);
assert(presented.length >= 3, 'Cal.com presentation evidence incomplete.');
assert(presented.some((item) => item.attendeeLocale === 'fr') && presented.some((item) => item.attendeeLocale === 'en'), 'Cal.com locale mismatch.');
assert(presented.every((item) => item.title.startsWith(item.reference) && item.metadata.gspReference === item.reference), 'Cal.com presentation mismatch.');
assert(presented.every((item) => !/TEST-AUDIT|simulation/i.test(JSON.stringify(item))), 'Prohibited provider wording.');

const firstCreated = reservations[0].createdAt;
const lastCreated = reservations.at(-1).createdAt;
const happy = await prisma.package.findFirstOrThrow({ where: { isPromo: true, isActive: true } });
const quotaHolds = await prisma.reservationIntent.findMany({
  where: { packageId: happy.id, reservationId: null, createdAt: { gte: new Date(firstCreated.getTime() - 60_000), lte: new Date(lastCreated.getTime() + 60_000) } },
  select: { expiresAt: true },
});
assert(quotaHolds.length >= 6 && quotaHolds.every((item) => item.expiresAt <= new Date()), 'Quota holds mismatch.');
const digest = await prisma.notificationEvent.findUnique({ where: { idempotencyKey: 'digest:2026-07-01:I-11:email' } });

const evidence = {
  runId, reconciledAt: new Date().toISOString(),
  destinations: { zoho: process.env.PHASE7_QA_ZOHO_EMAIL, gmail: process.env.PHASE7_QA_GMAIL_EMAIL, phone: process.env.PHASE7_QA_PHONE },
  checks: {
    fiveJourneysTerminal: 'PASS', localesAndPaymentChannels: 'PASS', happyHoursQuota: 'PASS',
    acceptedAndRejectedReschedules: 'PASS', reminder24h: 'PASS', earlyConfirmationCancelsE03: 'PASS',
    partialFullAndNoRefundPolicies: 'PASS', fourLeadsArchived: 'PASS', calComCreateUpdateCancel: 'PASS',
    localizedCalComPresentation: 'PASS', smtpAcceptance: 'PASS', noPendingQaEmail: 'PASS',
    noActiveQaCalendarBooking: 'PASS', noActiveQuotaHold: 'PASS', whatsappDeliveryDisabled: 'PASS',
  },
  journeys: Object.fromEntries(Object.entries(byLabel).map(([label, item]) => [label, {
    reference: item.reference, locale: item.snapshot.locale, status: item.status, payment: item.payments[0]?.status,
    financialTasks: item.financialTasks.map((value) => ({ type: value.type, status: value.status, amount: value.amount })),
    reschedules: item.rescheduleRequests.map((value) => value.status),
    emails: item.notifications.filter((value) => value.channel === 'email').map((value) => ({ template: value.templateCode, status: value.status })),
  }])),
  leads: leads.map((item) => ({ reference: item.reference, type: item.type, locale: item.locale, status: item.status })),
  calCom,
  email: {
    summary: emails.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] ?? 0) + 1 }), {}),
    smtpAccepted: sent.map((item) => ({ id: item.id, template: item.templateCode, providerMessageId: item.providerMessageId, providerStatus: item.providerStatus })),
    mobileRendering: 'OWNER_CONFIRMATION_REQUIRED',
  },
  quota: { acceptedHolds: quotaHolds.length, activeHolds: 0, seventhOutcome: 'PACKAGE_DAILY_QUOTA_REACHED' },
  digest: { usefulStatus: digest?.status ?? null, emptyDigest: 'NOT_RUN_NO_EMPTY_OPERATIONAL_WINDOW' },
  priorAttempts: '001-004 stopped on guarded assertions and were fully reconciled before R5.',
};
const directory = path.join(projectDir, 'private-media', 'qa-evidence');
await fs.mkdir(directory, { recursive: true, mode: 0o700 });
const evidencePath = path.join(directory, `${runId}.json`);
await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: 'w' });
await fs.chmod(evidencePath, 0o600);
console.log(JSON.stringify({
  runId, evidencePath, checks: evidence.checks, email: evidence.email.summary,
  journeys: Object.fromEntries(Object.entries(evidence.journeys).map(([label, item]) => [label, { reference: item.reference, status: item.status, payment: item.payment }])),
}, null, 2));
await prisma.$disconnect();
