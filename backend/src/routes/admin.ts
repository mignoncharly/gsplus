import { Router } from 'express';
import type { ZodType } from 'zod';

import { HttpError, notFound } from '../errors/http-error.js';
import { formatValidationIssues } from '../utils/validation-localization.js';
import {
  queuePaymentAddedNotifications,
  queueCancellationNotifications,
  queueRescheduleRequestDecisionNotification,
  queueRescheduleRequestNotifications,
  queueRefundStatusNotifications,
  queuePaymentStatusNotifications,
  queueReservationRescheduledNotification,
  queueReservationStatusNotification,
  previewCustomerDecisionEmail,
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
  changeAdminPassword,
  getAdminFromRequest,
  publicAdminUser,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from '../services/admin-auth.js';
import { assertAdminPermission } from '../services/admin-permissions.js';
import {
  executeAddPayment,
  executeCancellationDecision,
  executeRefundDecision,
  executePaymentDecision,
  executeReservationDecision,
  executeVerifyAndConfirm,
} from '../services/payment-reservation-commands.js';
import { retryCalendarSync, syncReservationToCalendar } from '../services/calendar.js';
import { recordMissingReservationSnapshot } from '../services/integrity-incidents.js';
import { publishReservationDeliverables } from '../services/reservation-deliveries.js';
import { executeQaNotificationOverride } from '../services/reservation-notification-overrides.js';
import { deleteMediaFiles, processUploadedMedia } from '../services/media.js';
import {
  createMediaWithRights,
  deleteMediaWithRights,
  listAdminMedia,
  updateMediaWithRights,
} from '../services/media-rights.js';
import {
  executeCreateRescheduleRequest,
  executeRescheduleRequestDecision,
} from '../services/reservation-rescheduling.js';
import {
  executeCreateWithdrawalRequest,
  executeWithdrawalRequestDecision,
} from '../services/reservation-withdrawals.js';
import {
  executeCreateImageConsentEvent,
  IMAGE_WITHDRAWAL_EFFECT_NOTICE,
} from '../services/legal-consents.js';
import {
  executeCreateDataRightsRequest,
  executeUpdateDataRightsRequest,
  listDataGovernance,
} from '../services/data-governance.js';
import {
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  updateAvailabilityBlock,
} from '../services/availability-blocks.js';
import {
  archivePublishedPackage,
  createPackageWithVersion,
  deleteUnreferencedPackage,
  duplicatePackageWithVersion,
  listAdminPackages,
  publishPackageVersion,
  updatePackageWithVersion,
  validatePackageVersion,
} from '../services/packages.js';
import { transitionReservationStatus } from '../services/status-transitions.js';
import { resolveCustomerDecisionCopy, type CustomerReasonCode } from '../services/customer-decision-copy.js';
import { normalizePaymentReference } from '../utils/payment-reference.js';
import {
  adminLoginSchema,
  adminPasswordChangeSchema,
  availabilityBlockCreateSchema,
  availabilityBlockUpdateSchema,
  dataRightsRequestCreateSchema,
  dataRightsRequestUpdateSchema,
  customerDecisionPreviewSchema,
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
  packageValidationSchema,
  qaNotificationOverrideSchema,
  packageVersionCommandSchema,
  paymentAddSchema,
  paymentVerificationSchema,
  refundDecisionSchema,
  reservationIdParamsSchema,
  reservationCancellationSchema,
  reservationDeliveryPublishSchema,
  rescheduleRequestCreateSchema,
  rescheduleRequestDecisionSchema,
  withdrawalRequestCreateSchema,
  withdrawalRequestDecisionSchema,
  imageConsentEventCreateSchema,
  reservationStatusUpdateSchema,
  verifyAndConfirmSchema,
} from '../validation/schemas.js';

const router = Router();

const routeParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value ?? '';
};
const TEMPORAL_CLOSURE_STATUSES = new Set<ReservationStatus>([
  ReservationStatus.COMPLETED,
  ReservationStatus.NO_SHOW,
]);

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
      'Corrigez les champs invalides avant de continuer.',
      formatValidationIssues(result.error.issues),
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

