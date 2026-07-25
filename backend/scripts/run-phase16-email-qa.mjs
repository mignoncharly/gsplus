import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

if (!process.argv.includes('--send-one')) {
  throw new Error('Refusing external e-mail QA without --send-one. Exactly one idempotent QA event is permitted.');
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, '..');
dotenv.config({ path: path.join(backendDir, '.env'), quiet: true });
const [{ prisma }, notifications] = await Promise.all([
  import('../dist/db/prisma.js'),
  import('../dist/emails/notifications.js'),
]);

const qaRunId = 'QA-GSP-20260725-001';
const submissionKey = `${qaRunId}:email-outbox`;
let lead = await prisma.lead.findUnique({ where: { submissionKey } });
if (!lead) {
  lead = await prisma.lead.create({
    data: {
      submissionKey,
      type: 'QUOTE',
      status: 'NEW',
      name: qaRunId,
      subject: 'Contrôle de livraison e-mail transactionnel',
      message: 'Message de contrôle Phase 16. Aucun client réel; aucune réponse requise.',
      source: 'phase16-email-qa',
    },
  });
}

await notifications.queueLeadCreatedNotification(lead.id);
const idempotencyKey = `lead:${lead.id}:created:email:admin`;
const event = await prisma.notificationEvent.findUniqueOrThrow({ where: { idempotencyKey } });
const firstResult = await notifications.processNotificationEvent(event.id);
const secondResult = await notifications.processNotificationEvent(event.id);
const delivered = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
const duplicateCount = await prisma.notificationEvent.count({ where: { idempotencyKey } });
await prisma.lead.update({ where: { id: lead.id }, data: { status: 'ARCHIVED' } });

if (delivered.status !== 'SENT' || delivered.attemptCount !== 1 || !delivered.providerMessageId) {
  throw new Error(`QA e-mail did not reach the SMTP accepted state: ${delivered.status}, attempts ${delivered.attemptCount}.`);
}
if (duplicateCount !== 1 || secondResult !== 'skipped') {
  throw new Error(`Idempotency verification failed: ${duplicateCount} events, second result ${secondResult}.`);
}

console.log(JSON.stringify({
  qaRunId,
  leadId: lead.id,
  leadFinalStatus: 'ARCHIVED',
  notificationEventId: delivered.id,
  notificationStatus: delivered.status,
  attemptCount: delivered.attemptCount,
  providerMessageId: delivered.providerMessageId,
  providerStatus: delivered.providerStatus,
  firstResult,
  repeatedProcessingResult: secondResult,
  duplicateCount,
  mailboxReceipt: 'OWNER_CONFIRMATION_REQUIRED',
}, null, 2));
await prisma.$disconnect();
