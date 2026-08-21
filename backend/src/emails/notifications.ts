import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';

import { hasOwnerExplicitDeliveryLabel } from '../catalogue/delivery-labels.js';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';
import { recordMissingReservationSnapshot } from '../services/integrity-incidents.js';
import { resolveCustomerDecisionCopy, type CustomerReasonCode } from '../services/customer-decision-copy.js';
import { resolveReservationNotificationEmail } from '../services/reservation-notification-overrides.js';
import { Prisma } from '../generated/prisma/client.js';
import { LeadType, NotificationStatus, PaymentStatus, ReservationStatus } from '../generated/prisma/enums.js';
import { normalizeE164Phone } from '../utils/phone.js';
import { adminFinanceUrl, adminLeadUrl, adminReservationUrl } from '../utils/admin-links.js';
import { financialTaskStatusLabel, formatRelativeBusinessDuration, paymentMethodLabel, paymentStatusLabel, reservationStatusLabel } from '../utils/business-display.js';
import {
  enqueueInternalEmailNotification,
  type InternalNotificationDestination,
  type NotificationActor,
} from './internal-notification-policy.js';
import {
  EMAIL_TEMPLATE_VERSION,
  renderEmailTemplate,
  type EmailTemplateCode,
  type EmailTemplateVariables,
  type RenderedEmailTemplate,
} from './templates.js';

type EmailMessage = { subject: string; text: string; html: string };
type DeliveryResult = { providerMessageId: string | null; providerStatus: string };
type NotificationEvent = NonNullable<Awaited<ReturnType<typeof getNotificationEvent>>>;
type ReservationForMessage = NonNullable<NotificationEvent['reservation']>;
type ReservationContactSource = {
  snapshot: {
    firstName: string;
    locale: string;
    lastName: string;
    notificationPhoneE164: string;
    notificationEmail: string | null;
    email: string | null;
    whatsappConsent: boolean;
    packageName: string;
    startAt: Date;
    endAt: Date;
    amount: number;
    currency: string;
  } | null;
};

type WhatsAppAudience = 'business' | 'customer';
type WhatsAppRenderedContent = {
  audience: WhatsAppAudience;
  firstName: string;
  lastName: string;
  reference: string;
  phone: string;
  email: string | null;
  packageName: string;
  startAt: string;
  formattedStartAt: string;
  amount: number;
  whatsappConsent: boolean;
  parameters: string[];
};

const WHATSAPP_TEMPLATE_VERSION = '2026-08-01';
const WHATSAPP_MAX_ATTEMPTS = 3;
const WHATSAPP_RETRY_DELAYS_MS = [2 * 60_000, 10 * 60_000] as const;

export type NotificationDeliveryAdapters = {
  now?: () => Date;
  sendEmail?: (event: NotificationEvent, message: EmailMessage) => Promise<DeliveryResult>;
  sendWhatsApp?: (event: NotificationEvent) => Promise<DeliveryResult>;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const paragraphs = (lines: string[]) => lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat('fr-CM', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Douala',
  }).format(date);
const formatPrice = (amount: number) => `${amount.toLocaleString('fr-CM')} FCFA`;

const getNotificationEvent = (id: string) =>
  prisma.notificationEvent.findUnique({
    where: { id },
    include: {
      reservation: { include: { customer: true, package: true, payments: true, snapshot: true } },
      lead: true,
    },
  });

const reservationContact = (reservation: ReservationContactSource) => {
  if (!reservation.snapshot) throw new Error('RESERVATION_SNAPSHOT_MISSING');
  return {
    firstName: reservation.snapshot.firstName,
    locale: (reservation.snapshot.locale === 'en' ? 'en' : 'fr') as 'en' | 'fr',
    lastName: reservation.snapshot.lastName,
    phone: reservation.snapshot.notificationPhoneE164,
    email: reservation.snapshot.notificationEmail ?? reservation.snapshot.email,
    whatsappConsent: reservation.snapshot.whatsappConsent,
    packageName: reservation.snapshot.packageName,
    startAt: reservation.snapshot.startAt,
    endAt: reservation.snapshot.endAt,
    amount: reservation.snapshot.amount,
    currency: reservation.snapshot.currency,
  };
};

type ReservationEmailSource = ReservationContactSource & {
  id: string;
  reference: string;
  status: ReservationStatus;
  statusReason: string | null;
  payments: Array<{
    amount: number;
    method: string;
    transactionRef: string | null;
    status: PaymentStatus;
    statusReason: string | null;
    updatedAt: Date;
  }>;
};

const emailLocaleTag = (locale: string) => locale === 'en' ? 'en-GB' : 'fr-CM';
const formatDate = (date: Date, locale: string = 'fr') => new Intl.DateTimeFormat(emailLocaleTag(locale), {
  dateStyle: 'long',
  timeZone: 'Africa/Douala',
}).format(date);
const formatTime = (date: Date, locale: string = 'fr') => {
  const value = new Intl.DateTimeFormat(emailLocaleTag(locale), {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Douala',
  }).format(date);
  return locale === 'fr' ? value.replace(':', ' h ') : value;
};
const formatAmount = (amount: number, locale: string = 'fr') => amount.toLocaleString(emailLocaleTag(locale));
const maskReference = (reference: string | null | undefined) => {
  if (!reference) return 'Not provided';
  return `•••• ${reference.slice(-4)}`;
};

const reservationEmailVariables = (
  reservation: ReservationEmailSource,
  overrides: EmailTemplateVariables = {},
): EmailTemplateVariables => {
  const contact = reservationContact(reservation);
  const payment = reservation.payments[0];
  return {
    prenom_client: contact.firstName,
    nom_client: `${contact.firstName} ${contact.lastName}`,
    reference_courte: reservation.reference,
    nom_prestation: contact.packageName,
    date_seance: formatDate(contact.startAt, contact.locale),
    heure_debut: formatTime(contact.startAt, contact.locale),
    heure_fin: formatTime(contact.endAt, contact.locale),
    montant_fcfa: formatAmount(contact.amount, contact.locale),
    telephone_e164: contact.phone,
    email_client: contact.email ?? (contact.locale === 'en' ? 'Not provided' : 'Non renseigné'),
    statut_paiement: paymentStatusLabel(payment?.status, contact.locale),
    statut_paiement_libelle: paymentStatusLabel(payment?.status, contact.locale),
    operateur_paiement: paymentMethodLabel(payment?.method, contact.locale),
    reference_paiement_masquee: maskReference(payment?.transactionRef),
    lien_admin_reservation: adminReservationUrl(reservation.reference),
    adresse_ou_instruction_acces: 'Golden Studio Plus, Douala',
    ...overrides,
  };
};

const renderReservationEmail = (
  reservation: ReservationEmailSource,
  code: EmailTemplateCode,
  overrides: EmailTemplateVariables = {},
) => renderEmailTemplate(code, reservationEmailVariables(reservation, overrides), reservationContact(reservation).locale === 'en' ? 'en' : 'fr');

export type CustomerDecisionPreviewInput = {
  scope: 'RESERVATION_REJECTION' | 'STUDIO_CANCELLATION' | 'RESERVATION_EXPIRATION' | 'PAYMENT_REJECTION' | 'PAYMENT_INFORMATION_REQUEST' | 'PAYMENT_VERIFICATION_BLOCKAGE' | 'RESCHEDULE_REJECTION';
  entityId: string;
  internalReason: string;
  customerReasonCode: CustomerReasonCode;
  customerReasonText?: string | null;
};

export const previewCustomerDecisionEmail = async (input: CustomerDecisionPreviewInput) => {
  let reservation: ReservationEmailSource | null = null;
  let code: EmailTemplateCode;
  let variables: EmailTemplateVariables = {};
  let locale: string | undefined;
  if (input.scope.startsWith('PAYMENT_')) {
    const payment = await prisma.payment.findUnique({ where: { id: input.entityId }, include: { reservation: { include: { customer: true, snapshot: true, payments: { orderBy: { createdAt: 'desc' } } } } } });
    if (!payment?.reservation.snapshot) throw new HttpError(404, 'PREVIEW_ENTITY_NOT_FOUND', 'Paiement ou snapshot introuvable.');
    reservation = payment.reservation;
    locale = payment.reservation.snapshot.locale;
    code = input.scope === 'PAYMENT_REJECTION' ? 'E-04' : input.scope === 'PAYMENT_INFORMATION_REQUEST' ? 'E-04A' : 'E-04B';
    const copy = resolveCustomerDecisionCopy(input.scope, locale, input);
    variables = { motif_rejet_paiement: copy.customerReasonText, information_paiement_requise: copy.customerReasonText, instruction_regularisation: copy.customerLocale === 'en' ? 'provide a new reference or contact the Studio' : 'transmettre une nouvelle référence ou contacter le Studio', date_limite_regularisation: formatDateTime(payment.reservation.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000)) };
  } else if (input.scope === 'RESCHEDULE_REJECTION') {
    const request = await prisma.reservationRescheduleRequest.findUnique({ where: { id: input.entityId }, include: { reservation: { include: { customer: true, snapshot: true, payments: { orderBy: { createdAt: 'desc' } } } } } });
    if (!request?.reservation.snapshot) throw new HttpError(404, 'PREVIEW_ENTITY_NOT_FOUND', 'Demande de report ou snapshot introuvable.');
    reservation = request.reservation;
    locale = request.reservation.snapshot.locale;
    const copy = resolveCustomerDecisionCopy(input.scope, locale, input);
    code = 'E-10';
    variables = { motif_refus_report: copy.customerReasonText, ancien_creneau: rescheduleSlot(request.oldStartAt, request.oldEndAt) };
  } else {
    const found = await prisma.reservation.findUnique({ where: { id: input.entityId }, include: { customer: true, snapshot: true, packageVersion: true, payments: { orderBy: { createdAt: 'desc' } }, financialTasks: { where: { type: 'FULL_REFUND' }, orderBy: { createdAt: 'desc' }, take: 1 } } });
    if (!found?.snapshot) throw new HttpError(404, 'PREVIEW_ENTITY_NOT_FOUND', 'Réservation ou snapshot introuvable.');
    reservation = found;
    locale = found.snapshot.locale;
    const copy = resolveCustomerDecisionCopy(input.scope, locale, input);
    if (input.scope === 'STUDIO_CANCELLATION') {
      code = 'E-13';
      variables = { motif_annulation_studio: copy.customerReasonText };
    } else if (input.scope === 'RESERVATION_EXPIRATION') {
      code = 'E-14';
      variables = { motif_expiration: copy.customerReasonText };
    } else {
      const paid = found.payments.some((payment) => payment.status === PaymentStatus.VERIFIED || payment.status === PaymentStatus.PAID);
      code = paid ? 'E-07' : 'E-06';
      variables = { motif_refus_reservation: copy.customerReasonText };
    }
  }
  const rendered = renderReservationEmail(reservation, code!, variables);
  return { ...rendered, locale: locale === 'en' ? 'en' : 'fr', templateVersion: EMAIL_TEMPLATE_VERSION, previewHash: createHash('sha256').update(JSON.stringify(rendered)).digest('hex') };
};

