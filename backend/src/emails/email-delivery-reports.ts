import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';
import { NotificationStatus, Prisma } from '../generated/prisma/client.js';
import { adminReservationUrl } from '../utils/admin-links.js';
import { EMAIL_TEMPLATE_VERSION, renderEmailTemplate } from './templates.js';

export type EmailDeliveryReportStatus = 'DELIVERED' | 'TEMPORARY_FAILURE' | 'PERMANENT_FAILURE';
export type EmailDeliveryReportInput = {
  providerEventId: string;
  providerMessageId: string;
  status: EmailDeliveryReportStatus;
  smtpCode?: string | null;
  providerManagesRetry?: boolean;
  occurredAt: Date;
};

const normalizedSmtpCode = (value: string | null | undefined) => {
  const normalized = value?.trim().replaceAll('.', '_');
  return normalized && /^\d{3}(?:_\d{1,3}){0,2}$/.test(normalized) ? normalized : 'UNKNOWN';
};

const maskEmail = (email: string) => {
  const [local = '', domain = ''] = email.split('@');
  if (!domain) return 'Adresse masquée';
  return `${local.slice(0, 2)}•••@${domain}`;
};

const storedSubject = (renderedContent: Prisma.JsonValue | null) => {
  if (!renderedContent || typeof renderedContent !== 'object' || Array.isArray(renderedContent)) return 'Objet indisponible';
  const subject = (renderedContent as Record<string, unknown>).subject;
  return typeof subject === 'string' ? subject : 'Objet indisponible';
};

const retryAt = (attemptCount: number, occurredAt: Date) =>
  new Date(occurredAt.getTime() + Math.min(3_600_000, 60_000 * 2 ** Math.max(0, attemptCount - 1)));

export const handleEmailDeliveryReport = async (input: EmailDeliveryReportInput) => {
  const existing = await prisma.emailDeliveryReport.findUnique({ where: { providerEventId: input.providerEventId } });
  if (existing) return existing;
  const smtpCode = normalizedSmtpCode(input.smtpCode);
  const failureCode = `SMTP_${smtpCode}`;
  const safeMessage = input.status === 'DELIVERED'
    ? 'Distribution confirmée par le fournisseur.'
    : input.status === 'TEMPORARY_FAILURE'
      ? input.providerManagesRetry
        ? 'Échec temporaire signalé; le fournisseur poursuit ses tentatives de distribution.'
        : 'Échec temporaire signalé par le serveur destinataire; une reprise est planifiée.'
      : 'Rejet permanent signalé par le serveur destinataire.';

  try {
    return await prisma.$transaction(async (tx) => {
      const raced = await tx.emailDeliveryReport.findUnique({ where: { providerEventId: input.providerEventId } });
      if (raced) return raced;
      const event = await tx.notificationEvent.findFirst({
        where: { channel: 'email', providerMessageId: input.providerMessageId },
        include: { reservation: { include: { snapshot: true } } },
      });
      if (!event) throw new HttpError(404, 'EMAIL_NOTIFICATION_NOT_FOUND', 'Notification e-mail introuvable.');
      if (event.status === NotificationStatus.CANCELLED) {
        throw new HttpError(409, 'EMAIL_NOTIFICATION_CANCELLED', 'Une notification annulée ne peut pas recevoir de rapport.');
      }

      const report = await tx.emailDeliveryReport.create({
        data: {
          notificationEventId: event.id,
          providerEventId: input.providerEventId,
          providerMessageId: input.providerMessageId,
          status: input.status,
          smtpCode: smtpCode === 'UNKNOWN' ? null : smtpCode,
          safeMessage,
          occurredAt: input.occurredAt,
        },
      });
      if (event.lastWebhookAt && input.occurredAt < event.lastWebhookAt) {
        return report;
      }

      if (input.status === 'DELIVERED') {
        await tx.notificationEvent.update({
          where: { id: event.id },
          data: {
            status: NotificationStatus.SENT,
            providerStatus: 'delivered',
            deliveredAt: input.occurredAt,
            lastWebhookAt: input.occurredAt,
            nextAttemptAt: null,
            error: null,
          },
        });
        return report;
      }
      if (input.status === 'TEMPORARY_FAILURE' && input.providerManagesRetry) {
        await tx.notificationEvent.update({
          where: { id: event.id },
          data: {
            status: NotificationStatus.SENT,
            providerStatus: 'temporary_failure_provider_retry',
            deliveredAt: null,
            lastWebhookAt: input.occurredAt,
            nextAttemptAt: null,
            error: failureCode,
            lockedAt: null,
          },
        });
        return report;
      }

      if (input.status === 'TEMPORARY_FAILURE' && event.attemptCount < event.maxAttempts) {
        await tx.notificationEvent.update({
          where: { id: event.id },
          data: {
            status: NotificationStatus.PENDING,
            providerStatus: 'temporary_failure',
            deliveredAt: null,
            lastWebhookAt: input.occurredAt,
            nextAttemptAt: retryAt(event.attemptCount, input.occurredAt),
            error: failureCode,
            lockedAt: null,
          },
        });
        return report;
      }

      await tx.notificationEvent.update({
        where: { id: event.id },
        data: {
          status: NotificationStatus.FAILED,
          providerStatus: 'permanent_failure',
          deliveredAt: null,
          lastWebhookAt: input.occurredAt,
          nextAttemptAt: null,
          error: failureCode,
          lockedAt: null,
        },
      });

      const snapshot = event.reservation?.snapshot;
      if (event.templateCode?.startsWith('E-') && event.reservation && snapshot) {
        const rendered = renderEmailTemplate('I-09', {
          reference_courte: event.reservation.reference,
          nom_client: `${snapshot.firstName} ${snapshot.lastName}`,
          email_client_masque: maskEmail(event.recipient),
          id_modele: event.templateCode,
          objet_email: storedSubject(event.renderedContent),
          code_smtp: failureCode,
          message_retour: safeMessage,
          lien_admin_reservation: adminReservationUrl(event.reservation.reference),
        });
        await tx.notificationEvent.upsert({
          where: { idempotencyKey: `notification:${event.id}:I-09:permanent-bounce` },
          update: {},
          create: {
            reservationId: event.reservation.id,
            channel: 'email',
            type: 'email_permanent_bounce_admin',
            recipient: env.ADMIN_NOTIFICATION_EMAIL,
            idempotencyKey: `notification:${event.id}:I-09:permanent-bounce`,
            templateCode: 'I-09',
            templateVersion: EMAIL_TEMPLATE_VERSION,
            renderedContent: rendered as unknown as Prisma.InputJsonValue,
            metadata: {
              templateCode: 'I-09',
              audience: 'ADMIN',
              destinationType: 'SHARED_OPERATIONAL',
              actorType: 'SYSTEM',
              failedNotificationId: event.id,
              emailDeliveryReportId: report.id,
              errorCode: failureCode,
            },
          },
        });
      }
      return report;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.emailDeliveryReport.findUnique({
        where: { providerEventId: input.providerEventId },
      });
      if (raced) return raced;
    }
    throw error;
  }
};

export const isValidEmailDeliverySignature = (rawBody: Buffer, signature: string | undefined) => {
  const secret = env.EMAIL_DELIVERY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const normalized = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  if (!/^[a-f0-9]{64}$/i.test(normalized)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const actual = Buffer.from(normalized, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
