import { createHmac, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';

import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { NotificationStatus, PaymentStatus, ReservationStatus } from '../generated/prisma/enums.js';
import { normalizeE164Phone } from '../utils/phone.js';

type EmailMessage = { subject: string; text: string; html: string };
type DeliveryResult = { providerMessageId: string | null; providerStatus: string };
type NotificationEvent = NonNullable<Awaited<ReturnType<typeof getNotificationEvent>>>;
type ReservationForMessage = NonNullable<NotificationEvent['reservation']>;

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
      reservation: { include: { customer: true, package: true, payments: true } },
      lead: true,
    },
  });

const reservationLines = (reservation: ReservationForMessage) => [
  `Référence : ${reservation.reference}`,
  `Client : ${reservation.customer.firstName} ${reservation.customer.lastName}`,
  `Téléphone : ${reservation.customer.phone}`,
  `E-mail : ${reservation.customer.email ?? 'Non renseigné'}`,
  `Pack : ${reservation.package.name}`,
  `Date : ${formatDateTime(reservation.startAt)}`,
  `Montant : ${formatPrice(reservation.package.price)}`,
  `Statut : ${reservation.status}`,
];

const buildEmailMessage = (event: NotificationEvent): EmailMessage | null => {
  let lines: string[];
  let subject: string;

  if (event.type === 'booking_received_customer' && event.reservation) {
    lines = [
      `Bonjour ${event.reservation.customer.firstName},`,
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
      `Bonjour ${event.reservation.customer.firstName},`,
      'Le créneau de votre réservation a été modifié.',
      ...reservationLines(event.reservation),
    ];
    subject = `Nouveau créneau de réservation - ${event.reservation.reference}`;
  } else if (event.type === 'booking_confirmed_customer' && event.reservation) {
    lines = [
      `Bonjour ${event.reservation.customer.firstName},`,
      'Votre réservation est confirmée.',
      ...reservationLines(event.reservation),
    ];
    subject = `Réservation confirmée - ${event.reservation.reference}`;
  } else if (event.type === 'booking_rejected_customer' && event.reservation) {
    lines = [
      `Bonjour ${event.reservation.customer.firstName},`,
      'Votre réservation ne peut pas être confirmée pour ce créneau.',
      'Vous pouvez contacter le studio pour choisir un autre horaire.',
      ...reservationLines(event.reservation),
    ];
    subject = `Réservation non confirmée - ${event.reservation.reference}`;
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
      `Bonjour ${event.reservation.customer.firstName},`,
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
  if (type === 'booking_confirmed_customer') return env.WHATSAPP_TEMPLATE_BOOKING_CONFIRMED;
  if (type === 'booking_rescheduled_customer') return env.WHATSAPP_TEMPLATE_BOOKING_RESCHEDULED;
  if (type === 'booking_rejected_customer') return env.WHATSAPP_TEMPLATE_BOOKING_REJECTED;
  if (type === 'payment_verified_customer') return env.WHATSAPP_TEMPLATE_PAYMENT_VERIFIED;
  return '';
};

const sendWhatsApp = async (event: NotificationEvent): Promise<DeliveryResult> => {
  if (!env.WHATSAPP_DELIVERY_ENABLED || !whatsappConfigured()) throw new Error('WHATSAPP_CHANNEL_NOT_CONFIGURED');
  if (!event.reservation?.whatsappConsentAt) throw new Error('WHATSAPP_CONSENT_MISSING');
  const templateName = whatsappTemplate(event.type);
  if (!templateName) throw new Error('WHATSAPP_TEMPLATE_NOT_CONFIGURED');

  const response = await fetch(
    `${env.WHATSAPP_GRAPH_API_BASE_URL}/${env.WHATSAPP_GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
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
              parameters: [
                { type: 'text', text: event.reservation.customer.firstName },
                { type: 'text', text: event.reservation.reference },
                { type: 'text', text: formatDateTime(event.reservation.startAt) },
              ],
            },
          ],
        },
      }),
    },
  );
  if (!response.ok) throw new Error(`WHATSAPP_PROVIDER_HTTP_${response.status}`);
  const payload = (await response.json()) as { messages?: Array<{ id?: string }> };
  return { providerMessageId: payload.messages?.[0]?.id ?? null, providerStatus: 'accepted' };
};

const safeFailureCode = (event: NotificationEvent, error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  if (/^[A-Z0-9_]+$/.test(message)) return message.slice(0, 100);
  if (/^WHATSAPP_PROVIDER_HTTP_\d{3}$/.test(message)) return message;
  return event.channel === 'whatsapp' ? 'WHATSAPP_DELIVERY_FAILED' : 'EMAIL_DELIVERY_FAILED';
};

const retryDelayMs = (attemptCount: number) => Math.min(3_600_000, 60_000 * 2 ** Math.max(0, attemptCount - 1));

export const processNotificationEvent = async (id: string, adapters: NotificationDeliveryAdapters = {}) => {
  const now = adapters.now?.() ?? new Date();
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

  try {
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
        deliveredAt: event.channel === 'email' ? now : null,
        lockedAt: null,
        error: null,
      },
    });
    return 'sent' as const;
  } catch (error) {
    const terminal = event.attemptCount >= event.maxAttempts;
    await prisma.notificationEvent.update({
      where: { id },
      data: {
        status: terminal ? NotificationStatus.FAILED : NotificationStatus.PENDING,
        error: safeFailureCode(event, error),
        providerStatus: terminal ? 'failed' : 'retry_scheduled',
        nextAttemptAt: terminal ? null : new Date(now.getTime() + retryDelayMs(event.attemptCount)),
        lockedAt: null,
      },
    });
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

export const queueReservationCreatedNotifications = async (reservationId: string) => {
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { customer: true } });
  if (!reservation) return;
  const jobs: Array<Promise<unknown>> = [
    enqueue({
      reservationId,
      channel: 'email',
      type: 'booking_received_admin',
      recipient: env.ADMIN_NOTIFICATION_EMAIL,
      idempotencyKey: `reservation:${reservationId}:created:email:admin`,
    }),
  ];
  if (reservation.customer.email) {
    jobs.push(
      enqueue({
        reservationId,
        channel: 'email',
        type: 'booking_received_customer',
        recipient: reservation.customer.email,
        idempotencyKey: `reservation:${reservationId}:created:email:customer`,
      }),
    );
  }
  if (env.WHATSAPP_DELIVERY_ENABLED && reservation.whatsappConsentAt) {
    jobs.push(
      enqueue({
        reservationId,
        channel: 'whatsapp',
        type: 'booking_received_customer',
        recipient: reservation.customer.phone,
        idempotencyKey: `reservation:${reservationId}:created:whatsapp:customer`,
      }),
    );
  }
  await Promise.all(jobs);
};

export const queueReservationStatusNotification = async (reservationId: string, status: ReservationStatus) => {
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { customer: true } });
  if (!reservation) return;
  const type =
    status === ReservationStatus.CONFIRMED
      ? 'booking_confirmed_customer'
      : status === ReservationStatus.CANCELLED || status === ReservationStatus.REJECTED
        ? 'booking_rejected_customer'
        : null;
  if (!type) return;
  const jobs: Array<Promise<unknown>> = [];
  if (reservation.customer.email) {
    jobs.push(
      enqueue({
        reservationId,
        channel: 'email',
        type,
        recipient: reservation.customer.email,
        idempotencyKey: `reservation:${reservationId}:v${reservation.version}:${type}:email`,
      }),
    );
  }
  if (env.WHATSAPP_DELIVERY_ENABLED && reservation.whatsappConsentAt) {
    jobs.push(
      enqueue({
        reservationId,
        channel: 'whatsapp',
        type,
        recipient: reservation.customer.phone,
        idempotencyKey: `reservation:${reservationId}:v${reservation.version}:${type}:whatsapp`,
      }),
    );
  }
  await Promise.all(jobs);
};

export const queueReservationRescheduledNotification = async (reservationId: string) => {
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { customer: true } });
  if (!reservation) return;
  const type = 'booking_rescheduled_customer';
  const jobs: Array<Promise<unknown>> = [];
  if (reservation.customer.email) {
    jobs.push(
      enqueue({
        reservationId,
        channel: 'email',
        type,
        recipient: reservation.customer.email,
        idempotencyKey: `reservation:${reservationId}:v${reservation.version}:${type}:email`,
      }),
    );
  }
  if (env.WHATSAPP_DELIVERY_ENABLED && reservation.whatsappConsentAt) {
    jobs.push(
      enqueue({
        reservationId,
        channel: 'whatsapp',
        type,
        recipient: reservation.customer.phone,
        idempotencyKey: `reservation:${reservationId}:v${reservation.version}:${type}:whatsapp`,
      }),
    );
  }
  await Promise.all(jobs);
};

export const queuePaymentVerifiedNotification = async (reservationId: string) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { customer: true, payments: { where: { status: PaymentStatus.VERIFIED }, orderBy: { updatedAt: 'desc' }, take: 1 } },
  });
  const payment = reservation?.payments[0];
  if (!reservation || !payment) return;
  const jobs: Array<Promise<unknown>> = [];
  if (reservation.customer.email) {
    jobs.push(
      enqueue({
        reservationId,
        channel: 'email',
        type: 'payment_verified_customer',
        recipient: reservation.customer.email,
        idempotencyKey: `payment:${payment.id}:v${payment.version}:verified:email`,
      }),
    );
  }
  if (env.WHATSAPP_DELIVERY_ENABLED && reservation.whatsappConsentAt) {
    jobs.push(
      enqueue({
        reservationId,
        channel: 'whatsapp',
        type: 'payment_verified_customer',
        recipient: reservation.customer.phone,
        idempotencyKey: `payment:${payment.id}:v${payment.version}:verified:whatsapp`,
      }),
    );
  }
  await Promise.all(jobs);
};

export const queueLeadCreatedNotification = async (leadId: string) => {
  await enqueue({
    leadId,
    channel: 'email',
    type: 'lead_created_admin',
    recipient: env.ADMIN_NOTIFICATION_EMAIL,
    idempotencyKey: `lead:${leadId}:created:email:admin`,
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
    const providerStatus = status.status.slice(0, 50);
    await prisma.notificationEvent.updateMany({
      where: { channel: 'whatsapp', providerMessageId: status.id },
      data: {
        providerStatus,
        lastWebhookAt: now,
        ...(providerStatus === 'delivered' || providerStatus === 'read' ? { deliveredAt: now } : {}),
        ...(providerStatus === 'failed' ? { status: NotificationStatus.FAILED, error: 'WHATSAPP_PROVIDER_FAILED' } : {}),
      },
    });
  }
};