const reservationLines = (reservation: ReservationForMessage) => {
  const contact = reservationContact(reservation);
  return [
    `Référence : ${reservation.reference}`,
    `Client : ${contact.firstName} ${contact.lastName}`,
    `Téléphone : ${contact.phone}`,
    `E-mail : ${contact.email ?? 'Non renseigné'}`,
    `Pack : ${contact.packageName}`,
    `Date : ${formatDateTime(contact.startAt)}`,
    `Montant : ${formatPrice(contact.amount)}`,
    `Statut : ${reservation.status}`,
  ];
};

const buildEmailMessage = (event: NotificationEvent): EmailMessage | null => {
  if (
    event.channel === 'email' &&
    event.renderedContent &&
    typeof event.renderedContent === 'object' &&
    !Array.isArray(event.renderedContent)
  ) {
    const stored = event.renderedContent as Record<string, unknown>;
    if (typeof stored.subject === 'string' && typeof stored.text === 'string' && typeof stored.html === 'string') {
      return { subject: stored.subject, text: stored.text, html: stored.html };
    }
  }

  let lines: string[];
  let subject: string;

  if (event.type === 'booking_received_customer' && event.reservation) {
    lines = [
      `Bonjour ${reservationContact(event.reservation).firstName},`,
      'Votre demande de réservation a bien été reçue.',
      'Golden Studio Plus vérifiera le paiement et la disponibilité avant confirmation.',
      ...reservationLines(event.reservation),
    ];
    subject = `Réservation reçue - ${event.reservation.reference}`;
  } else if (event.type === 'booking_received_admin' && event.reservation) {
    lines = ['Nouvelle réservation reçue.', ...reservationLines(event.reservation)];
    subject = `Nouvelle réservation - ${event.reservation.reference}`;
  } else if (event.type === 'booking_rescheduled_customer' && event.reservation) {
    lines = [
      `Bonjour ${reservationContact(event.reservation).firstName},`,
      'Le créneau de votre réservation a été modifié.',
      ...reservationLines(event.reservation),
    ];
    subject = `Nouveau créneau de réservation - ${event.reservation.reference}`;
  } else if (event.type === 'booking_confirmed_customer' && event.reservation) {
    lines = [
      `Bonjour ${reservationContact(event.reservation).firstName},`,
      'Votre réservation est confirmée.',
      ...reservationLines(event.reservation),
    ];
    subject = `Réservation confirmée - ${event.reservation.reference}`;
  } else if (event.type === 'booking_rejected_customer' && event.reservation) {
    lines = [
      `Bonjour ${reservationContact(event.reservation).firstName},`,
      'Votre réservation ne peut pas être confirmée pour ce créneau.',
      'Vous pouvez contacter le studio pour choisir un autre horaire.',
      ...reservationLines(event.reservation),
    ];
    subject = `Réservation non confirmée - ${event.reservation.reference}`;
  } else if (event.type === 'calendar_sync_failed_admin' && event.reservation) {
    const metadata =
      event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
        ? event.metadata as Record<string, unknown>
        : {};
    const safeError = typeof metadata.error === 'string'
      ? metadata.error
      : 'CALENDAR_PROVIDER_FAILED';
    lines = [
      'Incident I-07 : la synchronisation calendrier a échoué après trois tentatives.',
      `Erreur assainie : ${safeError}`,
      'Une vérification manuelle du calendrier externe est requise.',
      ...reservationLines(event.reservation),
    ];
    subject = `I-07 Synchronisation calendrier en échec - ${event.reservation.reference}`;
  } else if (event.type === 'whatsapp_delivery_failed_admin' && event.reservation) {
    const metadata =
      event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
        ? event.metadata as Record<string, unknown>
        : {};
    const safeError = typeof metadata.error === 'string'
      ? metadata.error
      : 'WHATSAPP_DELIVERY_FAILED';
    lines = [
      'Incident I-08 : une notification WhatsApp a échoué après trois tentatives.',
      `Erreur assainie : ${safeError}`,
      'Une vérification manuelle du message et du destinataire est requise.',
      ...reservationLines(event.reservation),
    ];
    subject = `I-08 Notification WhatsApp en échec - ${event.reservation.reference}`;
  } else if (event.type === 'lead_created_admin' && event.lead) {
    lines = [
      'Nouveau contact reçu.',
      `Type : ${event.lead.type}`,
      `Nom : ${event.lead.name}`,
      `Entreprise : ${event.lead.company ?? 'Non renseignée'}`,
      `Téléphone : ${event.lead.phone ?? 'Non renseigné'}`,
      `E-mail : ${event.lead.email ?? 'Non renseigné'}`,
      `Sujet : ${event.lead.subject ?? event.lead.source ?? 'Non renseigné'}`,
      '',
      event.lead.message,
    ];
    subject = `Nouveau contact - ${event.lead.name}`;
  } else if (event.type === 'payment_verified_customer' && event.reservation) {
    const payment = event.reservation.payments.find((item) => item.status === PaymentStatus.VERIFIED);
    lines = [
      `Bonjour ${reservationContact(event.reservation).firstName},`,
      'Votre paiement a été vérifié.',
      payment?.transactionRef ? `Référence paiement : ${payment.transactionRef}` : 'Référence paiement : non renseignée',
      ...reservationLines(event.reservation),
    ];
    subject = `Paiement vérifié - ${event.reservation.reference}`;
  } else {
    return null;
  }

  return { subject, text: lines.join('\n'), html: paragraphs(lines) };
};

const smtpConfigured = () => Boolean(env.SMTP_HOST && env.SMTP_FROM);
const whatsappConfigured = () =>
  Boolean(
    env.WHATSAPP_PHONE_NUMBER_ID &&
      env.WHATSAPP_ACCESS_TOKEN &&
      env.WHATSAPP_WEBHOOK_VERIFY_TOKEN &&
      env.WHATSAPP_APP_SECRET,
  );

const sendEmail = async (event: NotificationEvent, message: EmailMessage): Promise<DeliveryResult> => {
  if (!env.EMAIL_DELIVERY_ENABLED || !smtpConfigured()) throw new Error('EMAIL_CHANNEL_NOT_CONFIGURED');
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  const delivery = await transport.sendMail({
    from: env.SMTP_FROM,
    to: event.recipient,
    subject: message.subject,
    text: message.text,
    html: message.html,
    messageId: `<${event.idempotencyKey ?? event.id}@notifications.gsplus.vip>`,
  });
  const providerMessageId =
    typeof delivery === 'object' && delivery !== null && 'messageId' in delivery
      ? String((delivery as { messageId?: unknown }).messageId ?? '') || null
      : null;
  return { providerMessageId, providerStatus: 'accepted' };
};

const whatsappTemplate = (type: string) => {
  if (type === 'booking_received_customer') return env.WHATSAPP_TEMPLATE_BOOKING_RECEIVED;
  if (type === 'booking_received_admin') return env.WHATSAPP_TEMPLATE_BOOKING_RECEIVED_ADMIN;
  if (type === 'booking_confirmed_customer') return env.WHATSAPP_TEMPLATE_BOOKING_CONFIRMED;
  if (type === 'booking_rescheduled_customer') return env.WHATSAPP_TEMPLATE_BOOKING_RESCHEDULED;
  if (type === 'booking_rejected_customer') return env.WHATSAPP_TEMPLATE_BOOKING_REJECTED;
  if (type === 'payment_verified_customer') return env.WHATSAPP_TEMPLATE_PAYMENT_VERIFIED;
  return '';
};

const whatsappRenderedContent = (event: NotificationEvent) => {
  const value = event.renderedContent;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as unknown as WhatsAppRenderedContent;
};