router.post(
  '/password',
  validate('body', adminPasswordChangeSchema),
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin!;
    const updatedAdmin = await changeAdminPassword(admin, req.body.currentPassword, req.body.newPassword);
    setAdminSessionCookie(res, updatedAdmin);
    res.json({
      data: publicAdminUser(updatedAdmin),
      message: 'Mot de passe modifié avec succès.',
    });
  }),
);
router.get(
  '/data-governance',
  asyncHandler(async (_req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'DATA_GOVERNANCE_MANAGE');
    res.json({ data: await listDataGovernance() });
  }),
);

router.post(
  '/data-rights-requests',
  validate('body', dataRightsRequestCreateSchema),
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'DATA_GOVERNANCE_MANAGE');
    const outcome = await executeCreateDataRightsRequest({
      commandId: req.body.commandId,
      requestType: req.body.requestType,
      requesterName: req.body.requesterName,
      requesterEmail: req.body.requesterEmail,
      requesterPhone: req.body.requesterPhone,
      reservationReference: req.body.reservationReference,
      requestChannel: req.body.requestChannel,
      requestSummary: req.body.requestSummary,
      identityStatus: req.body.identityStatus,
      identityEvidenceReference: req.body.identityEvidenceReference,
      receivedAt: req.body.receivedAt,
      targetResponseAt: req.body.targetResponseAt,
      admin,
    });
    res.status(201).json({ data: { ...outcome.value, commandId: outcome.commandId, replayed: outcome.replayed } });
  }),
);

router.patch(
  '/data-rights-requests/:id',
  validate('params', idParamsSchema),
  validate('body', dataRightsRequestUpdateSchema),
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'DATA_GOVERNANCE_MANAGE');
    const outcome = await executeUpdateDataRightsRequest({
      requestId: routeParam(req.params.id),
      commandId: req.body.commandId,
      expectedVersion: req.body.expectedVersion,
      status: req.body.status,
      identityStatus: req.body.identityStatus,
      identityEvidenceReference: req.body.identityEvidenceReference,
      processingRestricted: req.body.processingRestricted,
      retentionAction: req.body.retentionAction,
      reason: req.body.reason,
      responseEvidence: req.body.responseEvidence,
      legalHoldUntil: req.body.legalHoldUntil,
      effectiveAt: req.body.effectiveAt,
      admin,
    });
    res.json({ data: { ...outcome.value, commandId: outcome.commandId, replayed: outcome.replayed } });
  }),
);

router.post(
  '/communication-preview',
  validate('body', customerDecisionPreviewSchema),
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    if (req.body.scope.startsWith('PAYMENT_')) assertAdminPermission(admin, 'PAYMENT_DECIDE');
    else if (req.body.scope === 'RESCHEDULE_REJECTION') assertAdminPermission(admin, 'RESERVATION_RESCHEDULE');
    else assertAdminPermission(admin, 'RESERVATION_REJECT');
    const preview = await previewCustomerDecisionEmail(req.body);
    res.json({ data: preview });
  }),
);

router.post(
  '/reservations/:id/cancel',
  validate('params', idParamsSchema),
  validate('body', reservationCancellationSchema),
  asyncHandler(async (req, res) => {
    const reservationId = routeParam(req.params.id);
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'RESERVATION_CANCEL');
    const outcome = await executeCancellationDecision({
      reservationId,
      commandId: req.body.commandId,
      expectedVersion: req.body.expectedVersion,
      origin: req.body.origin,
      internalReason: req.body.internalReason,
      customerReasonCode: req.body.customerReasonCode,
      customerReasonText: req.body.customerReasonText,
      admin,
    });
    if (!outcome.replayed) {
      await queueCancellationNotifications(reservationId, { commandId: outcome.commandId, actor: admin });
    }
    const calendarSync = !outcome.replayed
      ? await syncReservationToCalendar(reservationId)
      : null;
    res.json({
      data: {
        ...outcome.value.reservation,
        financialTask: outcome.value.financialTask,
        commandId: outcome.commandId,
        replayed: outcome.replayed,
        calendarSync,
      },
    });
  }),
);

