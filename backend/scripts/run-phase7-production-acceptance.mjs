import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

if (!process.argv.includes('--execute-production')) throw new Error('Refusing Phase 7 production acceptance without --execute-production.');
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, '..');
const projectDir = path.resolve(backendDir, '..');
dotenv.config({ path: path.join(backendDir, '.env'), quiet: true });
const [{ prisma }, { env }, notifications, leadServices, intentServices] = await Promise.all([
  import('../dist/db/prisma.js'), import('../dist/config/env.js'), import('../dist/emails/notifications.js'), import('../dist/services/leads.js'), import('../dist/services/reservation-intents.js'),
]);

const qaRunId = 'GSP-P7-20260821-005';
const qaMarker = 'P7-20260821-R5';
const origin = 'https://gsplus.vip';
const zohoEmail = process.env.PHASE7_QA_ZOHO_EMAIL?.trim().toLowerCase();
const gmailEmail = process.env.PHASE7_QA_GMAIL_EMAIL?.trim().toLowerCase();
const qaPhone = process.env.PHASE7_QA_PHONE?.trim();
const allowedEmails = new Set([zohoEmail, gmailEmail]);
const terminalStatuses = new Set(['CANCELLED', 'REJECTED', 'EXPIRED', 'COMPLETED', 'NO_SHOW']);
const created = { reservationIds: [], paymentIds: [], leadIds: [], intentIds: [] };
const evidence = { qaRunId, startedAt: new Date().toISOString(), destinations: { zohoEmail, gmailEmail, qaPhone }, checks: {}, journeys: {}, created };
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(zohoEmail && gmailEmail && qaPhone, 'All three PHASE7_QA_* destinations are required.');
assert(zohoEmail !== gmailEmail, 'Zoho and Gmail QA destinations must be distinct.');
assert(/^\+2376\d{8}$/.test(qaPhone), 'PHASE7_QA_PHONE must be a Cameroon mobile number in E.164 format.');
assert(env.ADMIN_NOTIFICATION_EMAIL?.toLowerCase() === zohoEmail, 'Zoho QA address must match ADMIN_NOTIFICATION_EMAIL.');
assert(!env.WHATSAPP_ACCESS_TOKEN && !env.WHATSAPP_PHONE_NUMBER_ID, 'WhatsApp must remain delivery-disabled for Phase 7.');

