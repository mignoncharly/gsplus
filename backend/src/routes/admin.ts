import { Router } from 'express';
import type { ZodType } from 'zod';

import { HttpError, notFound } from '../errors/http-error.js';
import {
  queuePaymentVerifiedNotification,
  queueReservationRescheduledNotification,
  queueReservationStatusNotification,
  resolveNotificationEvent,
  retryNotificationEvent,
} from '../emails/notifications.js';
import { PaymentStatus, ReservationStatus } from '../generated/prisma/enums.js';
import { requireAdmin } from '../middleware/admin-auth.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { mediaUpload } from '../middleware/media-upload.js';
import { adminLoginRateLimiter } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import { prisma } from '../db/prisma.js';
import {
  clearAdminSessionCookie,
  getAdminFromRequest,
  publicAdminUser,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from '../services/admin-auth.js';
import { syncReservationToCalendar } from '../services/calendar.js';
import { deleteMediaFiles, processUploadedMedia } from '../services/media.js';
import { rescheduleReservation } from '../services/reservation-rescheduling.js';
import {
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  updateAvailabilityBlock,
} from '../services/availability-blocks.js';
import {
  createPackageWithVersion,
  deleteUnreferencedPackage,
  duplicatePackageWithVersion,
  updatePackageWithVersion,
} from '../services/packages.js';
import { transitionPaymentStatus, transitionReservationStatus } from '../services/status-transitions.js';
import { normalizePaymentReference } from '../utils/payment-reference.js';
import {
  adminLoginSchema,
  availabilityBlockCreateSchema,
  availabilityBlockUpdateSchema,
  idParamsSchema,
  leadUpdateSchema,
  listQuerySchema,
  mediaUpdateSchema,
  mediaUploadSchema,
  mediaUploadFieldsSchema,
  notificationResolutionSchema,
  packageCreateSchema,
  packageDuplicateSchema,
  packageUpdateSchema,
  paymentVerificationSchema,
  reservationIdParamsSchema,
  reservationRescheduleSchema,
  reservationStatusUpdateSchema,
} from '../validation/schemas.js';

const router = Router();

const routeParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value ?? '';
};

const writeAuditLog = async (
  adminUserId: string | undefined,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: unknown,
) => {
  await prisma.auditLog.create({
    data: {
      adminUserId,
      action,
      entityType,
      entityId,
      metadata: metadata === undefined ? undefined : (metadata as object),
    },
  });
};

const checkboxBoolean = (value: unknown, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  return value === true || value === 'true' || value === '1' || value === 'on';
};

const parseMediaPayload = <T>(schema: ZodType<T>, value: unknown) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Request validation failed',
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    );
  }

  return result.data;
};

router.post(
  '/login',
  adminLoginRateLimiter,
  validate('body', adminLoginSchema),
  asyncHandler(async (req, res) => {
    const admin = await verifyAdminCredentials(req.body.email, req.body.password);
    setAdminSessionCookie(res, admin);
    res.json({ data: publicAdminUser(admin) });
  }),
);


router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    try {
      const admin = await getAdminFromRequest(req);
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { sessionVersion: { increment: 1 } },
      });
      await writeAuditLog(admin.id, 'admin.logout', 'AdminUser', admin.id);
    } finally {
      clearAdminSessionCookie(res);
    }
    res.status(204).send();
  }),
);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const admin = await getAdminFromRequest(req);
    res.json({ data: publicAdminUser(admin) });
  }),
);

router.use(requireAdmin);

