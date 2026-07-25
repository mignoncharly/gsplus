import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { chromium } from '../../frontend/node_modules/playwright/index.mjs';

if (!process.argv.includes('--execute-production')) {
  throw new Error('Refusing production QA without --execute-production.');
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, '..');
const projectDir = path.resolve(backendDir, '..');
dotenv.config({ path: path.join(backendDir, '.env'), quiet: true });

const [{ prisma }, { env }] = await Promise.all([
  import('../dist/db/prisma.js'),
  import('../dist/config/env.js'),
]);

const qaRunId = 'QA-GSP-20260725-002';
const origin = 'https://gsplus.vip';
const qaEmail = env.ADMIN_NOTIFICATION_EMAIL;
const qaPhone = '+237673026654';
const syntheticPaymentReference = 'QAGSP20260725002';
const created = { blockId: null, reservationId: null, paymentId: null, leadIds: [] };
const evidence = { qaRunId, startedAt: new Date().toISOString(), checks: {}, created, externalGates: {} };

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const jsonFetch = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  return { response, payload };
};

const admin = await prisma.adminUser.findFirst({
  where: { isActive: true },
  orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
});
assert(admin, 'No active administrator is available for controlled cleanup.');
const adminToken = jwt.sign(
  { role: admin.role, sessionVersion: admin.sessionVersion },
  env.ADMIN_SESSION_SECRET,
  {
    algorithm: 'HS256',
    audience: 'golden-studio-plus-admin',
    issuer: 'golden-studio-plus',
    subject: admin.id,
    expiresIn: 3600,
  },
);
const adminHeaders = {
  'Content-Type': 'application/json',
  Cookie: `__Host-gsp_admin_session=${adminToken}`,
};
const adminFetch = (pathname, options = {}) => jsonFetch(`${origin}${pathname}`, {
  ...options,
  headers: { ...adminHeaders, ...(options.headers ?? {}) },
});

