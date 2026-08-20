import { createHmac } from 'node:crypto';

import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';
import type { AdminUser, ReservationNotificationOverride } from '../generated/prisma/client.js';
import { isValidEmailAddress, normalizeEmailAddress } from '../utils/contact-validation.js';
import { assertAdminPermission } from './admin-permissions.js';
import { runAdminCommand, type CommandOutcome } from './payment-reservation-commands.js';

const fingerprint = (email: string) =>
  createHmac('sha256', env.ADMIN_SESSION_SECRET).update(normalizeEmailAddress(email)).digest('hex');

const maskEmail = (email: string) => {
  const normalized = normalizeEmailAddress(email);
  const separator = normalized.lastIndexOf('@');
  if (separator < 1) return '***';
  return `${normalized.slice(0, 1)}***${normalized.slice(Math.max(1, separator - 1), separator)}@${normalized.slice(separator + 1)}`;
};

const isMarkedPost04QaReservation = (reservation: {
  extraInfo: string | null;
  snapshot: { firstName: string; lastName: string; source: string } | null;
}) => Boolean(
  reservation.snapshot &&
  reservation.snapshot.source === 'PUBLIC_BOOKING' &&
  /^POST04-QA-[A-Z0-9-]+$/.test(reservation.snapshot.firstName) &&
  reservation.snapshot.lastName === 'GSPLUS-QA' &&
  reservation.extraInfo?.startsWith('POST-04 '),
);

export const resolveReservationNotificationEmail = async (
  reservationId: string,
  snapshotEmail: string | null,
): Promise<string | null> => {
  const active = await prisma.reservationNotificationOverride.findFirst({
    where: { reservationId, isActive: true },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
  });
  return active?.recipientEmail ?? snapshotEmail;
};

export type QaNotificationOverrideInput = {
  reservationId: string;
  commandId: string;
  expectedReservationVersion: number;
  expectedOverrideVersion: number;
  recipientEmail: string;
  reason: string;
  admin: AdminUser;
  authorizedReservationIds?: readonly string[];
};

export const executeQaNotificationOverride = async (
  input: QaNotificationOverrideInput,
): Promise<CommandOutcome<ReservationNotificationOverride>> => {
  assertAdminPermission(input.admin, 'QA_NOTIFICATION_OVERRIDE');
  const recipientEmail = normalizeEmailAddress(input.recipientEmail);
  const reason = input.reason.trim();
  if (!isValidEmailAddress(recipientEmail)) {
    throw new HttpError(400, 'QA_NOTIFICATION_EMAIL_INVALID', 'L’adresse de notification QA est invalide.');
  }
  const allowlist = input.authorizedReservationIds ?? env.QA_NOTIFICATION_OVERRIDE_RESERVATION_IDS;
  if (!allowlist.includes(input.reservationId)) {
    throw new HttpError(403, 'QA_NOTIFICATION_OVERRIDE_NOT_ALLOWLISTED', 'Cette réservation ne fait pas partie du périmètre QA autorisé.');
  }

  return runAdminCommand({
    commandId: input.commandId,
    action: 'reservation.qa_notification_override.create',
    entityType: 'Reservation',
    entityId: input.reservationId,
    request: {
      expectedReservationVersion: input.expectedReservationVersion,
      expectedOverrideVersion: input.expectedOverrideVersion,
      recipientEmail,
      reason,
    },
    admin: input.admin,
    execute: async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: input.reservationId },
        include: { snapshot: true },
      });
      if (!reservation) throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Réservation introuvable.');
      if (!isMarkedPost04QaReservation(reservation)) {
        throw new HttpError(403, 'QA_RESERVATION_MARKER_REQUIRED', 'La réservation ne porte pas les marqueurs QA POST-04 requis.');
      }
      if (reservation.version !== input.expectedReservationVersion) {
        throw new HttpError(409, 'RESERVATION_VERSION_CONFLICT', 'La réservation a été modifiée. Actualisez le dossier.');
      }
      const current = await tx.reservationNotificationOverride.findFirst({
        where: { reservationId: reservation.id, isActive: true },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      });
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== input.expectedOverrideVersion) {
        throw new HttpError(409, 'QA_NOTIFICATION_OVERRIDE_VERSION_CONFLICT', 'La surcharge de notification a changé. Actualisez le dossier.');
      }
      if (current?.recipientEmail === recipientEmail) {
        throw new HttpError(409, 'QA_NOTIFICATION_OVERRIDE_ALREADY_ACTIVE', 'Cette destination QA est déjà active.');
      }
      const original = current?.recipientEmail ?? reservation.snapshot!.notificationEmail ?? reservation.snapshot!.email;
      if (!original) throw new HttpError(409, 'RESERVATION_NOTIFICATION_EMAIL_MISSING', 'Aucune destination historique n’est disponible.');
      const now = new Date();
      if (current) {
        await tx.reservationNotificationOverride.update({
          where: { id: current.id },
          data: { isActive: false, deactivatedAt: now },
        });
      }
      const created = await tx.reservationNotificationOverride.create({
        data: {
          reservationId: reservation.id,
          version: currentVersion + 1,
          recipientEmail,
          recipientFingerprint: fingerprint(recipientEmail),
          previousRecipientFingerprint: fingerprint(original),
          reason,
          commandId: input.commandId,
          createdById: input.admin.id,
        },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: input.admin.id,
          action: 'reservation.qa_notification_override.create',
          entityType: 'ReservationNotificationOverride',
          entityId: created.id,
          metadata: {
            commandId: input.commandId,
            reservationId: reservation.id,
            reservationVersion: reservation.version,
            overrideVersion: created.version,
            priorRecipientMasked: maskEmail(original),
            newRecipientMasked: maskEmail(recipientEmail),
            priorRecipientFingerprint: created.previousRecipientFingerprint,
            newRecipientFingerprint: created.recipientFingerprint,
            reason,
            scope: 'FUTURE_QA_EMAILS_ONLY',
            result: 'SUCCESS',
          },
        },
      });
      return created;
    },
    loadReplay: () => prisma.reservationNotificationOverride.findUniqueOrThrow({
      where: { commandId: input.commandId },
    }),
  });
};
