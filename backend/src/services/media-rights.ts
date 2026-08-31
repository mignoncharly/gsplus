import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';
import type { AdminUser, MediaItem, Prisma } from '../generated/prisma/client.js';
import { assertAdminPermission } from './admin-permissions.js';

export const MEDIA_RIGHTS_BASES = {
  catalog: 'OWNER_APPROVED_CATALOG',
  customer: 'CUSTOMER_IMAGE_AUTHORIZATION',
} as const;

const WEBSITE_SCOPE = 'WEBSITE';

export const adminMediaInclude = {
  reservation: {
    select: {
      id: true,
      reference: true,
    },
  },
  consentUsages: {
    orderBy: { activatedAt: 'desc' as const },
    include: {
      grantEvent: {
        select: {
          id: true,
          choice: true,
          effectiveAt: true,
          purpose: true,
          scope: true,
          legalVersion: { select: { version: true } },
        },
      },
      withdrawalEvent: {
        select: {
          id: true,
          choice: true,
          effectiveAt: true,
        },
      },
      publishedBy: { select: { id: true, name: true } },
    },
  },
  versions: { orderBy: { version: 'desc' as const } },
} satisfies Prisma.MediaItemInclude;

export const publicMediaRightsWhere: Prisma.MediaItemWhereInput = {
  isArchived: false,
  OR: [
    { rightsBasis: MEDIA_RIGHTS_BASES.catalog },
    {
      rightsBasis: MEDIA_RIGHTS_BASES.customer,
      consentUsages: { some: { status: 'ACTIVE' } },
    },
  ],
};

type MediaCreateData = Omit<
  Prisma.MediaItemUncheckedCreateInput,
  | 'id'
  | 'reservationId'
  | 'rightsBasis'
  | 'rightsEvidence'
  | 'publishedAt'
  | 'unpublishedAt'
  | 'isPublished'
  | 'createdAt'
  | 'updatedAt'
>;

type MediaUpdateData = Omit<
  Prisma.MediaItemUncheckedUpdateInput,
  | 'reservationId'
  | 'rightsBasis'
  | 'rightsEvidence'
  | 'publishedAt'
  | 'unpublishedAt'
  | 'isPublished'
  | 'createdAt'
  | 'updatedAt'
>;

const reservationForReference = async (
  tx: Prisma.TransactionClient,
  reservationReference: string,
) => {
  const reference = reservationReference.trim().toUpperCase();
  const reservation = await tx.reservation.findUnique({
    where: { reference },
    select: { id: true, reference: true },
  });
  if (!reservation) {
    throw new HttpError(
      404,
      'MEDIA_RESERVATION_NOT_FOUND',
      'La référence de réservation associée au média est introuvable.',
    );
  }
  return reservation;
};

const publishMediaInTransaction = async (
  tx: Prisma.TransactionClient,
  mediaId: string,
  admin: AdminUser,
  now: Date,
) => {
  const media = await tx.mediaItem.findUnique({
    where: { id: mediaId },
    include: {
      reservation: true,
      consentUsages: { where: { status: 'ACTIVE' } },
    },
  });
  if (!media) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Média introuvable.');

  if (media.rightsBasis === MEDIA_RIGHTS_BASES.catalog) {
    if (!media.rightsEvidence) {
      throw new HttpError(409, 'MEDIA_RIGHTS_EVIDENCE_REQUIRED', 'La preuve de droits du catalogue est absente.');
    }
  } else {
    if (media.rightsBasis !== MEDIA_RIGHTS_BASES.customer || !media.reservationId) {
      throw new HttpError(
        409,
        'IMAGE_CONSENT_REQUIRED',
        'Une réservation et une autorisation d’image active sont obligatoires avant publication.',
      );
    }

    const currentConsent = await tx.imageConsentEvent.findFirst({
      where: { reservationId: media.reservationId },
      orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
    });
    const scope = Array.isArray(currentConsent?.scope) ? currentConsent.scope : [];
    if (
      currentConsent?.choice !== 'GRANTED'
      || currentConsent.purpose !== 'PORTFOLIO_AND_PROMOTION'
      || !scope.includes(WEBSITE_SCOPE)
    ) {
      throw new HttpError(
        409,
        'IMAGE_CONSENT_REQUIRED',
        'L’autorisation d’image active doit couvrir le portfolio du site avant publication.',
      );
    }

    await tx.mediaConsentUsage.upsert({
      where: {
        mediaItemId_grantEventId: {
          mediaItemId: media.id,
          grantEventId: currentConsent.id,
        },
      },
      create: {
        mediaItemId: media.id,
        reservationId: media.reservationId,
        grantEventId: currentConsent.id,
        status: 'ACTIVE',
        purpose: currentConsent.purpose,
        scope,
        activatedAt: now,
        publishedById: admin.id,
      },
      update: {
        status: 'ACTIVE',
        withdrawalEventId: null,
        deactivatedAt: null,
        activatedAt: now,
        publishedById: admin.id,
      },
    });
  }

  const published = await tx.mediaItem.update({
    where: { id: media.id },
    data: {
      isPublished: true,
      publishedAt: now,
      unpublishedAt: null,
    },
  });
  await tx.auditLog.create({
    data: {
      adminUserId: admin.id,
      action: 'media.rights_publish',
      entityType: 'MediaItem',
      entityId: media.id,
      metadata: {
        rightsBasis: media.rightsBasis,
        reservationId: media.reservationId,
        mediaUrl: media.url,
        publishedAt: now,
      },
    },
  });
  return published;
};

