import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';
import {
  type AdminUser,
  type Prisma,
} from '../generated/prisma/client.js';
import { runAdminCommand, type CommandOutcome } from './payment-reservation-commands.js';

const LEGAL_DOCUMENT_TYPES = ['TERMS', 'PRIVACY', 'IMAGE_AUTHORIZATION'] as const;
const FUTURE_CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

export const IMAGE_WITHDRAWAL_EFFECT_NOTICE =
  'Le retrait produit effet pour l’avenir et n’efface ni les preuves antérieures ni les autres données nécessaires au dossier.';

export const resolvePublishedLegalVersions = async (
  tx: Prisma.TransactionClient,
  at = new Date(),
) => {
  const versions = await tx.legalDocumentVersion.findMany({
    where: {
      documentType: { in: [...LEGAL_DOCUMENT_TYPES] },
      status: 'PUBLISHED',
      effectiveAt: { lte: at },
      publishedAt: { lte: at },
    },
    orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }],
  });
  const byType = Object.fromEntries(
    LEGAL_DOCUMENT_TYPES.map((documentType) => [
      documentType,
      versions.find((version) => version.documentType === documentType),
    ]),
  );
  if (!byType.TERMS || !byType.PRIVACY || !byType.IMAGE_AUTHORIZATION) {
    throw new HttpError(503, 'LEGAL_VERSION_UNAVAILABLE', 'Une version juridique publiée est indisponible. Réessayez ultérieurement.');
  }
  return {
    terms: byType.TERMS,
    privacy: byType.PRIVACY,
    imageAuthorization: byType.IMAGE_AUTHORIZATION,
  };
};

type ImageConsentChoice = 'GRANTED' | 'REFUSED' | 'WITHDRAWN';
type ImageConsentEventWithRelations = Prisma.ImageConsentEventGetPayload<{
  include: {
    legalVersion: true;
    recordedBy: { select: { id: true; name: true } };
  };
}>;

export type CreateImageConsentEventInput = {
  reservationId: string;
  commandId: string;
  expectedPriorEventId: string | null;
  choice: ImageConsentChoice;
  receivedAt: Date;
  requestChannel: 'EMAIL' | 'WHATSAPP' | 'PHONE' | 'IN_PERSON' | 'SIGNED_DOCUMENT' | 'OTHER';
  requestEvidence: string;
  admin: AdminUser;
  now?: Date;
};