router.get(
  '/reservations',
  validate('query', listQuerySchema),
  asyncHandler(async (req, res) => {
    const query = res.locals.validated.query;
    const reservations = await prisma.reservation.findMany({
      where: query.reference ? { reference: query.reference } : undefined,
      take: query.limit,
      skip: query.offset,
      orderBy: { startAt: 'desc' },
      include: {
        customer: true,
        snapshot: true,
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
        financialTasks: { orderBy: { createdAt: 'desc' } },
        rescheduleRequests: { orderBy: { createdAt: 'desc' }, take: 5 },
        withdrawalRequests: { orderBy: { createdAt: 'desc' }, take: 5 },
        imageConsentEvents: {
          orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
          take: 10,
          include: { legalVersion: true, recordedBy: { select: { id: true, name: true } } },
        },
      },
    });

    await Promise.all(
      reservations
        .filter((reservation) => !reservation.snapshot)
        .map((reservation) => recordMissingReservationSnapshot(reservation.id, 'admin_reservation_list')),
    );

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
        snapshot: true,
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
        notifications: {
          include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
        },
        calendarSyncLogs: {
          orderBy: { createdAt: 'desc' },
        },
        financialTasks: {
          orderBy: { createdAt: 'desc' },
          include: { createdBy: { select: { id: true, name: true } } },
        },
        deliveries: {
          orderBy: { createdAt: 'desc' },
          include: { publishedBy: { select: { id: true, name: true } } },
        },
        rescheduleRequests: {
          orderBy: { createdAt: 'desc' },
          include: {
            requestedBy: { select: { id: true, name: true } },
            decidedBy: { select: { id: true, name: true } },
          },
        },
        withdrawalRequests: {
          orderBy: { createdAt: 'desc' },
          include: {
            requestedBy: { select: { id: true, name: true } },
            decidedBy: { select: { id: true, name: true } },
          },
        },
        imageConsentEvents: {
          orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
          include: {
            legalVersion: true,
            recordedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!reservation) {
      throw notFound('Reservation not found');
    }

    if (!reservation.snapshot) {
      await recordMissingReservationSnapshot(reservation.id, 'admin_reservation_detail');
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
    const admin = res.locals.admin;
    const adminUserId = admin?.id;
    let replayed = false;
    let commandId: string | undefined;
    let reservation;

    if (
      req.body.status === ReservationStatus.CONFIRMED ||
      req.body.status === ReservationStatus.REJECTED
    ) {
      assertAdminPermission(
        admin,
        req.body.status === ReservationStatus.CONFIRMED
          ? 'RESERVATION_CONFIRM'
          : 'RESERVATION_REJECT',
      );
      const outcome = await executeReservationDecision({
        reservationId: id,
        commandId: req.body.commandId,
        expectedVersion: req.body.expectedVersion,
        status: req.body.status,
        reason: req.body.reason,
        internalReason: req.body.internalReason,
        customerReasonCode: req.body.customerReasonCode,
        customerReasonText: req.body.customerReasonText,
        admin,
      });
      reservation = outcome.value;
      replayed = outcome.replayed;
      commandId = outcome.commandId;
      if (req.body.notes !== undefined && !replayed) {
        reservation = await prisma.reservation.update({
          where: { id },
          data: { notes: req.body.notes },
        });
      }
    } else {
      const temporalClosure = req.body.status && TEMPORAL_CLOSURE_STATUSES.has(req.body.status);
      if (temporalClosure) {
        assertAdminPermission(admin, 'RESERVATION_CLOSE');
        if (req.body.temporalOverride) {
          assertAdminPermission(admin, 'RESERVATION_EARLY_CLOSE_OVERRIDE');
        }
      }

      const outcome = await prisma.$transaction(async (tx) => {
        const current = await tx.reservation.findUnique({ where: { id }, include: { snapshot: true } });
        if (!current) throw notFound('Reservation not found');
        const customerCopy = req.body.status === ReservationStatus.EXPIRED
          ? resolveCustomerDecisionCopy('RESERVATION_EXPIRATION', current.snapshot?.locale, { internalReason: req.body.internalReason, customerReasonCode: req.body.customerReasonCode as CustomerReasonCode, customerReasonText: req.body.customerReasonText })
          : undefined;
        let updated =
          req.body.status && req.body.status !== current.status
            ? await transitionReservationStatus(tx, id, {
                toStatus: req.body.status,
                expectedVersion: req.body.expectedVersion,
                reason: customerCopy?.internalReason ?? req.body.reason,
                customerCopy,
                adminUserId,
                actorType: 'ADMIN',
                temporalOverride: req.body.temporalOverride,
                overrideConfirmed: req.body.overrideConfirmed,
              })
            : current;
        if (req.body.notes !== undefined) {
          updated = await tx.reservation.update({
            where: { id },
            data: { notes: req.body.notes },
          });
        }
        return { reservation: updated, previousStatus: current.status };
      });
      reservation = outcome.reservation;
      const transition = req.body.status && req.body.status !== outcome.previousStatus
        ? await prisma.reservationTransition.findFirst({
            where: {
              reservationId: reservation.id,
              fromStatus: outcome.previousStatus,
              toStatus: req.body.status,
            },
            orderBy: { createdAt: 'desc' },
          })
        : null;
      await writeAuditLog(
        adminUserId,
        req.body.temporalOverride ? 'reservation.early_close_override' : 'reservation.update',
        'Reservation',
        reservation.id,
        {
          oldStatus: outcome.previousStatus,
          newStatus: reservation.status,
          reason: req.body.reason,
          notesChanged: req.body.notes !== undefined,
          endAt: reservation.endAt,
          changedAt: transition?.createdAt ?? reservation.statusChangedAt,
          temporalOverride: transition?.metadata ?? null,
        },
      );
    }

    let calendarSync = null;
    if (
      !replayed &&
      (reservation.status === ReservationStatus.CONFIRMED ||
        reservation.status === ReservationStatus.CANCELLED ||
        reservation.status === ReservationStatus.REJECTED ||
        reservation.status === ReservationStatus.EXPIRED ||
        reservation.status === ReservationStatus.COMPLETED ||
        reservation.status === ReservationStatus.NO_SHOW)
    ) {
      await queueReservationStatusNotification(reservation.id, reservation.status, { commandId, actor: admin });
    }
    if (
      !replayed &&
      (reservation.status === ReservationStatus.CONFIRMED || reservation.status === ReservationStatus.CANCELLED)
    ) {
      calendarSync = await syncReservationToCalendar(reservation.id);
    }

    res.json({ data: { ...reservation, commandId, replayed, calendarSync } });
  }),
);

router.post(
  '/reservations/:id/deliveries',
  validate('params', idParamsSchema),
  validate('body', reservationDeliveryPublishSchema),
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'DELIVERY_PUBLISH');
    const outcome = await publishReservationDeliverables({
      reservationId: routeParam(req.params.id),
      commandId: req.body.commandId,
      expectedReservationVersion: req.body.expectedReservationVersion,
      deliveryUrl: req.body.deliveryUrl,
      accessInstruction: req.body.accessInstruction,
      expiresAt: req.body.expiresAt,
      admin,
    });
    res.status(outcome.replayed ? 200 : 201).json({
      data: { delivery: outcome.value, commandId: outcome.commandId, replayed: outcome.replayed },
    });
  }),
);