const archiveLead = async (id) => {
  const { response } = await adminFetch(`/api/admin/leads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'ARCHIVED' }),
  });
  assert(response.ok, `Could not archive QA lead ${id}.`);
};

const cleanup = async () => {
  if (created.blockId) {
    const { response } = await adminFetch(`/api/admin/availability-blocks/${created.blockId}`, { method: 'DELETE' });
    if (response.ok || response.status === 404) created.blockId = null;
  }
  for (const leadId of created.leadIds) await archiveLead(leadId);
  if (created.paymentId) {
    const payment = await prisma.payment.findUnique({ where: { id: created.paymentId } });
    if (payment?.status === 'PENDING') {
      const { response, payload } = await adminFetch(`/api/admin/payments/${created.paymentId}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'REJECTED',
          reason: `${qaRunId}: synthetic reference; never provider-verified`,
        }),
      });
      assert(response.ok, `Could not reject the synthetic QA payment: ${JSON.stringify(payload)}`);
    }
  }
  if (created.reservationId) {
    const reservation = await prisma.reservation.findUnique({ where: { id: created.reservationId } });
    if (reservation && !['CANCELLED', 'REJECTED', 'EXPIRED'].includes(reservation.status)) {
      const { response, payload } = await adminFetch(`/api/admin/reservations/${created.reservationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'CANCELLED',
          reason: `${qaRunId}: controlled production QA cleanup`,
        }),
      });
      assert(response.ok, `Could not cancel QA reservation: ${JSON.stringify(payload)}`);
    }
  }
};

let browser;
try {
  const existing = await prisma.reservation.findFirst({
    where: { customer: { firstName: qaRunId } },
    include: { payments: true },
  });
  assert(!existing, `${qaRunId} already exists; refusing to create another production run.`);

  const before = {
    reservations: await prisma.reservation.count(),
    payments: await prisma.payment.count(),
    leads: await prisma.lead.count(),
    notifications: await prisma.notificationEvent.count(),
    availabilityBlocks: await prisma.availabilityBlock.count(),
    pendingNotifications: await prisma.notificationEvent.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
  };
  evidence.before = before;

  const packageResult = await jsonFetch(`${origin}/api/packages`);
  assert(packageResult.response.ok && packageResult.payload?.data?.length, 'No active production package found.');
  const packageItem = packageResult.payload.data.find((item) => !item.isPromo) ?? packageResult.payload.data[0];

  const today = new Date();
  const fromDate = new Date(today.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const toDate = new Date(today.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
  const availabilityUrl = `${origin}/api/availability?${new URLSearchParams({
    from: fromDate,
    to: toDate,
    packageId: packageItem.id,
  })}`;
  const availabilityResult = await jsonFetch(availabilityUrl);
  assert(availabilityResult.response.ok, 'Production availability query failed.');
  const candidateSlots = availabilityResult.payload.data.days.flatMap((day) =>
    day.slots.filter((slot) => slot.available).map((slot) => ({ ...slot, date: day.date })),
  );
  assert(candidateSlots.length >= 2, 'Two quiet QA slots were not available 7–14 days ahead.');
  const bookingSlot = candidateSlots[0];
  const movedBlockSlot = candidateSlots.find((slot) => slot.startAt !== bookingSlot.startAt && slot.startAt >= bookingSlot.endAt);
  assert(movedBlockSlot, 'No non-overlapping slot is available for the block edit check.');

  const blockCreate = await adminFetch('/api/admin/availability-blocks', {
    method: 'POST',
    body: JSON.stringify({
      startAt: bookingSlot.startAt,
      endAt: bookingSlot.endAt,
      reason: `${qaRunId}: temporary availability acceptance`,
    }),
  });
  assert(blockCreate.response.status === 201, `Availability block create failed: ${JSON.stringify(blockCreate.payload)}`);
  created.blockId = blockCreate.payload.data.id;

  const blockedAvailability = await jsonFetch(availabilityUrl);
  const blocked = blockedAvailability.payload.data.days
    .find((day) => day.date === bookingSlot.date)?.slots
    .find((slot) => slot.startAt === bookingSlot.startAt);
  assert(blocked?.available === false && blocked.reason === 'availability_block', 'Created block did not close the public slot.');

  const blockUpdate = await adminFetch(`/api/admin/availability-blocks/${created.blockId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      startAt: movedBlockSlot.startAt,
      endAt: movedBlockSlot.endAt,
      reason: `${qaRunId}: edited availability acceptance`,
    }),
  });
  assert(blockUpdate.response.ok, `Availability block update failed: ${JSON.stringify(blockUpdate.payload)}`);
  const movedAvailability = await jsonFetch(availabilityUrl);
  const originalAfterMove = movedAvailability.payload.data.days
    .find((day) => day.date === bookingSlot.date)?.slots
    .find((slot) => slot.startAt === bookingSlot.startAt);
  const movedAfterMove = movedAvailability.payload.data.days
    .find((day) => day.date === movedBlockSlot.date)?.slots
    .find((slot) => slot.startAt === movedBlockSlot.startAt);
  assert(originalAfterMove?.available === true, 'Editing the block did not reopen the original slot.');
  assert(movedAfterMove?.available === false && movedAfterMove.reason === 'availability_block', 'Editing the block did not close its new slot.');

  const blockDelete = await adminFetch(`/api/admin/availability-blocks/${created.blockId}`, { method: 'DELETE' });
  assert(blockDelete.response.status === 204, 'Availability block deletion failed.');
  created.blockId = null;
  const reopenedAvailability = await jsonFetch(availabilityUrl);
  const reopened = reopenedAvailability.payload.data.days
    .find((day) => day.date === movedBlockSlot.date)?.slots
    .find((slot) => slot.startAt === movedBlockSlot.startAt);
  assert(reopened?.available === true, 'Deleting the block did not reopen the public slot.');
  evidence.checks.availabilityLifecycle = 'PASS';

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'fr-FR', timezoneId: 'Africa/Douala' });
  const page = await context.newPage();
  const uiAvailabilityPromise = page.waitForResponse((response) =>
    response.url().includes('/api/availability') && response.ok(),
  );
  await page.goto(`${origin}/reservation?pack=${encodeURIComponent(packageItem.id)}`, { waitUntil: 'domcontentloaded' });
  const uiAvailabilityResponse = await uiAvailabilityPromise;
  const uiAvailability = (await uiAvailabilityResponse.json()).data;
  await page.getByLabel('Formule de réservation').waitFor();
  await page.getByRole('button', { name: /Continuer/ }).click();
  const visibleDays = uiAvailability.days.filter((day) => !day.isClosed && day.slots.length > 0).slice(0, 21);
  const dateIndex = visibleDays.findIndex((day) => day.date === bookingSlot.date);
  assert(dateIndex >= 0, 'Selected QA date is not present in the public calendar window.');
  await page.locator('.date-card-btn').nth(dateIndex).click();
  const slotButton = page.locator('.slot-available').filter({ hasText: bookingSlot.time }).first();
  await slotButton.click();
  await page.getByRole('button', { name: /Continuer/ }).click();

  await page.getByLabel('Nom *', { exact: true }).fill(qaRunId);
  await page.getByLabel('Prénom *').fill(qaRunId);
  await page.getByLabel('Téléphone (WhatsApp) *').fill(qaPhone);
  await page.getByLabel('Adresse email *').fill(qaEmail);
  await page.getByLabel('Genre *').selectOption('Feminin');
  await page.getByLabel(/J'accepte et certifie/).check();
  if (packageItem.isPromo) await page.getByLabel(/J'accepte expressément/).check();
  await page.getByLabel(/Notes ou demandes spécifiques/).fill(`${qaRunId}: synthetic production acceptance; no customer data.`);
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.getByLabel('Téléphone de paiement (MoMo/Orange)').fill(qaPhone);
  await page.getByLabel('Identifiant ID / Réf de Transaction SMS').fill(syntheticPaymentReference);

  const reservationResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/reservations') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Valider ma séance' }).click();
  const reservationResponse = await reservationResponsePromise;
  assert(reservationResponse.status() === 201, `UI reservation failed with ${reservationResponse.status()}.`);
  const reservationPayload = reservationResponse.request().postDataJSON();
  const reservationData = (await reservationResponse.json()).data;
  created.reservationId = reservationData.id;
  created.paymentId = reservationData.payments[0]?.id ?? null;
  assert(created.paymentId, 'The production QA reservation did not create one pending payment.');
  assert(await page.getByText(reservationData.reference, { exact: false }).count(), 'Server reference is absent from the confirmation page.');

  const repeatedReservation = await page.request.post(`${origin}/api/reservations`, { data: reservationPayload });
  assert(repeatedReservation.status() === 201, 'Idempotent reservation repetition did not return the original result.');
  assert((await repeatedReservation.json()).data.id === created.reservationId, 'Idempotent repetition returned a different reservation.');

  const conflictIntent = await page.request.post(`${origin}/api/reservation-intents`, {
    data: { packageId: packageItem.id, startAt: bookingSlot.startAt, idempotencyKey: randomUUID(), website: '' },
  });
  assert(conflictIntent.status() === 409, `Occupied slot intent was not rejected: ${conflictIntent.status()}.`);
  evidence.checks.bookingBrowserAndIdempotency = 'PASS';
  evidence.booking = {
    reservationId: created.reservationId,
    paymentId: created.paymentId,
    reference: reservationData.reference,
    startAt: reservationData.startAt,
    displayedDoualaTime: new Intl.DateTimeFormat('fr-CM', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Douala' }).format(new Date(reservationData.startAt)),
    repeatedReservationId: created.reservationId,
    occupiedSlotStatus: 409,
    syntheticPaymentDisposition: 'PENDING_THEN_REJECTED_NEVER_VERIFIED',
  };

  const submitUiLead = async ({ pathname, endpoint, fill, successText }) => {
    await page.goto(`${origin}${pathname}`, { waitUntil: 'domcontentloaded' });
    await fill(page);
    const responsePromise = page.waitForResponse((response) => response.url().endsWith(endpoint) && response.request().method() === 'POST');
    const submitButton = page.locator('form button[type="submit"]');
    await submitButton.click();
    const response = await responsePromise;
    assert(response.status() === 201, `${endpoint} UI submission failed with ${response.status()}.`);
    const payload = response.request().postDataJSON();
    const lead = (await response.json()).data;
    created.leadIds.push(lead.id);
    assert(await page.getByText(successText, { exact: false }).count(), `${endpoint} success state was not visible.`);
    const repeated = await page.request.post(`${origin}${endpoint}`, { data: payload });
    assert(repeated.status() === 201 && (await repeated.json()).data.id === lead.id, `${endpoint} idempotency failed.`);
    return { id: lead.id, type: lead.type, submissionKey: payload.submissionKey };
  };

  const leads = [];
  leads.push(await submitUiLead({
    pathname: '/contact', endpoint: '/api/contact', successText: 'Message envoyé',
    fill: async (p) => {
      await p.getByLabel('Nom complet *').fill(`${qaRunId} CONTACT`);
      await p.getByLabel('Email *').fill(qaEmail);
      await p.getByLabel('Votre message *').fill(`${qaRunId}: controlled contact flow acceptance.`);
    },
  }));
  leads.push(await submitUiLead({
    pathname: '/corporate', endpoint: '/api/b2b-inquiries', successText: 'Demande envoyée avec succès',
    fill: async (p) => {
      await p.getByLabel("Nom de l'entreprise *").fill(`${qaRunId} ENTREPRISE`);
      await p.getByLabel('NIU / RCCM *').fill('QA-NON-LEGAL');
      await p.getByLabel('Personne de contact *').fill(`${qaRunId} B2B`);
      await p.getByLabel('Téléphone direct *').fill(qaPhone);
      await p.getByLabel("Email de l'entreprise *").fill(qaEmail);
      await p.getByLabel('Nature du besoin *').selectOption('Portraits de collaborateurs');
      await p.getByLabel(/Détails/).fill(`${qaRunId}: controlled B2B flow acceptance.`);
    },
  }));
  leads.push(await submitUiLead({
    pathname: '/services-creatifs#devis-creatif', endpoint: '/api/quote-requests', successText: 'Demande envoyée',
    fill: async (p) => {
      await p.getByLabel('Nom complet ou Entreprise *').fill(`${qaRunId} QUOTE`);
      await p.getByLabel('Téléphone / WhatsApp *').fill(qaPhone);
      await p.getByLabel(/Adresse email/).fill(qaEmail);
      await p.getByLabel('Service souhaité *').selectOption('Retouche & Restauration');
      await p.getByLabel('Description détaillée du besoin *').fill(`${qaRunId}: controlled creative quote acceptance.`);
    },
  }));
  evidence.leads = leads;
  evidence.checks.contactB2BQuoteBrowserAndIdempotency = 'PASS';

  await cleanup();
  await new Promise((resolve) => setTimeout(resolve, Math.min(env.NOTIFICATION_WORKER_INTERVAL_MS + 5_000, 25_000)));

  const reservationFinal = await prisma.reservation.findUniqueOrThrow({
    where: { id: created.reservationId },
    include: { payments: true, notifications: true, calendarSyncLogs: true, reservationIntent: true },
  });
  const leadsFinal = await prisma.lead.findMany({ where: { id: { in: created.leadIds } }, include: { notifications: true } });
  const allQaNotifications = [...reservationFinal.notifications, ...leadsFinal.flatMap((lead) => lead.notifications)];
  const pendingQaNotifications = allQaNotifications.filter((event) => ['PENDING', 'PROCESSING'].includes(event.status));
  const finalBlockCount = await prisma.availabilityBlock.count({ where: { reason: { startsWith: qaRunId } } });
  const duplicateReservationCount = await prisma.reservation.count({ where: { id: created.reservationId } });
  const duplicatePaymentCount = await prisma.payment.count({ where: { reservationId: created.reservationId } });
  const qaExternalCalendarEvents = reservationFinal.calendarSyncLogs.filter((log) => log.externalEventId);

  assert(reservationFinal.status === 'CANCELLED', 'QA reservation is not cancelled.');
  assert(reservationFinal.payments.length === 1 && reservationFinal.payments[0].status === 'REJECTED', 'Synthetic payment is not explicitly rejected.');
  assert(leadsFinal.length === 3 && leadsFinal.every((lead) => lead.status === 'ARCHIVED'), 'QA leads are not all archived.');
  assert(duplicateReservationCount === 1 && duplicatePaymentCount === 1, 'Reservation or payment reconciliation found duplicates.');
  assert(pendingQaNotifications.length === 0, 'QA notifications remain pending or processing.');
  assert(finalBlockCount === 0, 'A QA availability block remains.');
  assert(qaExternalCalendarEvents.length === 0, 'A QA Cal.com event remains.');

  evidence.finishedAt = new Date().toISOString();
  evidence.checks.syntheticPaymentNeverVerified = 'PASS';
  evidence.checks.cleanupReconciliation = 'PASS';
  evidence.final = {
    reservationStatus: reservationFinal.status,
    paymentStatus: reservationFinal.payments[0].status,
    leadStatuses: leadsFinal.map((lead) => ({ id: lead.id, status: lead.status })),
    notificationStatuses: allQaNotifications.map((event) => ({ id: event.id, channel: event.channel, type: event.type, status: event.status, providerStatus: event.providerStatus })),
    pendingQaNotifications: pendingQaNotifications.length,
    availabilityBlocks: finalBlockCount,
    externalCalendarEvents: qaExternalCalendarEvents.length,
    reservationCount: duplicateReservationCount,
    paymentCount: duplicatePaymentCount,
  };
  evidence.externalGates = {
    mailboxReceipt: 'OWNER_CONFIRMATION_REQUIRED',
    genuinePaymentVerification: 'NOT_RUN_REQUIRES_OPERATOR_SANDBOX_OR_OWNER_AUTHORIZED_TRANSACTION',
    calendarCreateUpdateDeleteAfterGenuinePayment: 'NOT_RUN_DEPENDS_ON_GENUINE_PAYMENT',
    whatsapp: 'DEFERRED_BY_OWNER',
    legalCompanyParticulars: 'DEFERRED_BY_OWNER',
  };

  const evidenceDir = path.join(projectDir, 'private-media', 'qa-evidence');
  await fs.mkdir(evidenceDir, { recursive: true, mode: 0o700 });
  const evidencePath = path.join(evidenceDir, `${qaRunId}.json`);
  await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(evidencePath, 0o600);
  console.log(JSON.stringify({
    qaRunId,
    evidencePath,
    checks: evidence.checks,
    booking: evidence.booking,
    final: evidence.final,
    externalGates: evidence.externalGates,
  }, null, 2));
} catch (error) {
  try { await cleanup(); } catch (cleanupError) { console.error('QA cleanup failed', cleanupError); }
  throw error;
} finally {
  if (browser) await browser.close();
  await prisma.$disconnect();
}