router.get(
  '/reservations',
  validate('query', listQuerySchema),
  asyncHandler(async (req, res) => {
    const query = res.locals.validated.query;
    const reservations = await prisma.reservation.findMany({
      take: query.limit,
      skip: query.offset,
      orderBy: { startAt: 'desc' },
      include: {
        customer: true,
        package: true,
        packageVersion: true,
        payments: true,
        transitions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { adminUser: { select: { id: true, name: true } } },
        },
        calendarSyncLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    res.json({ data: reservations });
  }),
);

router.get(
  '/reservations/:id',
  validate('params', idParamsSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        customer: true,
        package: true,
        packageVersion: true,
        payments: {
          include: {
            transitions: {
              orderBy: { createdAt: 'desc' },
              include: { adminUser: { select: { id: true, name: true } } },
            },
          },
        },
        transitions: {
          orderBy: { createdAt: 'desc' },
          include: { adminUser: { select: { id: true, name: true } } },
        },
        notifications: true,
        calendarSyncLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!reservation) {
      throw notFound('Reservation not found');
    }

    res.json({ data: reservation });
  }),
);

router.patch(
  '/reservations/:id',
  validate('params', idParamsSchema),
  validate('body', reservationStatusUpdateSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const adminUserId = res.locals.admin?.id;
    const reservation = await prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findUnique({ where: { id } });
      if (!current) {
        throw notFound('Reservation not found');
      }

      let updated =
        req.body.status && req.body.status !== current.status
          ? await transitionReservationStatus(tx, id, {
              toStatus: req.body.status,
              reason: req.body.reason,
              adminUserId,
              actorType: 'ADMIN',
            })
          : current;

      if (req.body.notes !== undefined) {
        updated = await tx.reservation.update({
          where: { id },
          data: { notes: req.body.notes },
        });
      }

      return updated;
    });

    await writeAuditLog(adminUserId, 'reservation.update', 'Reservation', reservation.id, {
      status: req.body.status,
      reason: req.body.reason,
      notesChanged: req.body.notes !== undefined,
    });

    let calendarSync = null;
    if (
      reservation.status === ReservationStatus.CONFIRMED ||
      reservation.status === ReservationStatus.CANCELLED ||
      reservation.status === ReservationStatus.REJECTED
    ) {
      await queueReservationStatusNotification(reservation.id, reservation.status);
    }
    if (reservation.status === ReservationStatus.CONFIRMED || reservation.status === ReservationStatus.CANCELLED) {
      calendarSync = await syncReservationToCalendar(reservation.id);
    }

    res.json({ data: { ...reservation, calendarSync } });
  }),
);

router.patch(
  '/reservations/:id/reschedule',
  validate('params', idParamsSchema),
  validate('body', reservationRescheduleSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const adminUserId = res.locals.admin?.id;
    const reservation = await rescheduleReservation(id, {
      startAt: req.body.startAt,
      reason: req.body.reason,
      adminUserId,
    });
    const transition = await prisma.reservationTransition.findFirst({
      where: { reservationId: id },
      orderBy: { createdAt: 'desc' },
    });
    await writeAuditLog(adminUserId, 'reservation.reschedule', 'Reservation', id, {
      reason: req.body.reason,
      oldStartAt: transition?.oldStartAt,
      oldEndAt: transition?.oldEndAt,
      newStartAt: reservation.startAt,
      newEndAt: reservation.endAt,
    });

    await queueReservationRescheduledNotification(id);
    const calendarSync =
      reservation.status === ReservationStatus.CONFIRMED
        ? await syncReservationToCalendar(id)
        : null;
    res.json({ data: { ...reservation, calendarSync } });
  }),
);

router.get(
  '/leads',
  validate('query', listQuerySchema),
  asyncHandler(async (req, res) => {
    const query = res.locals.validated.query;
    const leads = await prisma.lead.findMany({
      take: query.limit,
      skip: query.offset,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: leads });
  }),
);

router.patch(
  '/leads/:id',
  validate('params', idParamsSchema),
  validate('body', leadUpdateSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const lead = await prisma.lead.update({
      where: { id },
      data: req.body,
    });
    await writeAuditLog(res.locals.admin?.id, 'lead.update', 'Lead', lead.id, req.body);

    res.json({ data: lead });
  }),
);

router.get(
  '/packages',
  asyncHandler(async (_req, res) => {
    const packages = await prisma.package.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { reservations: true, reservationIntents: true } } },
    });

    res.json({ data: packages });
  }),
);