router.post(
  '/reservations/:id/qa-notification-override',
  validate('params', idParamsSchema),
  validate('body', qaNotificationOverrideSchema),
  asyncHandler(async (req, res) => {
    const reservationId = routeParam(req.params.id);
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'QA_NOTIFICATION_OVERRIDE');
    const outcome = await executeQaNotificationOverride({
      reservationId,
      commandId: req.body.commandId,
      expectedReservationVersion: req.body.expectedReservationVersion,
      expectedOverrideVersion: req.body.expectedOverrideVersion,
      recipientEmail: req.body.recipientEmail,
      reason: req.body.reason,
      admin,
    });
    res.status(outcome.replayed ? 200 : 201).json({
      data: { override: outcome.value, commandId: outcome.commandId, replayed: outcome.replayed },
    });
  }),
);

router.post(
  '/reservations/:id/verify-and-confirm',
  validate('params', idParamsSchema),
  validate('body', verifyAndConfirmSchema),
  asyncHandler(async (req, res) => {
    const reservationId = routeParam(req.params.id);
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'VERIFY_AND_CONFIRM');
    const transactionRef = req.body.transactionRef?.trim();
    const outcome = await executeVerifyAndConfirm({
      reservationId,
      paymentId: req.body.paymentId,
      commandId: req.body.commandId,
      expectedPaymentVersion: req.body.expectedPaymentVersion,
      expectedReservationVersion: req.body.expectedReservationVersion,
      reason: req.body.reason,
      transactionRef,
      transactionRefNormalized:
        transactionRef === undefined ? undefined : normalizePaymentReference(transactionRef),
      admin,
    });

    let calendarSync = null;
    if (!outcome.replayed) {
      await queueReservationStatusNotification(reservationId, ReservationStatus.CONFIRMED, {
        commandId: outcome.commandId,
        actor: admin,
      });
      calendarSync = await syncReservationToCalendar(reservationId);
    }
    res.json({
      data: {
        commandId: outcome.commandId,
        replayed: outcome.replayed,
        payment: outcome.value.payment,
        reservation: outcome.value.reservation,
        calendarSync,
      },
    });
  }),
);