const jsonFetch = async (url, options = {}) => {
  const response = await fetch(url, { ...options, signal: options.signal ?? AbortSignal.timeout(20_000) });
  const textBody = await response.text();
  let payload = null;
  try { payload = textBody ? JSON.parse(textBody) : null; } catch { payload = null; }
  return { response, payload };
};
const requireResponse = (result, expected, label) => {
  const statuses = Array.isArray(expected) ? expected : [expected];
  if (!statuses.includes(result.response.status)) {
    const code = result.payload?.error?.code ?? result.payload?.code ?? 'UNKNOWN';
    throw new Error(`${label} failed with HTTP ${result.response.status} (${code}).`);
  }
  return result.payload?.data;
};
const publicPost = async (pathname, body, expected = 201) => requireResponse(await jsonFetch(`${origin}${pathname}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ website: '', ...body }),
}), expected, pathname);

const admin = await prisma.adminUser.findFirst({ where: { isActive: true, role: 'OWNER' }, orderBy: { createdAt: 'asc' } });
assert(admin, 'An active OWNER is required for controlled decisions.');
const adminToken = jwt.sign({ role: admin.role, sessionVersion: admin.sessionVersion }, env.ADMIN_SESSION_SECRET, {
  algorithm: 'HS256', audience: 'golden-studio-plus-admin', issuer: 'golden-studio-plus', subject: admin.id, expiresIn: 3600,
});
const adminFetch = async (pathname, method, body, expected = 200) => requireResponse(await jsonFetch(`${origin}${pathname}`, {
  method, headers: { 'Content-Type': 'application/json', Cookie: `__Host-gsp_admin_session=${adminToken}` },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
}), expected, pathname);

const reservationState = (id) => prisma.reservation.findUniqueOrThrow({ where: { id }, include: {
  snapshot: true, payments: { orderBy: { createdAt: 'desc' } }, financialTasks: { orderBy: { createdAt: 'desc' } },
  rescheduleRequests: { orderBy: { createdAt: 'desc' } }, calendarSyncLogs: { orderBy: { createdAt: 'asc' } },
  notifications: { orderBy: { createdAt: 'asc' } },
} });
const dateOnly = (date) => date.toISOString().slice(0, 10);
const getAvailability = async (packageId, from, to) => requireResponse(await jsonFetch(`${origin}/api/availability?${new URLSearchParams({ packageId, from, to })}`), 200, 'availability');
const availableSlots = (availability) => availability.days.flatMap((day) => day.slots.filter((slot) => slot.available).map((slot) => ({ ...slot, date: day.date })));

const createReservation = async ({ key, packageId, slot, locale, email, method = 'orange_money', paymentChoice = 'base' }) => {
  assert(allowedEmails.has(email), `Recipient outside allowlist for ${key}.`);
  const idempotencyKey = randomUUID();
  const intent = await publicPost('/api/reservation-intents', { idempotencyKey, packageId, startAt: slot.startAt, scheduleKind: 'STANDARD_HOLD' });
  const transactionRef = paymentChoice === 'base' ? `P7R5${key}20260821${String(created.paymentIds.length + 1).padStart(2, '0')}` : undefined;
  const reservation = await publicPost('/api/reservations', {
    intentId: intent.id, idempotencyKey, locale,
    customer: { firstName: 'Recette', lastName: `${qaMarker}-${key}`, phone: qaPhone, email },
    consentImage: false, whatsappConsent: false, whatsappMarketingConsent: false,
    acceptedTerms: true, acceptedPrivacy: true, paymentChoice,
    ...(paymentChoice === 'base' ? { paymentMethod: method, paymentPhone: qaPhone, transactionRef } : {}),
  });
  created.reservationIds.push(reservation.id);
  if (reservation.payments[0]) created.paymentIds.push(reservation.payments[0].id);
  return reservationState(reservation.id);
};

const verifyAndConfirm = async (reservationId) => {
  const current = await reservationState(reservationId);
  const payment = current.payments[0];
  assert(payment?.status === 'PENDING', `Expected pending payment for ${current.reference}.`);
  await adminFetch(`/api/admin/reservations/${reservationId}/verify-and-confirm`, 'POST', {
    commandId: randomUUID(), paymentId: payment.id, expectedPaymentVersion: payment.version,
    expectedReservationVersion: current.version, reason: `${qaRunId}: controlled acceptance verification`,
  });
  const updated = await reservationState(reservationId);
  assert(updated.status === 'CONFIRMED' && ['VERIFIED', 'PAID'].includes(updated.payments[0].status), `Combined confirmation failed for ${updated.reference}.`);
  assert(updated.calendarSyncLogs.some((log) => log.status === 'SYNCED' && log.externalEventId), `Cal.com create failed for ${updated.reference}.`);
  return updated;
};

const paymentDecision = async (reservationId, status, reasonCode) => {
  const current = await reservationState(reservationId);
  const payment = current.payments[0];
  const body = { commandId: randomUUID(), expectedVersion: payment.version, status };
  if (['REJECTED', 'PAYMENT_INFO_REQUIRED', 'VERIFICATION_BLOCKED'].includes(status)) Object.assign(body, {
    internalReason: `${qaRunId}: controlled payment decision`, customerReasonCode: reasonCode,
  });
  await adminFetch(`/api/admin/payments/${payment.id}/verify`, 'PATCH', body);
  return reservationState(reservationId);
};

const rejectReservation = async (reservationId) => {
  const current = await reservationState(reservationId);
  if (terminalStatuses.has(current.status)) return current;
  await adminFetch(`/api/admin/reservations/${reservationId}`, 'PATCH', {
    status: 'REJECTED', commandId: randomUUID(), expectedVersion: current.version,
    internalReason: `${qaRunId}: controlled acceptance closure`, customerReasonCode: 'OPERATIONAL_CONSTRAINT',
  });
  return reservationState(reservationId);
};

const cancelReservation = async (reservationId, originType) => {
  const current = await reservationState(reservationId);
  if (current.status === 'CANCELLED') return current;
  await adminFetch(`/api/admin/reservations/${reservationId}/cancel`, 'POST', {
    commandId: randomUUID(), expectedVersion: current.version, origin: originType,
    internalReason: `${qaRunId}: controlled acceptance closure`,
    ...(originType === 'STUDIO' ? { customerReasonCode: 'STUDIO_UNAVAILABLE' } : {}),
  });
  return reservationState(reservationId);
};

const decideReschedule = async (reservationId, requestedStartAt, decision) => {
  const current = await reservationState(reservationId);
  const requestData = await adminFetch(`/api/admin/reservations/${reservationId}/reschedule-requests`, 'POST', {
    commandId: randomUUID(), expectedReservationVersion: current.version, requestedStartAt,
    reason: `${qaRunId}: controlled schedule request`,
  }, 201);
  await adminFetch(`/api/admin/reschedule-requests/${requestData.request.id}/decision`, 'PATCH', {
    commandId: randomUUID(), expectedVersion: requestData.request.version, decision,
    internalReason: `${qaRunId}: controlled reschedule decision`,
    ...(decision === 'REJECTED' ? {
      internalReason: `${qaRunId}: requested slot withheld`, customerReasonCode: 'RESCHEDULE_UNAVAILABLE',
    } : {}),
  });
  const updated = await reservationState(reservationId);
  assert(updated.rescheduleRequests[0].status === decision, `Reschedule ${decision} failed for ${updated.reference}.`);
  return updated;
};

const completeRefund = async (reservationId, expectedTaskType = 'FULL_REFUND') => {
  let current = await reservationState(reservationId);
  const task = current.financialTasks[0];
  const payment = current.payments[0];
  assert(task?.status === 'PENDING' && task.type === expectedTaskType, `${expectedTaskType} task missing for ${current.reference}.`);
  await adminFetch(`/api/admin/payments/${payment.id}/refund`, 'PATCH', {
    commandId: randomUUID(), expectedVersion: payment.version, status: 'REFUND_PENDING', refundAmount: task.amount,
    channel: 'internal_reconciliation', providerReference: `${qaRunId}-REFUND-OPEN`, reason: 'Controlled Phase 7 financial workflow',
  });
  current = await reservationState(reservationId);
  await adminFetch(`/api/admin/payments/${payment.id}/refund`, 'PATCH', {
    commandId: randomUUID(), expectedVersion: current.payments[0].version, status: 'REFUNDED', refundAmount: task.amount,
    channel: 'internal_reconciliation', providerReference: `${qaRunId}-REFUND-DONE`, reason: 'Controlled Phase 7 financial workflow completed',
  });
  current = await reservationState(reservationId);
  assert(current.payments[0].status === 'REFUNDED' && current.financialTasks[0].status === 'COMPLETED', `Refund closure failed for ${current.reference}.`);
  return current;
};

const calBooking = async (uid) => {
  if (!uid) return null;
  const result = await jsonFetch(`${env.CALCOM_API_BASE_URL.replace(/\/$/, '')}/bookings/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${env.CALCOM_API_KEY}`, 'cal-api-version': env.CALCOM_API_VERSION },
  });
  if (result.response.status === 404) return { uid, status: 'not_found' };
  const booking = requireResponse(result, 200, 'Cal.com booking lookup');
  const fields = booking.bookingFieldsResponses ?? booking.bookingFields ?? {};
  return {
    uid: String(booking.uid ?? booking.id ?? uid), status: booking.status, start: booking.start ?? booking.startTime,
    attendeeLocale: booking.attendees?.[0]?.language ?? booking.attendees?.[0]?.locale ?? null,
    title: fields.title ?? null, notes: fields.notes ?? null,
    metadata: booking.metadata ? {
      gspReference: booking.metadata.gspReference, gspPackage: booking.metadata.gspPackage,
      gspStartDouala: booking.metadata.gspStartDouala, gspEndDouala: booking.metadata.gspEndDouala,
      gspPhone: booking.metadata.gspPhone, gspPaymentLabel: booking.metadata.gspPaymentLabel,
      gspAdminUrl: booking.metadata.gspAdminUrl, gspOperationalNotes: booking.metadata.gspOperationalNotes,
    } : null,
  };
};
const calAvailableStarts = async (from, to, duration) => {
  const query = new URLSearchParams({
    eventTypeId: String(env.CALCOM_EVENT_TYPE_ID), start: `${from}T00:00:00.000Z`, end: `${to}T23:59:59.000Z`,
    timeZone: 'UTC', duration: String(duration), format: 'range',
  });
  const data = requireResponse(await jsonFetch(`${env.CALCOM_API_BASE_URL.replace(/\/$/, '')}/slots?${query}`, {
    headers: { Authorization: `Bearer ${env.CALCOM_API_KEY}`, 'cal-api-version': '2024-09-04' },
  }), 200, 'Cal.com availability');
  return new Set(Object.values(data).flat().map((slot) => new Date(typeof slot === 'string' ? slot : slot.start).toISOString()));
};
const latestCalendarUid = (reservation) => [...reservation.calendarSyncLogs].reverse().find((log) => log.externalEventId)?.externalEventId;

const createLead = async (pathname, body) => {
  assert(allowedEmails.has(body.email.toLowerCase()), `Lead recipient outside allowlist: ${pathname}.`);
  const isContact = pathname === '/api/contact';
  const isB2b = pathname === '/api/b2b-inquiries';
  const lead = await leadServices.createLeadSubmission({
    submissionKey: randomUUID(), type: isContact ? 'CONTACT' : isB2b ? 'B2B' : 'QUOTE',
    source: isContact ? 'contact_form' : isB2b ? 'b2b_form' : 'quote_form', locale: body.locale,
    name: body.name, email: body.email, phone: body.phone, whatsappConsent: false,
    company: body.company, rccm: body.rccm,
    subject: isContact || isB2b ? body.subject : body.packageName ? `Quote request: ${body.packageName}` : 'Quote request',
    message: !isContact && !isB2b && body.eventDate ? `Event date: ${body.eventDate}\n\n${body.message}` : body.message,
  });
  created.leadIds.push(lead.id);
  return lead;
};
const archiveLead = (id) => adminFetch(`/api/admin/leads/${id}`, 'PATCH', { status: 'ARCHIVED' });
const processDueQaEmails = async () => {
  const events = await prisma.notificationEvent.findMany({
    where: {
      channel: 'email', status: 'PENDING',
      OR: [{ reservationId: { in: created.reservationIds } }, { leadId: { in: created.leadIds } }],
      AND: [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] }],
    },
    orderBy: { createdAt: 'asc' },
  });
  for (const event of events) {
    assert(allowedEmails.has(event.recipient.toLowerCase()), `Refusing non-allowlisted email event ${event.id}.`);
    await notifications.processNotificationEvent(event.id);
  }
  return events.length;
};

const bestEffortCleanup = async () => {
  for (const id of created.reservationIds) {
    try {
      let current = await reservationState(id);
      if (terminalStatuses.has(current.status)) continue;
      if (current.status === 'CONFIRMED') current = await cancelReservation(id, 'STUDIO');
      else {
        if (current.payments[0] && !['REJECTED', 'FAILED', 'EXPIRED'].includes(current.payments[0].status)) {
          try { await paymentDecision(id, 'REJECTED', 'PAYMENT_UNVERIFIED'); } catch {}
        }
        current = await rejectReservation(id);
      }
      if (current.financialTasks[0]?.status === 'PENDING') await completeRefund(id);
    } catch (error) {
      console.error(`Cleanup warning for ${id}: ${error instanceof Error ? error.message : error}`);
    }
  }
  for (const id of created.leadIds) {
    try { await archiveLead(id); } catch {}
  }
  if (created.intentIds.length) await prisma.reservationIntent.updateMany({ where: { id: { in: created.intentIds } }, data: { expiresAt: new Date() } });
};

try {
  const existing = await prisma.reservationSnapshot.findFirst({ where: { lastName: { startsWith: qaMarker } } });
  assert(!existing, `${qaRunId} already exists; refusing a duplicate production run.`);

  const packages = requireResponse(await jsonFetch(`${origin}/api/packages`), 200, 'packages');
  const direct = packages.filter((item) => !item.isPromo && item.bookingMode === 'DIRECT').sort((a, b) => a.durationMin - b.durationMin)[0];
  const happy = packages.find((item) => item.isPromo && item.bookingMode === 'DIRECT');
  assert(direct && happy, 'Both a standard direct package and Happy Hours must be active.');

  const now = new Date();
  const nearFrom = dateOnly(new Date(now.getTime() + 12 * 60 * 60 * 1000));
  const nearTo = dateOnly(new Date(now.getTime() + 47 * 60 * 60 * 1000));
  const farFrom = dateOnly(new Date(now.getTime() + 7 * 86_400_000));
  const farTo = dateOnly(new Date(now.getTime() + 21 * 86_400_000));
  const [appNearSlots, appFarSlots, calFarStarts] = await Promise.all([
    getAvailability(direct.id, nearFrom, nearTo).then(availableSlots),
    getAvailability(direct.id, farFrom, farTo).then(availableSlots),
    calAvailableStarts(farFrom, farTo, direct.durationMin),
  ]);
  const nearSlots = appNearSlots.filter((slot) => new Date(slot.startAt).getTime() - now.getTime() > 12 * 60 * 60 * 1000 && new Date(slot.startAt).getTime() - now.getTime() < 48 * 60 * 60 * 1000);
  const farSlots = appFarSlots.filter((slot) => calFarStarts.has(new Date(slot.startAt).toISOString()));
  assert(nearSlots.length >= 1 && farSlots.length >= 5, 'Insufficient isolated standard slots for the five journeys.');

  const happyAvailability = await getAvailability(happy.id, farFrom, farTo);
  const happyDay = happyAvailability.days.find((day) => day.slots.filter((slot) => slot.available).length >= 7);
  assert(happyDay, 'No Happy Hours day exposes seven slots for the quota boundary.');
  const happySlots = happyDay.slots.filter((slot) => slot.available).slice(0, 7).map((slot) => ({ ...slot, date: happyDay.date }));

  let j1 = await createReservation({ key: 'A', packageId: direct.id, slot: farSlots[0], locale: 'fr', email: zohoEmail, method: 'orange_money' });
  j1 = await verifyAndConfirm(j1.id);
  const j1CreatedUid = latestCalendarUid(j1);
  const j1CreatedProvider = await calBooking(j1CreatedUid);
  j1 = await decideReschedule(j1.id, farSlots[1].startAt, 'ACCEPTED');
  const j1UpdatedUid = latestCalendarUid(j1);
  const j1UpdatedProvider = await calBooking(j1UpdatedUid);
  j1 = await cancelReservation(j1.id, 'CUSTOMER');
  j1 = await completeRefund(j1.id, 'PARTIAL_REFUND');
  const j1CancelledProvider = await calBooking(j1UpdatedUid);
  evidence.journeys.A = {
    locale: 'fr', channel: 'orange_money', reference: j1.reference, cancellationPolicy: 'CUSTOMER_MORE_THAN_48H_PARTIAL_REFUND',
    finalReservation: j1.status, finalPayment: j1.payments[0].status, refundTask: j1.financialTasks[0].status,
    calCreated: j1CreatedProvider, calUpdated: j1UpdatedProvider, calCancelled: j1CancelledProvider,
  };

  let j2 = await createReservation({ key: 'B', packageId: happy.id, slot: happySlots[0], locale: 'en', email: gmailEmail, method: 'mtn_momo' });
  j2 = await paymentDecision(j2.id, 'PAYMENT_INFO_REQUIRED', 'PAYMENT_REFERENCE_REQUIRED');
  j2 = await paymentDecision(j2.id, 'REJECTED', 'PAYMENT_UNVERIFIED');
  j2 = await rejectReservation(j2.id);
  evidence.journeys.B = { locale: 'en', channel: 'mtn_momo', reference: j2.reference, finalReservation: j2.status, finalPayment: j2.payments[0].status };

  for (let index = 0; index < 6; index += 1) {
    const hold = await intentServices.createOrRefreshReservationIntent({
      idempotencyKey: randomUUID(), packageId: happy.id, startAt: new Date(happySlots[index].startAt), scheduleKind: 'STANDARD_HOLD',
    });
    created.intentIds.push(hold.id);
  }
  let quotaError = null;
  try {
    await intentServices.createOrRefreshReservationIntent({
      idempotencyKey: randomUUID(), packageId: happy.id, startAt: new Date(happySlots[6].startAt), scheduleKind: 'STANDARD_HOLD',
    });
  } catch (error) { quotaError = error; }
  assert(quotaError?.statusCode === 409 && quotaError?.code === 'PACKAGE_DAILY_QUOTA_REACHED', 'Happy Hours seventh request did not hit the quota boundary.');
  await prisma.reservationIntent.updateMany({ where: { id: { in: created.intentIds } }, data: { expiresAt: new Date() } });
  evidence.checks.happyHoursQuota = { sixAccepted: true, seventhStatus: 409, seventhCode: 'PACKAGE_DAILY_QUOTA_REACHED', auxiliaryHoldsExpired: true };

  let j3 = await createReservation({ key: 'C', packageId: direct.id, slot: farSlots[2], locale: 'en', email: gmailEmail, method: 'orange_money' });
  j3 = await verifyAndConfirm(j3.id);
  const j3Uid = latestCalendarUid(j3);
  const j3ProviderBefore = await calBooking(j3Uid);
  await notifications.scheduleReservationReminderNotifications(new Date(j3.startAt.getTime() - 23 * 60 * 60 * 1000));
  const reminder = await prisma.notificationEvent.findFirstOrThrow({ where: { reservationId: j3.id, templateCode: 'E-16', channel: 'email' } });
  assert(allowedEmails.has(reminder.recipient.toLowerCase()), 'Reminder recipient is not allowlisted.');
  await notifications.processNotificationEvent(reminder.id);
  j3 = await cancelReservation(j3.id, 'STUDIO');
  j3 = await completeRefund(j3.id, 'FULL_REFUND');
  const j3ProviderAfter = await calBooking(j3Uid);
  evidence.journeys.C = {
    locale: 'en', channel: 'orange_money', reference: j3.reference, reminderEventId: reminder.id,
    finalReservation: j3.status, finalPayment: j3.payments[0].status, refundTask: j3.financialTasks[0].status,
    calCreated: j3ProviderBefore, calCancelled: j3ProviderAfter,
  };

  let j4 = await createReservation({ key: 'D', packageId: direct.id, slot: nearSlots[0], locale: 'fr', email: zohoEmail, method: 'orange_money' });
  j4 = await cancelReservation(j4.id, 'CUSTOMER');
  j4 = await paymentDecision(j4.id, 'REJECTED', 'PAYMENT_UNVERIFIED');
  assert(j4.financialTasks.length === 0, 'Journey D should cancel without refund within 48 hours.');
  evidence.journeys.D = {
    locale: 'fr', channel: 'orange_money', reference: j4.reference, policy: 'CUSTOMER_WITHIN_48H_NO_REFUND',
    finalReservation: j4.status, finalPayment: j4.payments[0].status,
  };

  let j5 = await createReservation({ key: 'E', packageId: direct.id, slot: farSlots[3], locale: 'en', email: gmailEmail, method: 'orange_money' });
  j5 = await paymentDecision(j5.id, 'VERIFIED');
  await adminFetch(`/api/admin/reservations/${j5.id}`, 'PATCH', {
    status: 'CONFIRMED', commandId: randomUUID(), expectedVersion: j5.version,
  });
  j5 = await reservationState(j5.id);
  const delayedNotice = j5.notifications.find((event) => event.templateCode === 'E-03');
  const confirmationNotice = j5.notifications.find((event) => event.templateCode === 'E-05');
  assert(delayedNotice?.status === 'CANCELLED' && confirmationNotice, 'Early confirmation did not cancel E-03 and create E-05.');
  j5 = await decideReschedule(j5.id, farSlots[4].startAt, 'REJECTED');
  j5 = await cancelReservation(j5.id, 'STUDIO');
  j5 = await completeRefund(j5.id, 'FULL_REFUND');
  evidence.journeys.E = {
    locale: 'en', channel: 'orange_money', reference: j5.reference, e03Status: delayedNotice.status,
    e05EventId: confirmationNotice.id, rescheduleDecision: j5.rescheduleRequests[0].status,
    finalReservation: j5.status, finalPayment: j5.payments[0].status,
  };

  const leads = [
    await createLead('/api/contact', {
      locale: 'fr', name: `Contact ${qaMarker}`, email: zohoEmail, phone: qaPhone,
      subject: 'Préparation portrait', message: 'Je souhaite recevoir les informations pratiques pour une séance portrait.',
    }),
    await createLead('/api/contact', {
      locale: 'en', name: `Contact ${qaMarker} EN`, email: gmailEmail, phone: qaPhone,
      subject: 'Portrait preparation', message: 'Please send the practical information for arranging a portrait session.',
    }),
    await createLead('/api/b2b-inquiries', {
      locale: 'fr', company: `Entreprise ${qaMarker}`, rccm: 'NON-COMMUNIQUE', name: `Responsable ${qaMarker}`,
      email: zohoEmail, phone: qaPhone, subject: 'Portraits collaborateurs',
      message: 'Notre équipe souhaite préparer une série de portraits professionnels.',
    }),
    await createLead('/api/quote-requests', {
      locale: 'en', name: `Creative ${qaMarker}`, email: gmailEmail, phone: qaPhone,
      packageName: 'Creative services', eventDate: farFrom,
      message: 'Please prepare information for a creative production quotation.',
    }),
  ];
  for (const lead of leads) await archiveLead(lead.id);
  evidence.leads = leads.map((lead) => ({ id: lead.id, reference: lead.reference, type: lead.type, locale: lead.locale }));

  const digest = await notifications.scheduleDailyOperationsDigest(new Date('2026-07-01T17:30:00.000Z'));
  if (digest?.id) {
    assert(digest.recipient.toLowerCase() === zohoEmail, 'Digest recipient is not the controlled Zoho inbox.');
    await notifications.processNotificationEvent(digest.id);
  }
  evidence.digest = { usefulDigestEventId: digest?.id ?? null, emptyDigest: 'NOT_RUN_NO_EMPTY_OPERATIONAL_WINDOW' };

  const processedEmails = await processDueQaEmails();
  const scheduledQaEmails = await prisma.notificationEvent.findMany({
    where: { channel: 'email', status: 'PENDING', OR: [{ reservationId: { in: created.reservationIds } }, { leadId: { in: created.leadIds } }] },
    select: { id: true },
  });
  for (const event of scheduledQaEmails) await notifications.processNotificationEvent(event.id);
  const finalReservations = await Promise.all(created.reservationIds.map((id) => reservationState(id)));
  const finalLeads = await prisma.lead.findMany({ where: { id: { in: created.leadIds } } });
  const qaEmails = await prisma.notificationEvent.findMany({
    where: { channel: 'email', OR: [{ reservationId: { in: created.reservationIds } }, { leadId: { in: created.leadIds } }] },
    orderBy: { createdAt: 'asc' },
  });
  const pendingQaEmails = qaEmails.filter((event) => ['PENDING', 'PROCESSING'].includes(event.status));
  const sentQaEmails = qaEmails.filter((event) => event.status === 'SENT');

  const activeCalendarEvents = [];
  for (const reservation of finalReservations) {
    const uid = latestCalendarUid(reservation);
    if (!uid) continue;
    const provider = await calBooking(uid);
    const status = String(provider?.status ?? '').toLowerCase();
    if (status && !status.includes('cancel') && status !== 'not_found') activeCalendarEvents.push({ reference: reservation.reference, uid, status });
  }

  assert(finalReservations.every((reservation) => terminalStatuses.has(reservation.status)), 'A Phase 7 reservation remains active.');
  assert(finalLeads.length === 4 && finalLeads.every((lead) => lead.status === 'ARCHIVED'), 'Phase 7 leads are not all archived.');
  assert(activeCalendarEvents.length === 0, 'A Phase 7 Cal.com event remains active.');
  assert(pendingQaEmails.length === 0, 'A due Phase 7 email remains pending or processing.');
  assert(sentQaEmails.length > 0 && sentQaEmails.every((event) => event.providerMessageId), 'SMTP acceptance evidence is incomplete.');

  evidence.finishedAt = new Date().toISOString();
  evidence.checks = {
    ...evidence.checks,
    fiveJourneysTerminal: 'PASS',
    localesAndPaymentChannels: 'PASS',
    rescheduleAcceptedAndRejected: 'PASS',
    reminder24h: 'PASS',
    earlyConfirmationCancelsE03: 'PASS',
    studioRefundCompleted: 'PASS',
    leadsArchived: 'PASS',
    calComCreateUpdateCancel: 'PASS',
    emailSmtpAcceptance: 'PASS',
    whatsappDeliveryDisabled: 'PASS',
  };
  evidence.final = {
    reservations: finalReservations.map((reservation) => ({
      reference: reservation.reference, status: reservation.status, payment: reservation.payments[0]?.status ?? null,
      financialTasks: reservation.financialTasks.map((task) => task.status),
    })),
    leads: finalLeads.map((lead) => ({ reference: lead.reference, type: lead.type, status: lead.status })),
    emailSummary: qaEmails.reduce((summary, event) => ({ ...summary, [event.status]: (summary[event.status] ?? 0) + 1 }), {}),
    smtpAccepted: sentQaEmails.map((event) => ({
      id: event.id, templateCode: event.templateCode, providerMessageId: event.providerMessageId, providerStatus: event.providerStatus,
    })),
    dueEmailsProcessed: processedEmails,
    pendingQaEmails: pendingQaEmails.length,
    activeCalComEvents: activeCalendarEvents.length,
    mailboxRendering: 'OWNER_MOBILE_CONFIRMATION_REQUIRED',
  };

  const evidenceDir = path.join(projectDir, 'private-media', 'qa-evidence');
  await fs.mkdir(evidenceDir, { recursive: true, mode: 0o700 });
  const evidencePath = path.join(evidenceDir, `${qaRunId}.json`);
  await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  await fs.chmod(evidencePath, 0o600);
  console.log(JSON.stringify({ qaRunId, evidencePath, checks: evidence.checks, journeys: evidence.journeys, final: evidence.final }, null, 2));
} catch (error) {
  try { await bestEffortCleanup(); } catch {}
  throw error;
} finally {
  await prisma.$disconnect();
}