router.post(
  '/packages',
  validate('body', packageCreateSchema),
  asyncHandler(async (req, res) => {
    const packageItem = await createPackageWithVersion(req.body, res.locals.admin?.id);
    await writeAuditLog(res.locals.admin?.id, 'package.create', 'Package', packageItem.id, req.body);
    res.status(201).json({ data: packageItem });
  }),
);

router.post(
  '/packages/:id/duplicate',
  validate('params', idParamsSchema),
  validate('body', packageDuplicateSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const packageItem = await duplicatePackageWithVersion(id, req.body, res.locals.admin?.id);
    await writeAuditLog(res.locals.admin?.id, 'package.duplicate', 'Package', packageItem.id, {
      sourcePackageId: id,
      ...req.body,
    });
    res.status(201).json({ data: packageItem });
  }),
);

router.patch(
  '/packages/:id',
  validate('params', idParamsSchema),
  validate('body', packageUpdateSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const packageItem = await updatePackageWithVersion(id, req.body, res.locals.admin?.id);
    await writeAuditLog(res.locals.admin?.id, 'package.update', 'Package', packageItem.id, {
      ...req.body,
      version: packageItem.version,
    });

    res.json({ data: packageItem });
  }),
);

router.delete(
  '/packages/:id',
  validate('params', idParamsSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const packageItem = await deleteUnreferencedPackage(id);
    await writeAuditLog(res.locals.admin?.id, 'package.delete', 'Package', id, {
      slug: packageItem.slug,
      name: packageItem.name,
    });
    res.status(204).send();
  }),
);

router.get(
  '/media',
  asyncHandler(async (_req, res) => {
    const media = await prisma.mediaItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ data: media });
  }),
);

router.post(
  '/media',
  mediaUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (req.file) {
      const fields = parseMediaPayload(mediaUploadFieldsSchema, {
        title: req.body.title,
        altText: req.body.altText,
        category: req.body.category,
        objectPosition: req.body.objectPosition || undefined,
        isFeatured: checkboxBoolean(req.body.isFeatured, false),
        isPublished: checkboxBoolean(req.body.isPublished, true),
        sortOrder: req.body.sortOrder ?? 0,
      });
      const processed = await processUploadedMedia(req.file);

      try {
        const media = await prisma.mediaItem.create({
          data: {
            ...fields,
            ...processed,
          },
        });
        await writeAuditLog(res.locals.admin?.id, 'media.upload', 'MediaItem', media.id, {
          sourceMimeType: req.file.mimetype,
          sourceSize: req.file.size,
          derivativeMimeType: processed.mimeType,
          derivativeSize: processed.fileSize,
          thumbnailSize: processed.thumbnailFileSize,
        });

        res.status(201).json({ data: media });
        return;
      } catch (error) {
        await deleteMediaFiles(processed);
        throw error;
      }
    }

    const body = parseMediaPayload(mediaUploadSchema, req.body);
    const media = await prisma.mediaItem.create({
      data: body,
    });
    await writeAuditLog(res.locals.admin?.id, 'media.create', 'MediaItem', media.id, body);

    res.status(201).json({ data: media });
  }),
);

router.patch(
  '/media/:id',
  validate('params', idParamsSchema),
  validate('body', mediaUpdateSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const media = await prisma.mediaItem.update({
      where: { id },
      data: req.body,
    });
    await writeAuditLog(res.locals.admin?.id, 'media.update', 'MediaItem', media.id, req.body);

    res.json({ data: media });
  }),
);

router.delete(
  '/media/:id',
  validate('params', idParamsSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const media = await prisma.mediaItem.delete({
      where: { id },
    });
    await deleteMediaFiles(media);
    await writeAuditLog(res.locals.admin?.id, 'media.delete', 'MediaItem', id);

    res.status(204).send();
  }),
);