router.post(
  '/reservations/:id/reschedule-requests',
  validate('params', idParamsSchema),
  validate('body', rescheduleRequestCreateSchema),
  asyncHandler(async (req, res) => {
    const reservationId = routeParam(req.params.id);
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'RESERVATION_RESCHEDULE');
    const outcome = await executeCreateRescheduleRequest({
      reservationId,
      commandId: req.body.commandId,
      expectedReservationVersion: req.body.expectedReservationVersion,
      requestedStartAt: req.body.requestedStartAt,
      reason: req.body.reason,
      admin,
    });
    if (!outcome.replayed) {
      await queueRescheduleRequestNotifications(outcome.value.request.id, {
        commandId: outcome.commandId,
        actor: admin,
      });
    }
    res.status(201).json({
      data: {
        request: outcome.value.request,
        reservation: outcome.value.reservation,
        commandId: outcome.commandId,
        replayed: outcome.replayed,
      },
    });
  }),
);

router.patch(
  '/reschedule-requests/:id/decision',
  validate('params', idParamsSchema),
  validate('body', rescheduleRequestDecisionSchema),
  asyncHandler(async (req, res) => {
    const requestId = routeParam(req.params.id);
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'RESERVATION_RESCHEDULE');
    const outcome = await executeRescheduleRequestDecision({
      requestId,
      commandId: req.body.commandId,
      expectedVersion: req.body.expectedVersion,
      decision: req.body.decision,
      internalReason: req.body.internalReason,
      customerReasonCode: req.body.customerReasonCode,
      customerReasonText: req.body.customerReasonText,
      admin,
    });
    let calendarSync = null;
    if (!outcome.replayed) {
      await queueRescheduleRequestDecisionNotification(requestId, { commandId: outcome.commandId });
      if (
        outcome.value.request.status === 'ACCEPTED' &&
        outcome.value.reservation.status === ReservationStatus.CONFIRMED
      ) {
        calendarSync = await syncReservationToCalendar(outcome.value.reservation.id);
      }
    }
    res.json({
      data: {
        request: outcome.value.request,
        reservation: outcome.value.reservation,
        commandId: outcome.commandId,
        replayed: outcome.replayed,
        calendarSync,
      },
    });
  }),
);

router.post(
  '/reservations/:id/withdrawal-requests',
  validate('params', idParamsSchema),
  validate('body', withdrawalRequestCreateSchema),
  asyncHandler(async (req, res) => {
    const reservationId = routeParam(req.params.id);
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'WITHDRAWAL_MANAGE');
    const outcome = await executeCreateWithdrawalRequest({
      reservationId,
      commandId: req.body.commandId,
      expectedReservationVersion: req.body.expectedReservationVersion,
      receivedAt: req.body.receivedAt,
      requestChannel: req.body.requestChannel,
      requestText: req.body.requestText,
      requestEvidence: req.body.requestEvidence,
      serviceStatus: req.body.serviceStatus,
      executionStartedAt: req.body.executionStartedAt,
      admin,
    });
    res.status(201).json({
      data: {
        request: outcome.value.request,
        reservation: outcome.value.reservation,
        commandId: outcome.commandId,
        replayed: outcome.replayed,
      },
    });
  }),
);

router.patch(
  '/withdrawal-requests/:id/decision',
  validate('params', idParamsSchema),
  validate('body', withdrawalRequestDecisionSchema),
  asyncHandler(async (req, res) => {
    const requestId = routeParam(req.params.id);
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'WITHDRAWAL_MANAGE');
    const outcome = await executeWithdrawalRequestDecision({
      requestId,
      commandId: req.body.commandId,
      expectedVersion: req.body.expectedVersion,
      decision: req.body.decision,
      internalReason: req.body.internalReason,
      customerReasonCode: req.body.customerReasonCode,
      customerReasonText: req.body.customerReasonText,
      admin,
    });
    res.json({
      data: {
        request: outcome.value.request,
        reservation: outcome.value.reservation,
        commandId: outcome.commandId,
        replayed: outcome.replayed,
      },
    });
  }),
);