const unpublishMediaInTransaction = async (
  tx: Prisma.TransactionClient,
  media: MediaItem,
  admin: AdminUser,
  now: Date,
) => {
  await tx.mediaConsentUsage.updateMany({
    where: { mediaItemId: media.id, status: 'ACTIVE' },
    data: { status: 'UNPUBLISHED', deactivatedAt: now },
  });
  const unpublished = await tx.mediaItem.update({
    where: { id: media.id },
    data: {
      isPublished: false,
      isFeatured: false,
      unpublishedAt: now,
    },
  });
  await tx.auditLog.create({
    data: {
      adminUserId: admin.id,
      action: 'media.rights_unpublish',
      entityType: 'MediaItem',
      entityId: media.id,
      metadata: {
        rightsBasis: media.rightsBasis,
        reservationId: media.reservationId,
        mediaUrl: media.url,
        unpublishedAt: now,
      },
    },
  });
  return unpublished;
};
export const listAdminMedia = () => prisma.mediaItem.findMany({
  orderBy: [{ isArchived: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
  include: adminMediaInclude,
});

/** Rewrite the visible portfolio order from an explicit sequence. */
export const reorderMedia = async (orderedIds: string[]) => {
  const existing = await prisma.mediaItem.findMany({ where: { isArchived: false }, select: { id: true } });
  const known = new Set(existing.map((item) => item.id));
  const unknown = orderedIds.filter((id) => !known.has(id));
  if (unknown.length > 0) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Un média de cet ordre est introuvable ou archivé.', { ids: unknown });
  if (orderedIds.length !== known.size || new Set(orderedIds).size !== orderedIds.length) {
    throw new HttpError(422, 'MEDIA_ORDER_INCOMPLETE', 'L’ordre doit lister chaque média actif une seule fois.');
  }
  await prisma.$transaction(orderedIds.map((id, index) => prisma.mediaItem.update({ where: { id }, data: { sortOrder: (index + 1) * 10 } })));
  return listAdminMedia();
};

export const createMediaWithRights = async ({
  data,
  reservationReference,
  requestedPublished,
  admin,
  now = new Date(),
}: {
  data: MediaCreateData;
  reservationReference: string;
  requestedPublished: boolean;
  admin: AdminUser | undefined;
  now?: Date;
}) => {
  assertAdminPermission(admin, 'MEDIA_RIGHTS_MANAGE');
  return prisma.$transaction(async (tx) => {
    const reservation = await reservationForReference(tx, reservationReference);
    const created = await tx.mediaItem.create({
      data: {
        ...data,
        isPublished: false,
        rightsBasis: MEDIA_RIGHTS_BASES.customer,
        reservationId: reservation.id,
      },
    });
    await tx.auditLog.create({
      data: {
        adminUserId: admin!.id,
        action: 'media.rights_create',
        entityType: 'MediaItem',
        entityId: created.id,
        metadata: {
          rightsBasis: MEDIA_RIGHTS_BASES.customer,
          reservationId: reservation.id,
          reservationReference: reservation.reference,
          mediaUrl: created.url,
        },
      },
    });
    if (requestedPublished) {
      await publishMediaInTransaction(tx, created.id, admin!, now);
    }
    return tx.mediaItem.findUniqueOrThrow({
      where: { id: created.id },
      include: adminMediaInclude,
    });
  });
};

export const updateMediaWithRights = async ({
  mediaId,
  data,
  requestedPublished,
  admin,
  now = new Date(),
}: {
  mediaId: string;
  data: MediaUpdateData;
  requestedPublished?: boolean;
  admin: AdminUser | undefined;
  now?: Date;
}) => {
  assertAdminPermission(admin, 'MEDIA_RIGHTS_MANAGE');
  return prisma.$transaction(async (tx) => {
    const existing = await tx.mediaItem.findUnique({ where: { id: mediaId } });
    if (!existing) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Média introuvable.');

    if (Object.keys(data).length > 0) {
      await tx.mediaItem.update({ where: { id: mediaId }, data });
      await tx.auditLog.create({
        data: {
          adminUserId: admin!.id,
          action: 'media.rights_update',
          entityType: 'MediaItem',
          entityId: mediaId,
          metadata: { fields: Object.keys(data) },
        },
      });
    }

    if (requestedPublished === true && !existing.isPublished) {
      await publishMediaInTransaction(tx, mediaId, admin!, now);
    } else if (requestedPublished === false && existing.isPublished) {
      await unpublishMediaInTransaction(tx, existing, admin!, now);
    }

    return tx.mediaItem.findUniqueOrThrow({
      where: { id: mediaId },
      include: adminMediaInclude,
    });
  });
};

export const deleteMediaWithRights = async (
  mediaId: string,
  admin: AdminUser | undefined,
) => {
  assertAdminPermission(admin, 'MEDIA_RIGHTS_MANAGE');
  return prisma.$transaction(async (tx) => {
    const media = await tx.mediaItem.delete({ where: { id: mediaId } });
    await tx.auditLog.create({ data: {
      adminUserId: admin!.id,
      action: 'media.rights_delete',
      entityType: 'MediaItem',
      entityId: media.id,
      metadata: { rightsBasis: media.rightsBasis, reservationId: media.reservationId, mediaUrl: media.url },
    } });
    return media;
  });
};

export const archiveMediaWithRights = async (mediaId: string, admin: AdminUser | undefined) => {
  assertAdminPermission(admin, 'MEDIA_RIGHTS_MANAGE');
  return prisma.$transaction(async (tx) => {
    const media = await tx.mediaItem.findUnique({ where: { id: mediaId } });
    if (!media) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Média introuvable.');
    const now = new Date();
    if (media.isPublished) await unpublishMediaInTransaction(tx, media, admin!, now);
    const archived = await tx.mediaItem.update({
      where: { id: mediaId },
      data: { isArchived: true, isPublished: false, isFeatured: false, archivedAt: now },
    });
    await tx.auditLog.create({ data: {
      adminUserId: admin!.id,
      action: 'media.archive',
      entityType: 'MediaItem',
      entityId: mediaId,
      metadata: { mediaUrl: media.url, archivedAt: now },
    } });
    return archived;
  });
};

export const replaceMediaFileWithHistory = async (
  mediaId: string,
  file: { url: string; storagePath: string; thumbnailUrl: string; width: number; height: number; mimeType: string; fileSize: number; thumbnailWidth: number; thumbnailHeight: number; thumbnailFileSize: number },
  admin: AdminUser | undefined,
) => {
  assertAdminPermission(admin, 'MEDIA_RIGHTS_MANAGE');
  return prisma.$transaction(async (tx) => {
    const current = await tx.mediaItem.findUnique({ where: { id: mediaId } });
    if (!current) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Média introuvable.');
    const latest = await tx.mediaVersion.findFirst({ where: { mediaItemId: mediaId }, orderBy: { version: 'desc' }, select: { version: true } });
    await tx.mediaVersion.create({ data: {
      mediaItemId: mediaId, version: (latest?.version ?? 0) + 1, url: current.url,
      storagePath: current.storagePath, thumbnailUrl: current.thumbnailUrl, width: current.width, height: current.height,
      mimeType: current.mimeType, fileSize: current.fileSize, thumbnailWidth: current.thumbnailWidth,
      thumbnailHeight: current.thumbnailHeight, thumbnailFileSize: current.thumbnailFileSize, replacedById: admin!.id,
    } });
    await tx.mediaItem.update({ where: { id: mediaId }, data: file });
    await tx.auditLog.create({ data: { adminUserId: admin!.id, action: 'media.file.replace', entityType: 'MediaItem', entityId: mediaId, metadata: { previousUrl: current.url, nextUrl: file.url } } });
    return tx.mediaItem.findUniqueOrThrow({ where: { id: mediaId }, include: adminMediaInclude });
  });
};