export const executeCreateImageConsentEvent = async (
  input: CreateImageConsentEventInput,
): Promise<CommandOutcome<{ event: ImageConsentEventWithRelations }>> => {
  const now = input.now ?? new Date();
  const requestEvidence = input.requestEvidence.trim();
  if (input.receivedAt.getTime() > now.getTime() + FUTURE_CLOCK_TOLERANCE_MS) {
    throw new HttpError(400, 'IMAGE_CONSENT_RECEIVED_AT_FUTURE', 'La date du choix ne peut pas être future.');
  }

  return runAdminCommand({
    commandId: input.commandId,
    action: `reservation.image_consent.${input.choice.toLowerCase()}`,
    entityType: 'Reservation',
    entityId: input.reservationId,
    request: {
      expectedPriorEventId: input.expectedPriorEventId,
      choice: input.choice,
      receivedAt: input.receivedAt.toISOString(),
      requestChannel: input.requestChannel,
      requestEvidence,
    },
    admin: input.admin,
    execute: async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: input.reservationId },
        select: { id: true, reference: true, createdAt: true },
      });
      if (!reservation) throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Réservation introuvable.');
      if (input.receivedAt < reservation.createdAt) {
        throw new HttpError(400, 'IMAGE_CONSENT_BEFORE_RESERVATION', 'Le choix ne peut pas précéder la réservation.');
      }
      const current = await tx.imageConsentEvent.findFirst({
        where: { reservationId: reservation.id },
        orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
      });
      if ((current?.id ?? null) !== input.expectedPriorEventId) {
        throw new HttpError(409, 'IMAGE_CONSENT_VERSION_CONFLICT', 'Le choix relatif à l’image a changé. Actualisez le dossier.');
      }
      if (current && input.receivedAt < current.effectiveAt) {
        throw new HttpError(400, 'IMAGE_CONSENT_CHRONOLOGY_INVALID', 'Le nouveau choix ne peut pas précéder le choix actuellement applicable.');
      }
      if (input.choice === 'WITHDRAWN' && current?.choice !== 'GRANTED') {
        throw new HttpError(409, 'IMAGE_CONSENT_NOT_GRANTED', 'Aucune autorisation active ne peut être retirée.');
      }
      if (input.choice === 'REFUSED' && current) {
        throw new HttpError(409, 'IMAGE_CONSENT_REFUSAL_NOT_INITIAL', 'Utilisez le retrait pour mettre fin à une autorisation active.');
      }
      if (input.choice === 'GRANTED' && current?.choice === 'GRANTED') {
        throw new HttpError(409, 'IMAGE_CONSENT_ALREADY_GRANTED', 'L’autorisation est déjà active.');
      }

      const legalVersions = await resolvePublishedLegalVersions(tx, now);
      const legalVersion = legalVersions.imageAuthorization;
      const scope = Array.isArray(legalVersion.scope) ? legalVersion.scope : [];
      if (!legalVersion.purpose || scope.length === 0) {
        throw new HttpError(503, 'IMAGE_AUTHORIZATION_INCOMPLETE', 'La version publiée de l’autorisation est incomplète.');
      }
      const event = await tx.imageConsentEvent.create({
        data: {
          reservationId: reservation.id,
          legalVersionId: legalVersion.id,
          commandId: input.commandId,
          choice: input.choice,
          purpose: legalVersion.purpose,
          scope,
          evidence: {
            requestChannel: input.requestChannel,
            requestEvidence,
            noticeText: legalVersion.noticeText,
            recordedByRole: input.admin.role,
          },
          source: 'ADMIN_RECORDED_CUSTOMER_CHOICE',
          effectiveAt: input.receivedAt,
          priorEventId: current?.id ?? null,
          recordedById: input.admin.id,
        },
        include: {
          legalVersion: true,
          recordedBy: { select: { id: true, name: true } },
        },
      });
      const affectedMedia = input.choice === 'WITHDRAWN'
        ? await tx.mediaConsentUsage.findMany({
            where: { withdrawalEventId: event.id },
            select: {
              mediaItem: {
                select: { id: true, title: true, url: true },
              },
            },
          })
        : [];
      if (affectedMedia.length > 0) {
        await tx.mediaItem.updateMany({
          where: { id: { in: affectedMedia.map(({ mediaItem }) => mediaItem.id) } },
          data: { isPublished: false, isFeatured: false, unpublishedAt: now },
        });
      }
      await tx.auditLog.create({
        data: {
          adminUserId: input.admin.id,
          action: `reservation.image_consent.${input.choice.toLowerCase()}`,
          entityType: 'ImageConsentEvent',
          entityId: event.id,
          metadata: {
            commandId: input.commandId,
            reservationId: reservation.id,
            reservationReference: reservation.reference,
            choice: input.choice,
            priorEventId: current?.id ?? null,
            legalVersion: legalVersion.version,
            purpose: legalVersion.purpose,
            scope,
            effectiveAt: input.receivedAt,
            prospectiveOnly: input.choice === 'WITHDRAWN',
            snapshotMutated: false,
            affectedMedia: affectedMedia.map(({ mediaItem }) => mediaItem),
            result: 'SUCCESS',
          },
        },
      });
      return { event };
    },
    loadReplay: async () => ({
      event: await prisma.imageConsentEvent.findUniqueOrThrow({
        where: { commandId: input.commandId },
        include: {
          legalVersion: true,
          recordedBy: { select: { id: true, name: true } },
        },
      }),
    }),
  });
};