router.post(
  '/reservations/:id/image-consent-events',
  validate('params', idParamsSchema),
  validate('body', imageConsentEventCreateSchema),
  asyncHandler(async (req, res) => {
    const reservationId = routeParam(req.params.id);
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'IMAGE_CONSENT_MANAGE');
    const outcome = await executeCreateImageConsentEvent({
      reservationId,
      commandId: req.body.commandId,
      expectedPriorEventId: req.body.expectedPriorEventId,
      choice: req.body.choice,
      receivedAt: req.body.receivedAt,
      requestChannel: req.body.requestChannel,
      requestEvidence: req.body.requestEvidence,
      admin,
    });
    res.status(201).json({
      data: {
        event: outcome.value.event,
        commandId: outcome.commandId,
        replayed: outcome.replayed,
        effectNotice: IMAGE_WITHDRAWAL_EFFECT_NOTICE,
      },
    });
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
    const packages = await listAdminPackages();

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


router.post(
  '/packages/:id/validate',
  validate('params', idParamsSchema),
  validate('body', packageValidationSchema),
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'PACKAGE_PUBLISH');
    const id = routeParam(req.params.id);
    const packageItem = await validatePackageVersion(id, req.body, admin!.id);
    await writeAuditLog(admin!.id, 'package.validate', 'Package', id, {
      version: packageItem.version,
      mentionsApproved: true,
      fromStatus: 'DRAFT',
      toStatus: 'VALIDATED',
    });
    res.json({ data: packageItem });
  }),
);

router.post(
  '/packages/:id/publish',
  validate('params', idParamsSchema),
  validate('body', packageVersionCommandSchema),
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'PACKAGE_PUBLISH');
    const id = routeParam(req.params.id);
    const packageItem = await publishPackageVersion(id, req.body.expectedVersion, admin!.id);
    await writeAuditLog(admin!.id, 'package.publish', 'Package', id, {
      version: packageItem.publishedVersion,
      fromStatus: 'VALIDATED',
      toStatus: 'PUBLISHED',
      effectiveAt: packageItem.effectiveAt,
    });
    res.json({ data: packageItem });
  }),
);

router.post(
  '/packages/:id/archive',
  validate('params', idParamsSchema),
  validate('body', packageVersionCommandSchema),
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'PACKAGE_PUBLISH');
    const id = routeParam(req.params.id);
    const packageItem = await archivePublishedPackage(id, req.body.expectedVersion);
    await writeAuditLog(admin!.id, 'package.archive', 'Package', id, {
      version: req.body.expectedVersion,
      fromStatus: 'PUBLISHED',
      toStatus: 'ARCHIVED',
    });
    res.json({ data: packageItem });
  }),
);

router.patch(
  '/packages/:id',
  validate('params', idParamsSchema),
  validate('body', packageUpdateSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const packageItem = await updatePackageWithVersion(id, req.body, res.locals.admin?.id);
    await writeAuditLog(res.locals.admin?.id, 'package.draft.update', 'Package', packageItem.id, {
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
    const media = await listAdminMedia();
    res.json({ data: media });
  }),
);

router.post(
  '/media',
  mediaUpload.single('file'),
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'MEDIA_RIGHTS_MANAGE');

    if (req.file) {
      const fields = parseMediaPayload(mediaUploadFieldsSchema, {
        title: req.body.title,
        altText: req.body.altText,
        category: req.body.category,
        objectPosition: req.body.objectPosition || undefined,
        isFeatured: checkboxBoolean(req.body.isFeatured, false),
        isPublished: checkboxBoolean(req.body.isPublished, false),
        sortOrder: req.body.sortOrder ?? 0,
        reservationReference: req.body.reservationReference,
      });
      const {
        reservationReference,
        isPublished: requestedPublished,
        ...mediaFields
      } = fields;
      const processed = await processUploadedMedia(req.file);

      try {
        const media = await createMediaWithRights({
          data: { ...mediaFields, ...processed },
          reservationReference,
          requestedPublished,
          admin,
        });
        await writeAuditLog(admin?.id, 'media.upload', 'MediaItem', media.id, {
          sourceMimeType: req.file.mimetype,
          sourceSize: req.file.size,
          derivativeMimeType: processed.mimeType,
          derivativeSize: processed.fileSize,
          thumbnailSize: processed.thumbnailFileSize,
          reservationReference,
          requestedPublished,
        });
        res.status(201).json({ data: media });
        return;
      } catch (error) {
        await deleteMediaFiles(processed);
        throw error;
      }
    }

    const body = parseMediaPayload(mediaUploadSchema, req.body);
    const {
      reservationReference,
      isPublished: requestedPublished,
      ...mediaFields
    } = body;
    const media = await createMediaWithRights({
      data: mediaFields,
      reservationReference,
      requestedPublished,
      admin,
    });
    res.status(201).json({ data: media });
  }),
);