router.patch(
  '/payments/:id/verify',
  validate('params', idParamsSchema),
  validate('body', paymentVerificationSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const adminUserId = res.locals.admin?.id;
    const transactionRef = req.body.transactionRef?.trim();
    const payment = await prisma.$transaction((tx) =>
      transitionPaymentStatus(tx, id, {
        toStatus: req.body.status,
        reason: req.body.reason,
        adminUserId,
        actorType: 'ADMIN',
        transactionRef,
        transactionRefNormalized:
          transactionRef === undefined ? undefined : normalizePaymentReference(transactionRef),
      }),
    );
    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: payment.reservationId },
    });

    await writeAuditLog(adminUserId, 'payment.verify', 'Payment', payment.id, {
      status: payment.status,
      reason: req.body.reason,
      reservationStatus: reservation.status,
    });

    if (payment.status === PaymentStatus.VERIFIED) {
      await queuePaymentVerifiedNotification(payment.reservationId);
    }

    res.json({ data: { ...payment, reservation, calendarSync: null } });
  }),
);

router.get(
  '/notifications',
  validate('query', listQuerySchema),
  asyncHandler(async (_req, res) => {
    const query = res.locals.validated.query;
    const notifications = await prisma.notificationEvent.findMany({
      take: query.limit,
      skip: query.offset,
      orderBy: { createdAt: 'desc' },
      include: {
        reservation: {
          select: {
            id: true,
            reference: true,
          },
        },
        lead: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    res.json({ data: notifications });
  }),
);

router.patch(
  '/notifications/:id/resolve',
  validate('params', idParamsSchema),
  validate('body', notificationResolutionSchema),
  asyncHandler(async (req, res) => {
    const adminUserId = res.locals.admin?.id;
    if (!adminUserId) throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required.');
    const notification = await resolveNotificationEvent(routeParam(req.params.id), req.body, adminUserId);
    await writeAuditLog(adminUserId, 'notification.resolve', 'NotificationEvent', notification.id, {
      resolution: notification.resolution,
      replacementEventId: notification.replacementEventId,
    });
    res.json({ data: notification });
  }),
);

router.post(
  '/notifications/:id/retry',
  validate('params', idParamsSchema),
  asyncHandler(async (req, res) => {
    const adminUserId = (await getAdminFromRequest(req))?.id;
    const notification = await retryNotificationEvent(routeParam(req.params.id));
    await writeAuditLog(adminUserId, 'notification.retry', 'NotificationEvent', notification.id, {
      channel: notification.channel,
      type: notification.type,
    });
    res.status(202).json({ data: notification });
  }),
);

router.get(
  '/availability-blocks',
  asyncHandler(async (_req, res) => {
    const blocks = await prisma.availabilityBlock.findMany({
      orderBy: { startAt: 'desc' },
      take: 100,
    });

    res.json({ data: blocks });
  }),
);

router.post(
  '/availability-blocks',
  validate('body', availabilityBlockCreateSchema),
  asyncHandler(async (req, res) => {
    const block = await createAvailabilityBlock(req.body);
    await writeAuditLog(res.locals.admin?.id, 'availability_block.create', 'AvailabilityBlock', block.id, req.body);

    res.status(201).json({ data: block });
  }),
);

router.patch(
  '/availability-blocks/:id',
  validate('params', idParamsSchema),
  validate('body', availabilityBlockUpdateSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const block = await updateAvailabilityBlock(id, req.body);
    await writeAuditLog(res.locals.admin?.id, 'availability_block.update', 'AvailabilityBlock', block.id, req.body);

    res.json({ data: block });
  }),
);

router.delete(
  '/availability-blocks/:id',
  validate('params', idParamsSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    await deleteAvailabilityBlock(id);
    await writeAuditLog(res.locals.admin?.id, 'availability_block.delete', 'AvailabilityBlock', id);

    res.status(204).send();
  }),
);

router.post(
  '/calendar/sync/:reservationId',
  validate('params', reservationIdParamsSchema),
  asyncHandler(async (req, res) => {
    const reservationId = routeParam(req.params.reservationId);
    const log = await syncReservationToCalendar(reservationId);
    await writeAuditLog(res.locals.admin?.id, 'calendar.sync', 'Reservation', reservationId, { logId: log.id });

    res.status(200).json({
      data: log,
    });
  }),
);

export default router;