const sendWhatsApp = async (event: NotificationEvent): Promise<DeliveryResult> => {
  if (!env.WHATSAPP_DELIVERY_ENABLED || !whatsappConfigured()) throw new Error('WHATSAPP_CHANNEL_NOT_CONFIGURED');
  if (!event.reservation) throw new Error('WHATSAPP_RESERVATION_MISSING');
  const rendered = whatsappRenderedContent(event);
  const audience = rendered?.audience ?? (event.type.endsWith('_admin') ? 'business' : 'customer');
  if (audience === 'customer' && !reservationContact(event.reservation).whatsappConsent) {
    throw new Error('WHATSAPP_CONSENT_MISSING');
  }
  const templateName = whatsappTemplate(event.type);
  if (!templateName) throw new Error('WHATSAPP_TEMPLATE_NOT_CONFIGURED');

  const response = await fetch(
    `${env.WHATSAPP_GRAPH_API_BASE_URL}/${env.WHATSAPP_GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(env.WHATSAPP_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizeE164Phone(event.recipient).slice(1),
        type: 'template',
        template: {
          name: templateName,
          language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE },
          components: [
            {
              type: 'body',
              parameters: (rendered?.parameters ?? [
                reservationContact(event.reservation).firstName,
                event.reservation.reference,
                formatDateTime(event.reservation.startAt),
              ]).map((text) => ({ type: 'text', text })),
            },
          ],
        },
      }),
    },
  );
  if (!response.ok) throw new Error(`WHATSAPP_PROVIDER_HTTP_${response.status}`);
  const payload = (await response.json()) as { messages?: Array<{ id?: string }> };
  const providerMessageId = payload.messages?.[0]?.id;
  if (!providerMessageId) throw new Error('WHATSAPP_PROVIDER_MESSAGE_ID_MISSING');
  return { providerMessageId, providerStatus: 'accepted' };
};

const safeFailureCode = (event: NotificationEvent, error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  if (/^[A-Z0-9_]+$/.test(message)) return message.slice(0, 100);
  if (/^WHATSAPP_PROVIDER_HTTP_\d{3}$/.test(message)) return message;
  return event.channel === 'whatsapp' ? 'WHATSAPP_DELIVERY_FAILED' : 'EMAIL_DELIVERY_FAILED';
};

const retryDelayMs = (event: Pick<NotificationEvent, 'channel' | 'attemptCount'>) => {
  if (event.channel === 'whatsapp') {
    return WHATSAPP_RETRY_DELAYS_MS[Math.min(event.attemptCount - 1, WHATSAPP_RETRY_DELAYS_MS.length - 1)];
  }
  return Math.min(3_600_000, 60_000 * 2 ** Math.max(0, event.attemptCount - 1));
};

const obsoleteEmailReason = (event: NotificationEvent) => {
  if (event.channel !== 'email' || !event.reservation) return null;
  const metadata = event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
    ? event.metadata as Record<string, unknown>
    : {};
  if (['booking_change_deadline_reminder_customer', 'booking_24h_reminder_customer'].includes(event.type)) {
    const expectedVersion = typeof metadata.expectedReservationVersion === 'number'
      ? metadata.expectedReservationVersion
      : null;
    const scheduledStartAt = typeof metadata.scheduledStartAt === 'string' ? metadata.scheduledStartAt : null;
    if (
      event.reservation.status !== ReservationStatus.CONFIRMED ||
      event.reservation.version !== expectedVersion ||
      event.reservation.startAt.toISOString() !== scheduledStartAt
    ) return 'RESERVATION_REMINDER_OBSOLETE';
    return null;
  }
  if (![
    'payment_rejected_customer',
    'payment_info_required_customer',
    'payment_verification_blocked_customer',
    'reservation_decision_overdue_admin',
  ].includes(event.type)) return null;
  const paymentId = typeof metadata.paymentId === 'string' ? metadata.paymentId : null;
  const expected = typeof metadata.expectedPaymentStatus === 'string' ? metadata.expectedPaymentStatus : null;
  const expectedVersion = typeof metadata.expectedPaymentVersion === 'number'
    ? metadata.expectedPaymentVersion
    : null;
  if (!paymentId || !expected) return 'NOTIFICATION_STATE_PROOF_MISSING';
  const payment = event.reservation.payments.find((item) => item.id === paymentId);
  if (!payment || payment.status !== expected) return 'PAYMENT_STATE_CHANGED';
  if (expectedVersion !== null && payment.version !== expectedVersion) return 'PAYMENT_CYCLE_CHANGED';
  if (
    event.type === 'reservation_decision_overdue_admin' &&
    event.reservation.status !== ReservationStatus.PENDING_CONFIRMATION
  ) return 'RESERVATION_DECIDED';
  return null;
};

export const processNotificationEvent = async (id: string, adapters: NotificationDeliveryAdapters = {}) => {
  const now = adapters.now?.() ?? new Date();
  const candidate = await getNotificationEvent(id);
  const obsoleteReason = candidate ? obsoleteEmailReason(candidate) : null;
  if (candidate?.status === NotificationStatus.PENDING && obsoleteReason) {
    await prisma.notificationEvent.updateMany({
      where: { id, status: NotificationStatus.PENDING },
      data: {
        status: NotificationStatus.CANCELLED,
        nextAttemptAt: null,
        providerStatus: 'cancelled_obsolete_state',
        resolution: 'OBSOLETE',
        resolutionNote: obsoleteReason,
        resolvedAt: now,
        resolvedBy: 'SYSTEM',
      },
    });
    return 'skipped' as const;
  }
  const claim = await prisma.notificationEvent.updateMany({
    where: {
      id,
      status: NotificationStatus.PENDING,
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    data: {
      status: NotificationStatus.PROCESSING,
      attemptCount: { increment: 1 },
      lastAttemptAt: now,
      nextAttemptAt: null,
      lockedAt: now,
      error: null,
    },
  });
  if (claim.count === 0) return 'skipped' as const;

  const event = await getNotificationEvent(id);
  if (!event) return 'skipped' as const;

  await prisma.notificationAttempt.upsert({
    where: {
      notificationEventId_attemptNumber: {
        notificationEventId: event.id,
        attemptNumber: event.attemptCount,
      },
    },
    update: {},
    create: {
      notificationEventId: event.id,
      attemptNumber: event.attemptCount,
      channel: event.channel,
      status: 'PROCESSING',
      startedAt: now,
    },
  });

  try {
    if (event.reservation && !event.reservation.snapshot) {
      await recordMissingReservationSnapshot(event.reservation.id, 'notification_delivery');
      throw new Error('RESERVATION_SNAPSHOT_MISSING');
    }
    let delivery: DeliveryResult;
    if (event.channel === 'email') {
      const message = buildEmailMessage(event);
      if (!message) throw new Error('UNSUPPORTED_NOTIFICATION_TYPE');
      delivery = await (adapters.sendEmail ?? sendEmail)(event, message);
    } else if (event.channel === 'whatsapp') {
      delivery = await (adapters.sendWhatsApp ?? sendWhatsApp)(event);
    } else {
      throw new Error('UNSUPPORTED_NOTIFICATION_CHANNEL');
    }

    await prisma.notificationEvent.update({
      where: { id },
      data: {
        status: NotificationStatus.SENT,
        providerMessageId: delivery.providerMessageId,
        providerStatus: delivery.providerStatus,
        sentAt: now,
        deliveredAt: null,
        lockedAt: null,
        error: null,
      },
    });
    await prisma.notificationAttempt.update({
      where: {
        notificationEventId_attemptNumber: {
          notificationEventId: event.id,
          attemptNumber: event.attemptCount,
        },
      },
      data: {
        status: 'SENT',
        providerMessageId: delivery.providerMessageId,
        providerStatus: delivery.providerStatus,
        completedAt: now,
        error: null,
      },
    });
    return 'sent' as const;
  } catch (error) {
    const terminal = event.attemptCount >= event.maxAttempts;
    const failureCode = safeFailureCode(event, error);
    await prisma.notificationEvent.update({
      where: { id },
      data: {
        status: terminal ? NotificationStatus.FAILED : NotificationStatus.PENDING,
        error: failureCode,
        providerStatus: terminal ? 'failed' : 'retry_scheduled',
        nextAttemptAt: terminal ? null : new Date(now.getTime() + retryDelayMs(event)),
        lockedAt: null,
      },
    });
    await prisma.notificationAttempt.update({
      where: {
        notificationEventId_attemptNumber: {
          notificationEventId: event.id,
          attemptNumber: event.attemptCount,
        },
      },
      data: {
        status: terminal ? 'FAILED' : 'RETRYING',
        providerStatus: terminal ? 'failed' : 'retry_scheduled',
        error: failureCode,
        completedAt: now,
      },
    });
    if (terminal && event.channel === 'whatsapp' && event.reservationId) {
      await enqueueWhatsAppFailureAlert({
        failedNotificationId: event.id,
        reservationId: event.reservationId,
        error: failureCode,
      });
    }
    return terminal ? ('failed' as const) : ('retry_scheduled' as const);
  }
};

export const processNotificationOutbox = async (adapters: NotificationDeliveryAdapters = {}) => {
  const now = adapters.now?.() ?? new Date();
  const staleBefore = new Date(now.getTime() - env.NOTIFICATION_LOCK_TIMEOUT_SECONDS * 1000);
  await prisma.notificationEvent.updateMany({
    where: { status: NotificationStatus.PROCESSING, lockedAt: { lte: staleBefore } },
    data: { status: NotificationStatus.PENDING, lockedAt: null, nextAttemptAt: now, error: 'STALE_LOCK_RECOVERED' },
  });

  const channels = [
    ...(env.EMAIL_DELIVERY_ENABLED || adapters.sendEmail ? ['email'] : []),
    ...(env.WHATSAPP_DELIVERY_ENABLED || adapters.sendWhatsApp ? ['whatsapp'] : []),
  ];
  if (channels.length === 0) return [];

  const events = await prisma.notificationEvent.findMany({
    where: {
      status: NotificationStatus.PENDING,
      channel: { in: channels },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
    take: env.NOTIFICATION_BATCH_SIZE,
    select: { id: true },
  });
  return Promise.all(events.map((event) => processNotificationEvent(event.id, adapters)));
};

export const startNotificationWorker = () => {
  if (!env.NOTIFICATION_WORKER_ENABLED) return () => undefined;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await scheduleReservationReminderNotifications();
      await scheduleDailyOperationsDigest();
      await processNotificationOutbox();
    } catch (error) {
      console.error('Notification worker cycle failed', error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void run(), env.NOTIFICATION_WORKER_INTERVAL_MS);
  timer.unref();
  void run();
  return () => clearInterval(timer);
};

const enqueue = async (data: {
  reservationId?: string;
  leadId?: string;
  channel: string;
  type: string;
  recipient: string;
  idempotencyKey: string;
  nextAttemptAt?: Date;
  maxAttempts?: number;
  templateCode?: string;
  templateVersion?: string;
  renderedContent?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}) => {
  try {
    return await prisma.notificationEvent.upsert({
      where: { idempotencyKey: data.idempotencyKey },
      update: {},
      create: { ...data, status: NotificationStatus.PENDING },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.notificationEvent.findUniqueOrThrow({ where: { idempotencyKey: data.idempotencyKey } });
    }
    throw error;
  }
};

const enqueueReservationEmail = async (
  reservation: ReservationEmailSource,
  input: {
    code: EmailTemplateCode;
    type: string;
    recipient: string;
    idempotencyKey: string;
    nextAttemptAt?: Date;
    metadata?: Prisma.InputJsonValue;
    variables?: EmailTemplateVariables;
  },
) => {
  const recipient = await resolveReservationNotificationEmail(reservation.id, input.recipient);
  if (!recipient) return null;
  const rendered = renderReservationEmail(reservation, input.code, {
    ...input.variables,
    email_client: recipient,
  });
  return enqueue({
    reservationId: reservation.id,
    channel: 'email',
    type: input.type,
    recipient,
    idempotencyKey: input.idempotencyKey,
    nextAttemptAt: input.nextAttemptAt,
    templateCode: input.code,
    templateVersion: EMAIL_TEMPLATE_VERSION,
    renderedContent: rendered as unknown as Prisma.InputJsonValue,
    metadata: input.metadata,
  });
};

const enqueueReservationInternalEmail = (
  reservation: ReservationEmailSource,
  input: {
    code: EmailTemplateCode;
    type: string;
    recipient: string;
    idempotencyKey: string;
    nextAttemptAt?: Date;
    metadata?: Prisma.InputJsonObject;
    variables?: EmailTemplateVariables;
    actor?: NotificationActor | null;
    actorType?: 'SYSTEM' | 'CUSTOMER' | 'EXTERNAL';
    destination?: InternalNotificationDestination;
  },
) => {
  const rendered = renderReservationEmail(reservation, input.code, input.variables);
  return enqueueInternalEmailNotification({
    reservationId: reservation.id,
    type: input.type,
    recipient: input.recipient,
    idempotencyKey: input.idempotencyKey,
    nextAttemptAt: input.nextAttemptAt,
    templateCode: input.code,
    templateVersion: EMAIL_TEMPLATE_VERSION,
    renderedContent: rendered as unknown as Prisma.InputJsonValue,
    metadata: input.metadata,
    actor: input.actor,
    actorType: input.actorType,
    destination: input.destination ?? { type: 'SHARED_OPERATIONAL' },
  });
};

const whatsAppTemplateCode = (type: string, audience: WhatsAppAudience) => {
  if (audience === 'business') return 'WA-BUSINESS-BOOKING-CREATED';
  return {
    booking_received_customer: 'WA-CUSTOMER-BOOKING-RECEIVED',
    booking_confirmed_customer: 'WA-CUSTOMER-BOOKING-CONFIRMED',
    booking_rescheduled_customer: 'WA-CUSTOMER-BOOKING-RESCHEDULED',
    booking_rejected_customer: 'WA-CUSTOMER-BOOKING-REJECTED',
    payment_verified_customer: 'WA-CUSTOMER-PAYMENT-VERIFIED',
  }[type] ?? 'WA-CUSTOMER-TRANSACTIONAL';
};

const buildWhatsAppRenderedContent = (
  reservation: ReservationContactSource & { reference: string; startAt: Date },
  audience: WhatsAppAudience,
): WhatsAppRenderedContent => {
  const contact = reservationContact(reservation);
  const formattedStartAt = formatDateTime(reservation.startAt);
  return {
    audience,
    firstName: contact.firstName,
    lastName: contact.lastName,
    reference: reservation.reference,
    phone: contact.phone,
    email: contact.email,
    packageName: contact.packageName,
    startAt: reservation.startAt.toISOString(),
    formattedStartAt,
    amount: contact.amount,
    whatsappConsent: contact.whatsappConsent,
    parameters: audience === 'business'
      ? [
          reservation.reference,
          `${contact.firstName} ${contact.lastName}`,
          contact.phone,
          contact.packageName,
          formattedStartAt,
        ]
      : [contact.firstName, reservation.reference, formattedStartAt],
  };
};

const enqueueReservationWhatsApp = (
  reservation: ReservationContactSource & { id: string; reference: string; startAt: Date },
  input: {
    audience: WhatsAppAudience;
    type: string;
    recipient: string;
    idempotencyKey: string;
    nextAttemptAt?: Date;
    metadata?: Prisma.InputJsonObject;
  },
) =>
  enqueue({
    reservationId: reservation.id,
    channel: 'whatsapp',
    type: input.type,
    recipient: input.recipient,
    idempotencyKey: input.idempotencyKey,
    nextAttemptAt: input.nextAttemptAt,
    maxAttempts: WHATSAPP_MAX_ATTEMPTS,
    templateCode: whatsAppTemplateCode(input.type, input.audience),
    templateVersion: WHATSAPP_TEMPLATE_VERSION,
    renderedContent: buildWhatsAppRenderedContent(reservation, input.audience) as unknown as Prisma.InputJsonValue,
    metadata: input.metadata,
  });

export const enqueueWhatsAppFailureAlert = async (input: {
  failedNotificationId: string;
  reservationId: string;
  error: string;
}) => {
  const [reservation, failed] = await Promise.all([
    prisma.reservation.findUnique({
      where: { id: input.reservationId },
      include: { customer: true, snapshot: true, payments: { orderBy: { createdAt: 'desc' } } },
    }),
    prisma.notificationEvent.findUnique({ where: { id: input.failedNotificationId } }),
  ]);
  if (!reservation?.snapshot || !failed) return;
  const recipient = failed.recipient.length > 6
    ? `${failed.recipient.slice(0, 3)}••••${failed.recipient.slice(-3)}`
    : 'Masqué';
  return enqueueReservationInternalEmail(reservation, {
    code: 'I-08',
    type: 'whatsapp_delivery_failed_admin',
    recipient: env.ADMIN_NOTIFICATION_EMAIL,
    idempotencyKey: `notification:${input.failedNotificationId}:I-08:email`,
    metadata: { templateCode: 'I-08', failedNotificationId: input.failedNotificationId, error: input.error },
    variables: {
      destinataire_masque: recipient,
      type_message: failed.type,
      statut_consentement: reservation.snapshot.whatsappConsent ? 'Accordé' : 'Non accordé ou non requis',
      code_erreur: input.error,
      message_erreur: 'Échec définitif après trois tentatives',
    },
  });
};

export const enqueueCalendarSyncFailureAlert = async (input: {
  calendarSyncLogId: string;
  reservationId: string;
  error: string;
}) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    include: { customer: true, snapshot: true, payments: { orderBy: { createdAt: 'desc' } } },
  });
  if (!reservation?.snapshot) return;
  return enqueueReservationInternalEmail(reservation, {
    code: 'I-07',
    type: 'calendar_sync_failed_admin',
    recipient: env.ADMIN_NOTIFICATION_EMAIL,
    idempotencyKey: `calendar:${input.calendarSyncLogId}:I-07:email`,
    metadata: { templateCode: 'I-07', calendarSyncLogId: input.calendarSyncLogId, error: input.error },
    variables: {
      statut_reservation: reservationStatusLabel(reservation.status),
      code_erreur: input.error,
      message_erreur: 'Échec définitif après trois tentatives',
      identifiant_calcom_ou_absent: 'Absent ou non confirmé',
    },
  });
};

export const queueReservationCreatedNotifications = async (reservationId: string) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { customer: true, snapshot: true, payments: { orderBy: { createdAt: 'desc' } } },
  });
  if (!reservation) return;
  if (!reservation.snapshot) {
    await recordMissingReservationSnapshot(reservation.id, 'notification_queue');
    return;
  }
  const contact = reservationContact(reservation);
  const jobs: Array<Promise<unknown>> = [
    enqueueReservationInternalEmail(reservation, {
      code: 'I-01',
      type: 'booking_received_admin',
      recipient: env.ADMIN_NOTIFICATION_EMAIL,
      idempotencyKey: `reservation:${reservationId}:created:email:admin`,
      actorType: 'CUSTOMER',
    }),
    enqueueReservationWhatsApp(reservation, {
      audience: 'business',
      type: 'booking_received_admin',
      recipient: env.WHATSAPP_BUSINESS_RECIPIENT,
      idempotencyKey: `reservation:${reservationId}:created:whatsapp:admin`,
    }),
  ];
  if (contact.email) {
    jobs.push(
      enqueueReservationEmail(reservation, {
        code: 'E-01',
        type: 'booking_received_customer',
        recipient: contact.email,
        idempotencyKey: `reservation:${reservationId}:created:email:customer`,
      }),
    );
  }
  if (contact.whatsappConsent) {
    jobs.push(
      enqueueReservationWhatsApp(reservation, {
        audience: 'customer',
        type: 'booking_received_customer',
        recipient: contact.phone,
        idempotencyKey: `reservation:${reservationId}:created:whatsapp:customer`,
      }),
    );
  }
  await Promise.all(jobs);
};

export const queueReservationStatusNotification = async (
  reservationId: string,
  status: ReservationStatus,
  context: NotificationQueueContext = {},
) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      customer: true,
      snapshot: true,
      packageVersion: true,
      payments: { orderBy: { createdAt: 'desc' } },
      transitions: { where: { toStatus: status }, orderBy: { createdAt: 'desc' }, take: 1 },
      financialTasks: { where: { type: 'FULL_REFUND' }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!reservation) return;
  if (!reservation.snapshot) {
    await recordMissingReservationSnapshot(reservation.id, 'notification_queue');
    return;
  }
  const authorizedPayment = reservation.payments.find((payment) =>
    payment.status === PaymentStatus.VERIFIED || payment.status === PaymentStatus.PAID,
  );
  const financialTask = reservation.financialTasks.find((task) => task.paymentId === authorizedPayment?.id);
  let code: EmailTemplateCode | null = null;
  let type: string | null = null;
  if (status === ReservationStatus.CONFIRMED) {
    code = 'E-05';
    type = 'booking_confirmed_customer';
  } else if (status === ReservationStatus.REJECTED && !authorizedPayment) {
    code = 'E-06';
    type = 'booking_rejected_customer';
  } else if (status === ReservationStatus.REJECTED && authorizedPayment && financialTask) {
    code = 'E-07';
    type = 'booking_rejected_customer';
  } else if (status === ReservationStatus.EXPIRED && !authorizedPayment) {
    code = 'E-14';
    type = 'booking_expired_customer';
  } else if (status === ReservationStatus.NO_SHOW) {
    code = 'E-17';
    type = 'booking_no_show_customer';
  } else if (status === ReservationStatus.COMPLETED && hasOwnerExplicitDeliveryLabel(reservation.packageVersion.deliveryLabel)) {
    code = 'E-18';
    type = 'booking_completed_followup_customer';
  }
  if (!code || !type) return;

  const contact = reservationContact(reservation);
  const now = context.now ?? new Date();
  if (status === ReservationStatus.CONFIRMED) {
    await prisma.notificationEvent.updateMany({
      where: {
        reservationId,
        type: { in: ['payment_verified_customer', 'reservation_decision_overdue_admin'] },
        status: NotificationStatus.PENDING,
      },
      data: {
        status: NotificationStatus.CANCELLED,
        nextAttemptAt: null,
        providerStatus: 'cancelled_by_confirmation',
        resolution: 'OBSOLETE',
        resolutionNote: 'Réservation confirmée avant les échéances E-03/I-03.',
        resolvedAt: now,
        resolvedBy: 'SYSTEM',
      },
    });
  }

  const metadata = {
    templateCode: code,
    ...(context.commandId ? { commandId: context.commandId } : {}),
  };
  const customerReason = reservation.transitions[0]?.customerReasonText ?? (contact.locale === 'en' ? 'The request could not be maintained.' : 'La demande n’a pas pu être maintenue.');
  const variables: EmailTemplateVariables = {
    motif_refus_reservation: customerReason,
    motif_expiration: customerReason,
    traitement_financier: contact.locale === 'en' ? 'The financial situation is under review.' : 'La situation financière est en cours d’examen.',
    prochaine_etape: 'Sélection, traitement et préparation de vos livrables',
    delai_suivi: reservation.packageVersion.deliveryLabel?.trim() ?? 'Non applicable',
    canal_suivi: 'E-mail',
  };
  const jobs: Array<Promise<unknown>> = [];
  if (contact.email) {
    jobs.push(enqueueReservationEmail(reservation, {
      code,
      type,
      recipient: contact.email,
      idempotencyKey: `reservation:${reservationId}:v${reservation.version}:${type}:email`,
      metadata,
      variables,
    }));
  }
  if (code === 'E-07' && financialTask) {
    jobs.push(enqueueReservationInternalEmail(reservation, {
      code: 'I-06',
      type: 'refund_action_required_admin',
      recipient: env.ADMIN_NOTIFICATION_EMAIL,
      idempotencyKey: `financial-task:${financialTask.id}:I-06:email`,
      metadata: { ...metadata, templateCode: 'I-06', financialTaskId: financialTask.id },
      actor: context.actor,
      variables: {
        montant_remboursement_fcfa: formatAmount(financialTask.amount),
        canal_remboursement: financialTask.channel ?? 'À définir',
        statut_remboursement: financialTaskStatusLabel(financialTask.status),
        motif_ou_erreur: financialTask.reason,
        echeance_interne: formatDateTime(financialTask.dueAt),
        lien_admin_reservation: adminFinanceUrl(financialTask.id),
      },
    }));
  }
  if (
    contact.whatsappConsent &&
    (status === ReservationStatus.CONFIRMED || status === ReservationStatus.REJECTED)
  ) {
    jobs.push(enqueueReservationWhatsApp(reservation, {
      audience: 'customer',
      type,
      recipient: contact.phone,
      idempotencyKey: `reservation:${reservationId}:v${reservation.version}:${type}:whatsapp`,
      metadata,
    }));
  }
  await Promise.all(jobs);
};

type CancellationPolicyMetadata = {
  origin: 'CUSTOMER' | 'STUDIO';
  requestedAt: string;
  leadTimeMs: number;
  thresholdHours: number;
  paidAmount: number;
  refundableAmount: number;
  taskType: string | null;
};

export const queueCancellationNotifications = async (
  reservationId: string,
  context: NotificationQueueContext = {},
) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      customer: true,
      snapshot: true,
      payments: { orderBy: { createdAt: 'desc' } },
      transitions: {
        where: { toStatus: ReservationStatus.CANCELLED },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      financialTasks: {
        where: { type: { in: ['FULL_REFUND', 'PARTIAL_REFUND'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!reservation || reservation.status !== ReservationStatus.CANCELLED) return;
  if (!reservation.snapshot) {
    await recordMissingReservationSnapshot(reservation.id, 'cancellation_notification_queue');
    return;
  }
  const transitionMetadata = reservation.transitions[0]?.metadata;
  const root = transitionMetadata && typeof transitionMetadata === 'object' && !Array.isArray(transitionMetadata)
    ? transitionMetadata as Record<string, unknown>
    : {};
  const rawPolicy = root.cancellationPolicy;
  if (!rawPolicy || typeof rawPolicy !== 'object' || Array.isArray(rawPolicy)) return;
  const policy = rawPolicy as CancellationPolicyMetadata;
  if (
    !['CUSTOMER', 'STUDIO'].includes(policy.origin) ||
    typeof policy.requestedAt !== 'string' ||
    typeof policy.leadTimeMs !== 'number' ||
    typeof policy.paidAmount !== 'number' ||
    typeof policy.refundableAmount !== 'number'
  ) return;

  const contact = reservationContact(reservation);
  const task = reservation.financialTasks[0] ?? null;
  const code: EmailTemplateCode = policy.origin === 'STUDIO'
    ? 'E-13'
    : policy.refundableAmount > 0
      ? 'E-11'
      : 'E-12';
  const type = policy.origin === 'STUDIO'
    ? 'booking_cancelled_by_studio_customer'
    : policy.refundableAmount > 0
      ? 'booking_cancelled_customer_refund'
      : 'booking_cancelled_customer_no_refund';
  const leadLabel = formatRelativeBusinessDuration(policy.leadTimeMs, contact.locale);
  const metadata = {
    templateCode: code,
    ...(context.commandId ? { commandId: context.commandId } : {}),
    cancellationOrigin: policy.origin,
    refundableAmount: policy.refundableAmount,
    financialTaskId: task?.id ?? null,
  };
  const variables: EmailTemplateVariables = {
    montant_remboursable_fcfa: formatAmount(policy.refundableAmount),
    motif_annulation_studio: reservation.transitions[0]?.customerReasonText ?? (contact.locale === 'en' ? 'The Studio is exceptionally unavailable.' : 'Le Studio est exceptionnellement indisponible.'),
    traitement_financier: contact.locale === 'en' ? 'The financial situation is under review.' : 'La situation financière est en cours d’examen.',
  };
  const jobs: Array<Promise<unknown>> = [];
  if (contact.email) {
    jobs.push(enqueueReservationEmail(reservation, {
      code,
      type,
      recipient: contact.email,
      idempotencyKey: `reservation:${reservationId}:v${reservation.version}:${type}:email`,
      metadata,
      variables,
    }));
  }
  if (task) {
    jobs.push(enqueueReservationInternalEmail(reservation, {
      code: 'I-05',
      type: 'cancellation_financial_action_required_admin',
      recipient: env.ADMIN_NOTIFICATION_EMAIL,
      idempotencyKey: `financial-task:${task.id}:I-05:email`,
      metadata: { ...metadata, templateCode: 'I-05' },
      actor: context.actor,
      variables: {
        creneau: `${formatDate(contact.startAt)}, ${formatTime(contact.startAt)}–${formatTime(contact.endAt)}`,
        date_annulation: formatDateTime(new Date(policy.requestedAt)),
        delai_avant_seance: leadLabel,
        montant_paye_fcfa: formatAmount(policy.paidAmount),
        montant_remboursable_fcfa: formatAmount(policy.refundableAmount),
      },
    }));
  }
  await Promise.all(jobs);
};

export const queueRefundStatusNotifications = async (
  paymentId: string,
  status: PaymentStatus,
) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      reservation: {
        include: {
          customer: true,
          snapshot: true,
          payments: { orderBy: { createdAt: 'desc' } },
          financialTasks: {
            where: { paymentId, type: { in: ['FULL_REFUND', 'PARTIAL_REFUND'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });
  if (!payment || payment.status !== status) return;
  const reservation = payment.reservation;
  if (!reservation.snapshot) {
    await recordMissingReservationSnapshot(reservation.id, 'refund_notification_queue');
    return;
  }
  const task = reservation.financialTasks[0];
  if (!task) return;

  let code: 'E-20' | 'E-21';
  let type: string;
  let eventDate: Date;
  if (
    status === PaymentStatus.REFUND_PENDING &&
    task.status === 'IN_PROGRESS' &&
    task.initiatedAt &&
    task.channel &&
    task.providerReference
  ) {
    code = 'E-20';
    type = 'refund_engaged_customer';
    eventDate = task.initiatedAt;
  } else if (
    status === PaymentStatus.REFUNDED &&
    task.status === 'COMPLETED' &&
    task.completedAt &&
    task.channel &&
    task.providerReference &&
    task.proof
  ) {
    code = 'E-21';
    type = 'refund_completed_customer';
    eventDate = task.completedAt;
  } else {
    return;
  }

  const contact = reservationContact(reservation);
  if (!contact.email) return;
  return enqueueReservationEmail(reservation, {
    code,
    type,
    recipient: contact.email,
    idempotencyKey: `financial-task:${task.id}:${code}:payment-v${payment.version}:email`,
    metadata: { templateCode: code, financialTaskId: task.id, paymentId: payment.id },
    variables: {
      montant_remboursement_fcfa: formatAmount(task.amount),
      canal_remboursement: task.channel,
      reference_remboursement_masquee: maskReference(task.providerReference),
      date_engagement: formatDateTime(eventDate),
      date_finalisation: formatDateTime(eventDate),
    },
  });
};

export const queueReservationRescheduledNotification = async (reservationId: string) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      customer: true,
      snapshot: true,
      payments: { orderBy: { createdAt: 'desc' } },
      transitions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!reservation) return;
  if (!reservation.snapshot) {
    await recordMissingReservationSnapshot(reservation.id, 'notification_queue');
    return;
  }
  const transition = reservation.transitions[0];
  if (!transition?.oldStartAt || !transition.oldEndAt || !transition.newStartAt || !transition.newEndAt) return;
  const contact = reservationContact(reservation);
  const type = 'booking_rescheduled_customer';
  const slot = (startAt: Date, endAt: Date) => `${formatDate(startAt)}, ${formatTime(startAt)}–${formatTime(endAt)}`;
  const metadata = { templateCode: 'E-09', reservationTransitionId: transition.id };
  const jobs: Array<Promise<unknown>> = [];
  if (contact.email) {
    jobs.push(enqueueReservationEmail(reservation, {
      code: 'E-09',
      type,
      recipient: contact.email,
      idempotencyKey: `reservation:${reservationId}:v${reservation.version}:${type}:email`,
      metadata,
      variables: {
        ancien_creneau: slot(transition.oldStartAt, transition.oldEndAt),
        nouveau_creneau_confirme: slot(transition.newStartAt, transition.newEndAt),
        modifications_complementaires: 'Aucune',
      },
    }));
  }
  if (contact.whatsappConsent) {
    jobs.push(enqueueReservationWhatsApp(reservation, {
      audience: 'customer',
      type,
      recipient: contact.phone,
      idempotencyKey: `reservation:${reservationId}:v${reservation.version}:${type}:whatsapp`,
      metadata,
    }));
  }
  await Promise.all(jobs);
};

const rescheduleSlot = (startAt: Date, endAt: Date) =>
  `${formatDate(startAt)}, ${formatTime(startAt)}–${formatTime(endAt)}`;

export const queueRescheduleRequestNotifications = async (
  requestId: string,
  context: NotificationQueueContext = {},
) => {
  const request = await prisma.reservationRescheduleRequest.findUnique({
    where: { id: requestId },
    include: {
      reservation: {
        include: {
          customer: true,
          snapshot: true,
          payments: { orderBy: { createdAt: 'desc' } },
        },
      },
    },
  });
  if (!request || request.status !== 'PENDING') return;
  const reservation = request.reservation;
  if (!reservation.snapshot) {
    await recordMissingReservationSnapshot(reservation.id, 'reschedule_request_notification_queue');
    return;
  }
  const acceptedCount = await prisma.reservationRescheduleRequest.count({
    where: { reservationId: reservation.id, status: 'ACCEPTED' },
  });
  const contact = reservationContact(reservation);
  const metadata = {
    rescheduleRequestId: request.id,
    ...(context.commandId ? { commandId: context.commandId } : {}),
  };
  const variables: EmailTemplateVariables = {
    ancien_creneau: rescheduleSlot(request.oldStartAt, request.oldEndAt),
    nouveau_creneau_demande: rescheduleSlot(request.requestedStartAt, request.requestedEndAt),
    nouveau_creneau: rescheduleSlot(request.requestedStartAt, request.requestedEndAt),
    delai_avant_seance: formatRelativeBusinessDuration(request.oldStartAt.getTime() - request.requestedAt.getTime(), contact.locale),
    nombre_reports: String(acceptedCount),
  };
  const jobs: Array<Promise<unknown>> = [];
  if (contact.email) {
    jobs.push(enqueueReservationEmail(reservation, {
      code: 'E-08',
      type: 'reschedule_request_received_customer',
      recipient: contact.email,
      idempotencyKey: `reschedule-request:${request.id}:E-08:email`,
      metadata: { ...metadata, templateCode: 'E-08' },
      variables,
    }));
  }
  jobs.push(enqueueReservationInternalEmail(reservation, {
    code: 'I-04',
    type: 'reschedule_request_review_admin',
    recipient: env.ADMIN_NOTIFICATION_EMAIL,
    idempotencyKey: `reschedule-request:${request.id}:I-04:email`,
    metadata: { ...metadata, templateCode: 'I-04' },
    actor: context.actor,
    variables,
  }));
  await Promise.all(jobs);
};

export const queueRescheduleRequestDecisionNotification = async (
  requestId: string,
  context: NotificationQueueContext = {},
) => {
  const request = await prisma.reservationRescheduleRequest.findUnique({
    where: { id: requestId },
    include: {
      reservation: {
        include: {
          customer: true,
          snapshot: true,
          payments: { orderBy: { createdAt: 'desc' } },
        },
      },
    },
  });
  if (!request) return;
  if (request.status === 'ACCEPTED') {
    await queueReservationRescheduledNotification(request.reservationId);
    return;
  }
  if (request.status !== 'REJECTED') return;
  const reservation = request.reservation;
  if (!reservation.snapshot) {
    await recordMissingReservationSnapshot(reservation.id, 'reschedule_rejection_notification_queue');
    return;
  }
  const contact = reservationContact(reservation);
  if (!contact.email) return;
  await enqueueReservationEmail(reservation, {
    code: 'E-10',
    type: 'reschedule_request_rejected_customer',
    recipient: contact.email,
    idempotencyKey: `reschedule-request:${request.id}:E-10:email`,
    metadata: {
      templateCode: 'E-10',
      rescheduleRequestId: request.id,
      ...(context.commandId ? { commandId: context.commandId } : {}),
    },
    variables: {
      motif_refus_report: request.customerReasonText ?? (contact.locale === 'en' ? 'The requested new time slot is not available.' : 'Le nouveau créneau demandé n’est pas disponible.'),
      ancien_creneau: rescheduleSlot(request.oldStartAt, request.oldEndAt),
    },
  });
};

export const scheduleReservationReminderNotifications = async (now = new Date()) => {
  const in72Hours = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  const reservations = await prisma.reservation.findMany({
    where: {
      status: ReservationStatus.CONFIRMED,
      startAt: { gt: now, lte: in72Hours },
    },
    include: {
      customer: true,
      snapshot: true,
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });
  const jobs: Array<Promise<unknown>> = [];
  for (const reservation of reservations) {
    if (!reservation.snapshot) {
      await recordMissingReservationSnapshot(reservation.id, 'notification_reminder_scheduler');
      continue;
    }
    const contact = reservationContact(reservation);
    if (!contact.email) continue;
    const untilStart = reservation.startAt.getTime() - now.getTime();
    const base = {
      date_seance: formatDate(reservation.startAt),
      heure_debut: formatTime(reservation.startAt),
      heure_fin: formatTime(reservation.endAt),
      adresse_ou_instruction_acces: 'Golden Studio Plus, Douala',
      contact_studio: '+237 673 026 654',
    };
    const metadata = {
      expectedReservationVersion: reservation.version,
      scheduledStartAt: reservation.startAt.toISOString(),
    };
    const threshold72 = reservation.startAt.getTime() - 72 * 60 * 60 * 1000;
    if (
      reservation.createdAt.getTime() <= threshold72 &&
      untilStart > 48 * 60 * 60 * 1000
    ) {
      jobs.push(enqueueReservationEmail(reservation, {
        code: 'E-15',
        type: 'booking_change_deadline_reminder_customer',
        recipient: contact.email,
        idempotencyKey: `reservation:${reservation.id}:v${reservation.version}:E-15:email`,
        metadata: { ...metadata, templateCode: 'E-15' },
        variables: base,
      }));
    }
    if (untilStart <= 24 * 60 * 60 * 1000) {
      jobs.push(enqueueReservationEmail(reservation, {
        code: 'E-16',
        type: 'booking_24h_reminder_customer',
        recipient: contact.email,
        idempotencyKey: `reservation:${reservation.id}:v${reservation.version}:E-16:email`,
        metadata: { ...metadata, templateCode: 'E-16' },
        variables: base,
      }));
    }
  }
  await Promise.all(jobs);
  return jobs.length;
};

export const scheduleDailyOperationsDigest = async (now = new Date()) => {
  const localParts = Object.fromEntries(new Intl.DateTimeFormat('fr-CM', {
    timeZone: 'Africa/Douala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now).map((part) => [part.type, part.value]));
  if (Number(localParts.hour) < 18) return null;
  const year = Number(localParts.year);
  const month = Number(localParts.month);
  const day = Number(localParts.day);
  const dateKey = `${localParts.year}-${localParts.month}-${localParts.day}`;
  const tomorrowStart = new Date(Date.UTC(year, month - 1, day + 1) - 60 * 60 * 1000);
  const tomorrowEnd = new Date(Date.UTC(year, month - 1, day + 2) - 60 * 60 * 1000);
  const [pending, payments, decisions, refunds, sessions, calcom, whatsapp, bounces] = await Promise.all([
    prisma.reservation.count({ where: { status: ReservationStatus.PENDING_CONFIRMATION } }),
    prisma.payment.count({ where: { status: { in: [
      PaymentStatus.PENDING,
      PaymentStatus.PAYMENT_INFO_REQUIRED,
      PaymentStatus.VERIFICATION_BLOCKED,
    ] } } }),
    prisma.payment.count({ where: {
      status: { in: [PaymentStatus.VERIFIED, PaymentStatus.PAID] },
      reservation: { status: ReservationStatus.PENDING_CONFIRMATION },
    } }),
    prisma.payment.count({ where: { status: PaymentStatus.REFUND_PENDING } }),
    prisma.reservation.count({ where: {
      status: ReservationStatus.CONFIRMED,
      startAt: { gte: tomorrowStart, lt: tomorrowEnd },
    } }),
    prisma.calendarSyncLog.count({ where: { status: 'FAILED' } }),
    prisma.notificationEvent.count({ where: { channel: 'whatsapp', status: NotificationStatus.FAILED } }),
    prisma.notificationEvent.count({ where: { channel: 'email', status: NotificationStatus.FAILED } }),
  ]);
  const counts = [pending, payments, decisions, refunds, sessions, calcom, whatsapp, bounces];
  if (counts.every((count) => count === 0)) return null;
  const priorities = [
    pending ? `${pending} demande(s) en attente` : null,
    payments ? `${payments} paiement(s) à vérifier` : null,
    decisions ? `${decisions} décision(s) après paiement` : null,
    refunds ? `${refunds} remboursement(s) à traiter` : null,
    calcom ? `${calcom} incident(s) Cal.com` : null,
    whatsapp ? `${whatsapp} incident(s) WhatsApp` : null,
    bounces ? `${bounces} échec(s) e-mail` : null,
  ].filter(Boolean).join(' ; ');
  const rendered = renderEmailTemplate('I-11', {
    date_douala: formatDate(now),
    nombre_pending: pending,
    nombre_paiements: payments,
    nombre_decisions: decisions,
    nombre_remboursements: refunds,
    nombre_seances_demain: sessions,
    nombre_calcom: calcom,
    nombre_whatsapp: whatsapp,
    nombre_bounces: bounces,
    resume_actions_prioritaires: priorities || 'Séances du lendemain à préparer',
    lien_admin_tableau_bord: `${env.CLIENT_ORIGINS[0] ?? 'https://gsplus.vip'}/admin`,
  });
  return enqueueInternalEmailNotification({
    type: 'daily_operations_digest_admin',
    recipient: env.ADMIN_NOTIFICATION_EMAIL,
    idempotencyKey: `digest:${dateKey}:I-11:email`,
    templateCode: 'I-11',
    templateVersion: EMAIL_TEMPLATE_VERSION,
    renderedContent: rendered as unknown as Prisma.InputJsonValue,
    metadata: { templateCode: 'I-11', dateDouala: dateKey },
    destination: { type: 'SHARED_OPERATIONAL' },
  });
};

const PAYMENT_VERIFIED_NOTICE_DELAY_MS = env.PAYMENT_VERIFIED_NOTICE_DELAY_MS;

const PAYMENT_DECISION_OVERDUE_DELAY_MS = env.PAYMENT_DECISION_OVERDUE_DELAY_MS;
type NotificationQueueContext = {
  now?: Date;
  commandId?: string;
  actor?: NotificationActor | null;
};

export const queuePaymentVerifiedNotification = async (
  reservationId: string,
  context: NotificationQueueContext = {},
) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      customer: true,
      snapshot: true,
      payments: { where: { status: PaymentStatus.VERIFIED }, orderBy: { updatedAt: 'desc' }, take: 1 },
    },
  });
  const payment = reservation?.payments[0];
  if (!reservation || !payment) return;
  if (!reservation.snapshot) {
    await recordMissingReservationSnapshot(reservation.id, 'notification_queue');
    return;
  }
  const contact = reservationContact(reservation);
  const nextAttemptAt = new Date((context.now ?? new Date()).getTime() + PAYMENT_VERIFIED_NOTICE_DELAY_MS);
  const metadata = {
    templateCode: 'E-03',
    ...(context.commandId ? { commandId: context.commandId } : {}),
  };
  const jobs: Array<Promise<unknown>> = [];
  if (contact.email) {
    jobs.push(
      enqueueReservationEmail(reservation, {
        code: 'E-03',
        type: 'payment_verified_customer',
        recipient: contact.email,
        idempotencyKey: `payment:${payment.id}:v${payment.version}:verified:email`,
        nextAttemptAt,
        metadata,
      }),
    );
  }
  if (contact.whatsappConsent) {
    jobs.push(
      enqueueReservationWhatsApp(reservation, {
        audience: 'customer',
        type: 'payment_verified_customer',
        recipient: contact.phone,
        idempotencyKey: `payment:${payment.id}:v${payment.version}:verified:whatsapp`,
        nextAttemptAt,
        metadata,
      }),
    );
  }
  jobs.push(enqueueReservationInternalEmail(reservation, {
    code: 'I-03',
    type: 'reservation_decision_overdue_admin',
    recipient: env.ADMIN_NOTIFICATION_EMAIL,
    idempotencyKey: `payment:${payment.id}:v${payment.version}:${payment.status}:I-03:email`,
    nextAttemptAt: new Date((context.now ?? new Date()).getTime() + PAYMENT_DECISION_OVERDUE_DELAY_MS),
    metadata: {
      templateCode: 'I-03',
      paymentId: payment.id,
      expectedPaymentStatus: payment.status,
      expectedPaymentVersion: payment.version,
    },
    actor: context.actor,
    variables: {
      duree_attente: '30 minutes',
      statut_reservation: reservationStatusLabel(reservation.status),
      date_expiration: formatDateTime(reservation.expiresAt ?? new Date((context.now ?? new Date()).getTime() + 24 * 60 * 60 * 1000)),
    },
  }));
  await Promise.all(jobs);
};

export const queuePaymentAddedNotifications = async (
  paymentId: string,
  context: NotificationQueueContext = {},
) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      reservation: {
        include: {
          customer: true,
          snapshot: true,
          payments: { orderBy: { createdAt: 'desc' } },
        },
      },
    },
  });
  if (!payment) return;
  const reservation = payment.reservation;
  if (!reservation.snapshot) {
    await recordMissingReservationSnapshot(reservation.id, 'payment_added_notification_queue');
    return;
  }
  const contact = reservationContact(reservation);
  const variables: EmailTemplateVariables = {
    montant_fcfa: formatAmount(payment.amount),
    operateur_paiement: paymentMethodLabel(payment.method, contact.locale),
    reference_paiement_masquee: maskReference(payment.transactionRef),
    date_transmission: formatDateTime(payment.createdAt),
  };
  const metadata = {
    paymentId: payment.id,
    ...(context.commandId ? { commandId: context.commandId } : {}),
  };
  const jobs: Array<Promise<unknown>> = [
    enqueueReservationInternalEmail(reservation, {
      code: 'I-02',
      type: 'payment_added_admin',
      recipient: env.ADMIN_NOTIFICATION_EMAIL,
      idempotencyKey: `payment:${payment.id}:I-02:email`,
      metadata: { ...metadata, templateCode: 'I-02' },
      actor: context.actor,
      variables,
    }),
  ];
  if (contact.email) {
    jobs.push(enqueueReservationEmail(reservation, {
      code: 'E-02',
      type: 'payment_added_customer',
      recipient: contact.email,
      idempotencyKey: `payment:${payment.id}:E-02:email`,
      metadata: { ...metadata, templateCode: 'E-02' },
      variables,
    }));
  }
  await Promise.all(jobs);
};

export const queuePaymentStatusNotifications = async (
  reservationId: string,
  status: PaymentStatus,
  context: NotificationQueueContext = {},
) => {
  if (status === PaymentStatus.VERIFIED || status === PaymentStatus.PAID) {
    await queuePaymentVerifiedNotification(reservationId, context);
    return;
  }
  if (
    status !== PaymentStatus.REJECTED &&
    status !== PaymentStatus.PAYMENT_INFO_REQUIRED &&
    status !== PaymentStatus.VERIFICATION_BLOCKED
  ) return;

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      customer: true,
      snapshot: true,
      payments: { where: { status }, orderBy: { updatedAt: 'desc' }, take: 1, include: { transitions: { where: { toStatus: status }, orderBy: { createdAt: 'desc' }, take: 1 } } },
    },
  });
  const payment = reservation?.payments[0];
  if (!reservation || !payment) return;
  if (!reservation.snapshot) {
    await recordMissingReservationSnapshot(reservation.id, 'notification_queue');
    return;
  }
  const contact = reservationContact(reservation);
  if (!contact.email) return;
  const now = context.now ?? new Date();
  const deadline = reservation.expiresAt ?? new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const code: EmailTemplateCode = status === PaymentStatus.REJECTED
    ? 'E-04'
    : status === PaymentStatus.PAYMENT_INFO_REQUIRED
      ? 'E-04A'
      : 'E-04B';
  const type = status === PaymentStatus.REJECTED
    ? 'payment_rejected_customer'
    : status === PaymentStatus.PAYMENT_INFO_REQUIRED
      ? 'payment_info_required_customer'
      : 'payment_verification_blocked_customer';
  const delayed = status === PaymentStatus.VERIFICATION_BLOCKED
    ? new Date(now.getTime() + PAYMENT_DECISION_OVERDUE_DELAY_MS)
    : undefined;
  const metadata = {
    templateCode: code,
    paymentId: payment.id,
    expectedPaymentStatus: status,
    ...(context.commandId ? { commandId: context.commandId } : {}),
  };
  const customerReason = payment.transitions[0]?.customerReasonText ?? (contact.locale === 'en' ? 'Additional review is required.' : 'Un contrôle complémentaire est nécessaire.');
  const variables: EmailTemplateVariables = {
    motif_rejet_paiement: customerReason,
    instruction_regularisation: contact.locale === 'en' ? 'provide a new reference or contact the Studio' : 'transmettre une nouvelle référence ou contacter le Studio',
    information_paiement_requise: customerReason,
    date_limite_regularisation: formatDateTime(deadline),
  };
  const jobs: Array<Promise<unknown>> = [
    enqueueReservationEmail(reservation, {
      code,
      type,
      recipient: contact.email,
      idempotencyKey: `payment:${payment.id}:v${payment.version}:${code}:email`,
      nextAttemptAt: delayed,
      metadata,
      variables,
    }),
  ];
  if (status !== PaymentStatus.REJECTED) {
    jobs.push(enqueueReservationInternalEmail(reservation, {
      code: 'I-03',
      type: 'reservation_decision_overdue_admin',
      recipient: env.ADMIN_NOTIFICATION_EMAIL,
      idempotencyKey: `payment:${payment.id}:v${payment.version}:${payment.status}:I-03:email`,
      nextAttemptAt: new Date(now.getTime() + PAYMENT_DECISION_OVERDUE_DELAY_MS),
      metadata: {
        templateCode: 'I-03',
        paymentId: payment.id,
        expectedPaymentStatus: status,
        expectedPaymentVersion: payment.version,
      },
      actor: context.actor,
      variables: {
        duree_attente: '30 minutes',
        statut_reservation: reservationStatusLabel(reservation.status),
        date_expiration: formatDateTime(deadline),
      },
    }));
  }
  await Promise.all(jobs);
};


export const queueLeadCreatedNotification = async (leadId: string) => {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;
  const reference = lead.reference;
  const date = formatDateTime(lead.createdAt);
  const organization = lead.company ?? 'Organisation non communiquée';
  const organizationPhrase = lead.company ? (lead.locale === 'en' ? ` on behalf of ${lead.company}` : ` au nom de ${lead.company}`) : '';
  const subject = lead.subject ?? lead.source ?? 'Demande d’information';
  const customerCode: EmailTemplateCode = lead.type === LeadType.CONTACT ? 'E-22' : 'E-23';
  const customerVariables: EmailTemplateVariables = customerCode === 'E-22'
    ? {
        prenom_contact: lead.name,
        objet_demande: subject,
        reference_contact: reference,
        date_reception: date,
      }
    : {
        nom_contact: lead.name,
        organisation: organization,
        organisation_phrase: organizationPhrase,
        objet_demande: subject,
        reference_b2b: reference,
        date_reception: date,
      };
  const jobs: Array<Promise<unknown>> = [];
  if (lead.email) {
    const rendered = renderEmailTemplate(customerCode, customerVariables, lead.locale === 'en' ? 'en' : 'fr');
    jobs.push(enqueue({
      leadId,
      channel: 'email',
      type: 'lead_received_customer',
      recipient: lead.email,
      idempotencyKey: `lead:${leadId}:created:${customerCode}:email:customer`,
      templateCode: customerCode,
      templateVersion: EMAIL_TEMPLATE_VERSION,
      renderedContent: rendered as unknown as Prisma.InputJsonValue,
    }));
  }
  const adminRendered = renderEmailTemplate('I-12', {
    type_demande: lead.type === LeadType.CONTACT ? 'Contact' : lead.type === LeadType.B2B ? 'Demande professionnelle' : 'Demande de devis',
    organisation_ou_nom: lead.company ?? lead.name,
    reference_demande: reference,
    nom_contact: lead.name,
    organisation: organization,
    telephone_e164: lead.phone ?? 'Non communiqué',
    email_contact: lead.email ?? 'Non communiqué',
    objet_demande: subject,
    priorite: lead.type === LeadType.CONTACT ? 'Normale' : 'Haute',
    resume_message: lead.message,
    lien_admin_demande: adminLeadUrl(lead.reference),
  });
  jobs.push(enqueueInternalEmailNotification({
    leadId,
    type: 'lead_created_admin',
    recipient: env.ADMIN_NOTIFICATION_EMAIL,
    idempotencyKey: `lead:${leadId}:created:email:admin`,
    templateCode: 'I-12',
    templateVersion: EMAIL_TEMPLATE_VERSION,
    renderedContent: adminRendered as unknown as Prisma.InputJsonValue,
    actorType: 'EXTERNAL',
    metadata: { templateCode: 'I-12' },
    destination: { type: 'SHARED_OPERATIONAL' },
  }));
  await Promise.all(jobs);
};

export const resolveNotificationEvent = async (
  id: string,
  input: {
    resolution: 'OBSOLETE' | 'DUPLICATE' | 'PERMANENTLY_FAILED' | 'ACTIONABLE_REVIEW_REQUIRED' | 'REPLACED';
    note: string;
    replacementEventId?: string;
  },
  resolvedBy: string,
) => {
  const event = await prisma.notificationEvent.findUnique({ where: { id } });
  if (!event) throw new HttpError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
  if (event.status !== NotificationStatus.FAILED) {
    throw new HttpError(409, 'NOTIFICATION_NOT_FAILED', 'Only a failed notification can receive a dead-letter disposition.');
  }
  if (input.resolution === 'REPLACED') {
    if (!input.replacementEventId || input.replacementEventId === id) {
      throw new HttpError(400, 'NOTIFICATION_REPLACEMENT_INVALID', 'A distinct replacement notification is required.');
    }
    const replacement = await prisma.notificationEvent.findUnique({ where: { id: input.replacementEventId }, select: { id: true } });
    if (!replacement) throw new HttpError(400, 'NOTIFICATION_REPLACEMENT_INVALID', 'The replacement notification does not exist.');
  } else if (input.replacementEventId) {
    throw new HttpError(400, 'NOTIFICATION_REPLACEMENT_UNEXPECTED', 'A replacement is valid only for the REPLACED disposition.');
  }

  return prisma.notificationEvent.update({
    where: { id },
    data: {
      resolution: input.resolution,
      resolutionNote: input.note,
      resolvedAt: new Date(),
      resolvedBy,
      replacementEventId: input.replacementEventId ?? null,
    },
  });
};

export const retryNotificationEvent = async (id: string) => {
  const event = await prisma.notificationEvent.findUnique({ where: { id } });
  if (!event) throw new HttpError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
  if (event.status === NotificationStatus.SENT) {
    throw new HttpError(409, 'NOTIFICATION_ALREADY_SENT', 'A delivered notification cannot be retried.');
  }
  if (event.status === NotificationStatus.PROCESSING) {
    throw new HttpError(409, 'NOTIFICATION_IN_PROGRESS', 'This notification is currently being processed.');
  }
  if (event.resolution && event.resolution !== 'ACTIONABLE_REVIEW_REQUIRED') {
    throw new HttpError(409, 'NOTIFICATION_RESOLUTION_BLOCKS_RETRY', 'This dead-letter disposition does not allow retry.');
  }
  if (event.channel === 'email' && !env.EMAIL_DELIVERY_ENABLED) {
    throw new HttpError(409, 'NOTIFICATION_CHANNEL_DISABLED', 'E-mail delivery is not enabled.');
  }
  if (event.channel === 'whatsapp' && !env.WHATSAPP_DELIVERY_ENABLED) {
    throw new HttpError(409, 'NOTIFICATION_CHANNEL_DISABLED', 'WhatsApp delivery is not enabled.');
  }
  return prisma.notificationEvent.update({
    where: { id },
    data: {
      status: NotificationStatus.PENDING,
      attemptCount: 0,
      nextAttemptAt: new Date(),
      lockedAt: null,
      error: null,
      providerStatus: 'queued',
      resolution: null,
      resolutionNote: null,
      resolvedAt: null,
      resolvedBy: null,
      replacementEventId: null,
    },
  });
};

export const verifyWhatsAppWebhook = (mode: unknown, token: unknown) =>
  env.WHATSAPP_DELIVERY_ENABLED &&
  whatsappConfigured() &&
  mode === 'subscribe' &&
  typeof token === 'string' &&
  token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

export const isValidWhatsAppSignature = (rawBody: Buffer, signature: string | undefined) => {
  if (!env.WHATSAPP_APP_SECRET || !signature?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', env.WHATSAPP_APP_SECRET).update(rawBody).digest('hex'));
  const supplied = Buffer.from(signature.slice(7));
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
};

type WhatsAppWebhook = {
  entry?: Array<{
    changes?: Array<{
      value?: { statuses?: Array<{ id?: string; status?: string }> };
    }>;
  }>;
};

export const handleWhatsAppWebhook = async (payload: WhatsAppWebhook) => {
  const statuses = payload.entry?.flatMap((entry) => entry.changes ?? []).flatMap((change) => change.value?.statuses ?? []) ?? [];
  const now = new Date();
  for (const status of statuses) {
    if (!status.id || !status.status) continue;
    const providerStatus = status.status.slice(0, 50).toLowerCase();
    const event = await prisma.notificationEvent.findFirst({
      where: { channel: 'whatsapp', providerMessageId: status.id },
    });
    if (!event) continue;

    if (providerStatus === 'read') {
      await prisma.notificationEvent.update({
        where: { id: event.id },
        data: {
          providerStatus: 'read',
          lastWebhookAt: now,
          deliveredAt: event.deliveredAt ?? now,
          readAt: event.readAt ?? now,
        },
      });
      await prisma.notificationAttempt.updateMany({
        where: { notificationEventId: event.id, providerMessageId: status.id },
        data: { status: 'READ', providerStatus: 'read', completedAt: now },
      });
      continue;
    }

    if (providerStatus === 'delivered') {
      await prisma.notificationEvent.update({
        where: { id: event.id },
        data: {
          providerStatus: event.providerStatus === 'read' ? 'read' : 'delivered',
          lastWebhookAt: now,
          deliveredAt: event.deliveredAt ?? now,
        },
      });
      await prisma.notificationAttempt.updateMany({
        where: { notificationEventId: event.id, providerMessageId: status.id },
        data: {
          status: event.providerStatus === 'read' ? 'READ' : 'DELIVERED',
          providerStatus: event.providerStatus === 'read' ? 'read' : 'delivered',
          completedAt: now,
        },
      });
      continue;
    }

    if (providerStatus === 'failed') {
      if (event.providerStatus === 'read' || event.providerStatus === 'delivered') {
        await prisma.notificationEvent.update({
          where: { id: event.id },
          data: { lastWebhookAt: now },
        });
        continue;
      }
      if (event.status === NotificationStatus.PENDING && event.providerStatus === 'retry_scheduled') {
        await prisma.notificationEvent.update({
          where: { id: event.id },
          data: { lastWebhookAt: now },
        });
        continue;
      }
      const terminal = event.attemptCount >= event.maxAttempts;
      await prisma.notificationEvent.update({
        where: { id: event.id },
        data: {
          status: terminal ? NotificationStatus.FAILED : NotificationStatus.PENDING,
          providerStatus: terminal ? 'failed' : 'retry_scheduled',
          error: 'WHATSAPP_PROVIDER_FAILED',
          nextAttemptAt: terminal ? null : new Date(now.getTime() + retryDelayMs(event)),
          lastWebhookAt: now,
          lockedAt: null,
        },
      });
      await prisma.notificationAttempt.updateMany({
        where: { notificationEventId: event.id, providerMessageId: status.id },
        data: {
          status: terminal ? 'FAILED' : 'RETRYING',
          providerStatus: 'failed',
          error: 'WHATSAPP_PROVIDER_FAILED',
          completedAt: now,
        },
      });
      if (terminal && event.reservationId) {
        await enqueueWhatsAppFailureAlert({
          failedNotificationId: event.id,
          reservationId: event.reservationId,
          error: 'WHATSAPP_PROVIDER_FAILED',
        });
      }
      continue;
    }

    await prisma.notificationEvent.update({
      where: { id: event.id },
      data: { providerStatus, lastWebhookAt: now },
    });
    await prisma.notificationAttempt.updateMany({
      where: { notificationEventId: event.id, providerMessageId: status.id },
      data: { providerStatus },
    });
  }
};