router.patch(
  '/media/:id',
  validate('params', idParamsSchema),
  validate('body', mediaUpdateSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const { isPublished: requestedPublished, ...data } = req.body;
    const media = await updateMediaWithRights({
      mediaId: id,
      data,
      requestedPublished,
      admin: res.locals.admin,
    });
    res.json({ data: media });
  }),
);

router.delete(
  '/media/:id',
  validate('params', idParamsSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const media = await deleteMediaWithRights(id, res.locals.admin);
    await deleteMediaFiles(media);
    res.status(204).send();
  }),
);

router.patch(
  '/payments/:id/verify',
  validate('params', idParamsSchema),
  validate('body', paymentVerificationSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'PAYMENT_DECIDE');
    const transactionRef = req.body.transactionRef?.trim();
    const outcome = await executePaymentDecision({
      paymentId: id,
      commandId: req.body.commandId,
      expectedVersion: req.body.expectedVersion,
      status: req.body.status,
      reason: req.body.reason,
      internalReason: req.body.internalReason,
      customerReasonCode: req.body.customerReasonCode,
      customerReasonText: req.body.customerReasonText,
      transactionRef,
      transactionRefNormalized:
        transactionRef === undefined ? undefined : normalizePaymentReference(transactionRef),
      admin,
    });

    if (!outcome.replayed) {
      await queuePaymentStatusNotifications(outcome.value.payment.reservationId, outcome.value.payment.status, {
        commandId: outcome.commandId,
        actor: admin,
      });
    }

    res.json({
      data: {
        ...outcome.value.payment,
        reservation: outcome.value.reservation,
        commandId: outcome.commandId,
        replayed: outcome.replayed,
        calendarSync: null,
      },
    });
  }),
);

router.patch(
  '/payments/:id/refund',
  validate('params', idParamsSchema),
  validate('body', refundDecisionSchema),
  asyncHandler(async (req, res) => {
    const paymentId = routeParam(req.params.id);
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'REFUND_MANAGE');
    const outcome = await executeRefundDecision({
      paymentId,
      commandId: req.body.commandId,
      expectedVersion: req.body.expectedVersion,
      status: req.body.status,
      refundAmount: req.body.refundAmount,
      channel: req.body.channel,
      providerReference: req.body.providerReference,
      reason: req.body.reason,
      admin,
    });

    if (!outcome.replayed) {
      await queueRefundStatusNotifications(paymentId, outcome.value.payment.status);
    }

    res.json({
      data: {
        ...outcome.value.payment,
        reservation: outcome.value.reservation,
        financialTask: outcome.value.financialTask,
        commandId: outcome.commandId,
        replayed: outcome.replayed,
      },
    });
  }),
);

router.post(
  '/reservations/:id/payments',
  validate('params', idParamsSchema),
  validate('body', paymentAddSchema),
  asyncHandler(async (req, res) => {
    const reservationId = routeParam(req.params.id);
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'PAYMENT_ADD');
    const outcome = await executeAddPayment({
      reservationId,
      commandId: req.body.commandId,
      expectedReservationVersion: req.body.expectedReservationVersion,
      method: req.body.method,
      paymentPhone: req.body.paymentPhone,
      transactionRef: req.body.transactionRef,
      admin,
    });
    if (!outcome.replayed) {
      await queuePaymentAddedNotifications(outcome.value.payment.id, {
        commandId: outcome.commandId,
        actor: admin,
      });
    }
    res.status(outcome.replayed ? 200 : 201).json({
      data: {
        payment: outcome.value.payment,
        reservation: outcome.value.reservation,
        commandId: outcome.commandId,
        replayed: outcome.replayed,
      },
    });
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
        attempts: { orderBy: { attemptNumber: 'asc' } },
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
    const log = await retryCalendarSync(reservationId);
    await writeAuditLog(res.locals.admin?.id, 'calendar.sync', 'Reservation', reservationId, { logId: log.id });

    res.status(200).json({
      data: log,
    });
  }),
);

export default router;
