import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, '..');
dotenv.config({ path: path.join(backendDir, '.env'), quiet: true });
const { prisma } = await import('../dist/db/prisma.js');

const apply = process.argv.includes('--apply');
const cutoff = new Date('2026-07-22T00:00:00.000Z');
const events = await prisma.notificationEvent.findMany({
  where: {
    channel: 'email',
    status: 'FAILED',
    resolution: null,
    createdAt: { lt: cutoff },
    error: 'LEGACY_SMTP_AUTHENTICATION_FAILED',
  },
  orderBy: { createdAt: 'asc' },
  include: {
    reservation: { select: { reference: true, status: true } },
    lead: { select: { type: true, status: true } },
  },
});

if (events.length !== 14) {
  throw new Error(`Expected exactly 14 unclassified legacy SMTP failures, found ${events.length}. No changes made.`);
}

const obsoleteReservationStatuses = new Set(['CANCELLED', 'REJECTED', 'EXPIRED']);
const plans = events.map((event) => {
  const obsolete = Boolean(
    (event.reservation && obsoleteReservationStatuses.has(event.reservation.status)) ||
    event.lead?.status === 'ARCHIVED',
  );
  return {
    id: event.id,
    reference: event.reservation?.reference ?? `${event.lead?.type ?? 'GENERAL'}:${event.lead?.status ?? 'NONE'}`,
    entityStatus: event.reservation?.status ?? event.lead?.status ?? 'NONE',
    type: event.type,
    resolution: obsolete ? 'OBSOLETE' : 'ACTIONABLE_REVIEW_REQUIRED',
    note: obsolete
      ? 'Legacy SMTP authentication failure; the related reservation or lead is terminal. Historical message must not be resent.'
      : 'Legacy SMTP authentication failure; individual owner review is required before any retry. No automatic resend is authorized.',
  };
});

console.table(plans.map(({ note, ...summary }) => summary));
console.log(`Disposition summary: ${plans.filter((item) => item.resolution === 'OBSOLETE').length} obsolete, ${plans.filter((item) => item.resolution === 'ACTIONABLE_REVIEW_REQUIRED').length} owner-review required.`);

if (!apply) {
  console.log('Dry run only. Re-run with --apply after reviewing all 14 rows.');
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.$transaction(
  plans.map((plan) => prisma.notificationEvent.update({
    where: { id: plan.id },
    data: {
      resolution: plan.resolution,
      resolutionNote: plan.note,
      resolvedAt: new Date(),
      resolvedBy: 'phase16-historical-review-2026-07-25',
    },
  })),
);

const remaining = await prisma.notificationEvent.count({
  where: { id: { in: plans.map((item) => item.id) }, resolution: null },
});
if (remaining !== 0) throw new Error(`Classification verification failed: ${remaining} events remain unclassified.`);
console.log('Applied and verified 14 historical dispositions. No notification was queued or sent.');
await prisma.$disconnect();
