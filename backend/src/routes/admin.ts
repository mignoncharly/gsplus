import { Router, type Response } from 'express';
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
import { Prisma } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { enqueueInternalEmailNotification } from '../emails/internal-notification-policy.js';
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
  recordSignInAttempt,
  setAdminSessionCookie,
  startAdminSession,
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
import { syncStudioScheduleToCalendar } from '../services/calendar-schedule.js';
import { recordMissingReservationSnapshot } from '../services/integrity-incidents.js';
import { publishReservationDeliverables } from '../services/reservation-deliveries.js';
import { executeQaNotificationOverride } from '../services/reservation-notification-overrides.js';
import { deleteMediaFiles, processUploadedMedia } from '../services/media.js';
import {
  createMediaWithRights,
  archiveMediaWithRights,
  deleteMediaWithRights,
  listAdminMedia,
  reorderMedia,
  replaceMediaFileWithHistory,
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
  reorderPackages,
  updatePackageWithVersion,
  validatePackageVersion,
} from '../services/packages.js';
import { createCatalogueBenefitDraft, listAdminCatalogueBenefits, publishCatalogueBenefitVersion, updateCatalogueBenefitDraft, updateCatalogueTaxonomy, validateCatalogueBenefitVersion } from '../services/catalogue.js';
import { getFinancialTask, listFinancialTasks } from '../services/financial-tasks.js';
import { deleteAdminSavedView, listAdminSavedViews, saveAdminSavedView } from '../services/admin-saved-views.js';
import { buildAdminDashboard } from '../services/admin-dashboard.js';
import { getAdminSettings, updateSettingGroup } from '../services/studio-settings.js';
import { generateEnglishTranslation, listAdminContent, markEnglishTranslationReviewed, publishContent, queueEnglishTranslation, restoreContentVersion, saveContentDraft } from '../services/site-content.js';
import { messageRuleStatus } from '../services/message-rules.js';
import {
  acceptAdminInvitation,
  beginTotpEnrolment,
  confirmTotpEnrolment,
  disableTotp,
  inviteAdminAccount,
  listAdminAccounts,
  listAdminSessions,
  remainingRecoveryCodes,
  revokeAdminSession,
  setAdminAccountActive,
  setAdminAccountRole,
  setAdminPermissionGrants,
  verifySecondFactor,
  ADMIN_PERMISSION_CATALOGUE,
} from '../services/admin-accounts.js';
import { adminCommandCsv, auditActionFacets, auditLogCsv, listAdminCommands, listAuditLog, signInActivity } from '../services/admin-audit.js';
import { listReceivedRequests, receivedRequestsCsv, updateReceivedRequest } from '../services/received-requests.js';
import { mediaIntegrity, mediaIntegritySummary } from '../services/media-integrity.js';
import { DATA_RIGHTS_RESPONSE_TEMPLATES, dataRightsCsv, listDataRightsRequests, renderResponseTemplate } from '../services/data-rights-queue.js';
import {
  listMessageRules,
  listMessageTemplates,
  previewTemplate,
  publishTemplate,
  renderWithSampleData,
  revertTemplate,
  saveTemplateDraft,
  upsertMessageRule,
} from '../services/message-library.js';
import { listNotifications } from '../services/notification-journal.js';
import { templateOverrideStatus } from '../services/message-template-overrides.js';
import {
  deleteScheduleException,
  getCalendarHealth,
  listCalendarSyncLogs,
  getPlanningWindow,
  listBookingRules,
  listBusinessHours,
  listScheduleExceptions,
  upsertBookingRule,
  upsertBusinessHour,
  upsertScheduleException,
} from '../services/scheduling-admin.js';
import { listReservations } from '../services/reservation-search.js';
import {
  findDuplicateCandidates,
  getPayment,
  listPayments,
  paymentCsvRows,
  toCsv,
} from '../services/payments.js';
import { transitionReservationStatus } from '../services/status-transitions.js';
import { resolveCustomerDecisionCopy, type CustomerReasonCode } from '../services/customer-decision-copy.js';
import { normalizePaymentReference } from '../utils/payment-reference.js';
import {
  adminSavedViewListQuerySchema,
  adminSavedViewSchema,
  adminAccountActiveSchema,
  adminAccountInviteSchema,
  adminAccountRoleSchema,
  adminInvitationAcceptSchema,
  adminLoginSchema,
  adminPasswordChangeSchema,
  adminPermissionGrantSchema,
  adminSessionRevokeSchema,
  adminSessionListQuerySchema,
  adminTotpConfirmSchema,
  auditListQuerySchema,
  availabilityBlockCreateSchema,
  availabilityBlockUpdateSchema,
  bookingRuleSchema,
  calendarSyncLogListQuerySchema,
  businessHourUpdateSchema,
  catalogueBenefitCreateSchema,
  catalogueBenefitUpdateSchema,
  catalogueTaxonomyUpdateSchema,
  contentDraftSchema,
  customerDecisionPreviewSchema,
  dataRightsRequestCreateSchema,
  dataRightsRequestUpdateSchema,
  financialTaskListQuerySchema,
  idParamsSchema,
  imageConsentEventCreateSchema,
  leadUpdateSchema,
  listQuerySchema,
  mediaUpdateSchema,
  mediaUploadFieldsSchema,
  mediaUploadSchema,
  messagePreviewSchema,
  messageRuleSchema,
  messageTemplateDraftSchema,
  notificationListQuerySchema,
  notificationResolutionSchema,
  packageCreateSchema,
  packageDuplicateSchema,
  packageUpdateSchema,
  packageValidationSchema,
  dataRightsListQuerySchema,
  leadListQuerySchema,
  mediaReorderSchema,
  packageReorderSchema,
  packageVersionCommandSchema,
  paymentAddSchema,
  paymentDeclaredAmountSchema,
  paymentDuplicateSchema,
  paymentListQuerySchema,
  paymentVerificationSchema,
  planningWindowQuerySchema,
  qaNotificationOverrideSchema,
  refundDecisionSchema,
  rescheduleRequestCreateSchema,
  rescheduleRequestDecisionSchema,
  reservationCancellationSchema,
  reservationDeliveryPublishSchema,
  reservationIdParamsSchema,
  reservationListQuerySchema,
  reservationStatusUpdateSchema,
  scheduleExceptionSchema,
  settingGroupUpdateSchema,
  verifyAndConfirmSchema,
  withdrawalRequestCreateSchema,
  withdrawalRequestDecisionSchema,
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
    let admin;
    try {
      admin = await verifyAdminCredentials(req.body.email, req.body.password);
    } catch (error) {
      await recordSignInAttempt(req.body.email, req, false, 'INVALID_CREDENTIALS');
      throw error;
    }

    // The second factor is asked for only once the password is right, so the prompt never
    // reveals whether an address has an account. Existing owners may bootstrap from the
    // security screen; once configured, the second factor is always enforced here.
    if (admin.totpConfirmedAt) {
      if (!req.body.totpCode) {
        await recordSignInAttempt(req.body.email, req, false, 'TOTP_REQUIRED');
        throw new HttpError(401, 'TOTP_REQUIRED', 'Saisissez le code de votre application d’authentification.');
      }
      if (!await verifySecondFactor(admin, req.body.totpCode)) {
        await recordSignInAttempt(req.body.email, req, false, 'TOTP_INVALID');
        throw new HttpError(401, 'INVALID_CREDENTIALS', 'Identifiants ou code incorrects.');
      }
    }

    const session = await startAdminSession(admin, req);
    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastSignInAt: new Date() } });
    await recordSignInAttempt(req.body.email, req, true);
    setAdminSessionCookie(res, admin, session.id);
    res.json({ data: publicAdminUser(admin) });
  }),
);

// Accepting an invitation is by definition unauthenticated: the account has no password yet.
router.post(
  '/invitations/accept',
  adminLoginRateLimiter,
  validate('body', adminInvitationAcceptSchema),
  asyncHandler(async (req, res) => {
    const admin = await acceptAdminInvitation(req.body.token, req.body.password);
    await writeAuditLog(admin.id, 'admin.invitation.accept', 'AdminUser', admin.id);
    const session = await startAdminSession(admin, req);
    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastSignInAt: new Date() } });
    await recordSignInAttempt(admin.email, req, true);
    setAdminSessionCookie(res, admin, session.id);
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
    const session = await startAdminSession(updatedAdmin, req);
    setAdminSessionCookie(res, updatedAdmin, session.id);
    res.json({
      data: publicAdminUser(updatedAdmin),
      message: 'Mot de passe modifié avec succès.',
    });
  }),
);

// === Phase 10 (§12): named accounts, two-factor, sessions and audit ===

const requireOwner = (res: Response) => {
  const admin = res.locals.admin;
  if (!admin || admin.role !== 'OWNER') {
    throw new HttpError(403, 'OWNER_REQUIRED', 'Cette section est réservée au propriétaire.');
  }
  return admin;
};

router.get('/security/accounts', asyncHandler(async (_req, res) => {
  requireOwner(res);
  res.json({ data: await listAdminAccounts(), meta: { permissions: ADMIN_PERMISSION_CATALOGUE } });
}));

router.post('/security/accounts', validate('body', adminAccountInviteSchema), asyncHandler(async (req, res) => {
  const actor = requireOwner(res);
  const invitation = await inviteAdminAccount(req.body, actor.id);
  await writeAuditLog(actor.id, 'admin.invitation.create', 'AdminUser', invitation.account.id, {
    email: invitation.account.email, role: invitation.account.role, expiresAt: invitation.account.invitationExpiresAt,
  });
  res.status(201).json({
    data: {
      accountId: invitation.account.id,
      invitationPath: `/admin/securite?invitation=${encodeURIComponent(invitation.token)}`,
      expiresAt: invitation.account.invitationExpiresAt,
    },
  });
}));

router.patch('/security/accounts/:id/active', validate('params', idParamsSchema), validate('body', adminAccountActiveSchema), asyncHandler(async (req, res) => {
  const actor = requireOwner(res);
  const id = routeParam(req.params.id);
  const account = await setAdminAccountActive(id, req.body.isActive, actor.id);
  await writeAuditLog(actor.id, req.body.isActive ? 'admin.account.activate' : 'admin.account.deactivate', 'AdminUser', id);
  res.json({ data: account });
}));

router.patch('/security/accounts/:id/role', validate('params', idParamsSchema), validate('body', adminAccountRoleSchema), asyncHandler(async (req, res) => {
  const actor = requireOwner(res);
  const id = routeParam(req.params.id);
  const account = await setAdminAccountRole(id, req.body.role, actor.id);
  await writeAuditLog(actor.id, 'admin.account.role', 'AdminUser', id, { role: req.body.role });
  res.json({ data: account });
}));

router.put('/security/accounts/:id/permissions', validate('params', idParamsSchema), validate('body', adminPermissionGrantSchema), asyncHandler(async (req, res) => {
  const actor = requireOwner(res);
  const id = routeParam(req.params.id);
  const grants = await setAdminPermissionGrants(id, req.body.permissions, actor.id);
  await writeAuditLog(actor.id, 'admin.account.permissions', 'AdminUser', id, { permissions: req.body.permissions });
  res.json({ data: grants });
}));

router.get('/security/sessions', validate('query', adminSessionListQuerySchema), asyncHandler(async (_req, res) => {
  const actor = res.locals.admin!;
  const result = await listAdminSessions({ ...res.locals.validated.query, adminUserId: actor.id });
  res.json({ data: result.items, meta: { total: result.total, limit: result.limit, offset: result.offset } });
}));

router.get('/security/sessions/all', validate('query', adminSessionListQuerySchema), asyncHandler(async (_req, res) => {
  requireOwner(res);
  const result = await listAdminSessions(res.locals.validated.query);
  res.json({ data: result.items, meta: { total: result.total, limit: result.limit, offset: result.offset } });
}));

router.patch('/security/sessions/:id/revoke', validate('params', idParamsSchema), validate('body', adminSessionRevokeSchema), asyncHandler(async (req, res) => {
  const actor = res.locals.admin!;
  const id = routeParam(req.params.id);
  const session = await prisma.adminSession.findUnique({ where: { id } });
  if (!session) throw new HttpError(404, 'ADMIN_SESSION_NOT_FOUND', 'Session introuvable.');
  if (session.adminUserId !== actor.id && actor.role !== 'OWNER') {
    throw new HttpError(403, 'OWNER_REQUIRED', 'Vous ne pouvez retirer que vos propres sessions.');
  }
  const revoked = await revokeAdminSession(id, actor.id, req.body.reason);
  await writeAuditLog(actor.id, 'admin.session.revoke', 'AdminSession', id, { accountId: session.adminUserId, reason: req.body.reason });
  res.json({ data: revoked });
}));

router.get('/security/totp', asyncHandler(async (_req, res) => {
  const actor = res.locals.admin!;
  res.json({ data: { enabled: Boolean(actor.totpConfirmedAt), recoveryCodesRemaining: await remainingRecoveryCodes(actor.id) } });
}));

router.post('/security/totp/begin', asyncHandler(async (_req, res) => {
  const actor = res.locals.admin!;
  const enrolment = await beginTotpEnrolment(actor);
  await writeAuditLog(actor.id, 'admin.totp.begin', 'AdminUser', actor.id);
  res.json({ data: enrolment });
}));

router.post('/security/totp/confirm', validate('body', adminTotpConfirmSchema), asyncHandler(async (req, res) => {
  const actor = res.locals.admin!;
  const result = await confirmTotpEnrolment(actor, req.body.code);
  await writeAuditLog(actor.id, 'admin.totp.enable', 'AdminUser', actor.id, { recoveryCodeCount: result.recoveryCodes.length });
  res.json({ data: result });
}));

router.post('/security/totp/disable', validate('body', adminTotpConfirmSchema), asyncHandler(async (req, res) => {
  const actor = res.locals.admin!;
  if (!await verifySecondFactor(actor, req.body.code)) throw new HttpError(422, 'TOTP_CODE_INVALID', 'Ce code est incorrect ou expiré.');
  await disableTotp(actor.id);
  await writeAuditLog(actor.id, 'admin.totp.disable', 'AdminUser', actor.id);
  res.status(204).send();
}));

router.get('/security/sign-ins', asyncHandler(async (_req, res) => {
  requireOwner(res);
  res.json({ data: await signInActivity() });
}));

router.get('/audit', validate('query', auditListQuerySchema), asyncHandler(async (_req, res) => {
  requireOwner(res);
  const query = res.locals.validated.query;
  const [logs, commands, facets] = await Promise.all([listAuditLog(query), listAdminCommands(query), auditActionFacets()]);
  res.json({ data: logs.items, meta: { total: logs.total, limit: logs.limit, offset: logs.offset, commands: commands.items, commandTotal: commands.total, facets } });
}));

router.get('/audit/export.csv', validate('query', auditListQuerySchema), asyncHandler(async (_req, res) => {
  const actor = requireOwner(res);
  const query = { ...res.locals.validated.query, limit: 1000, offset: 0 };
  const result = await listAuditLog(query);
  await writeAuditLog(actor.id, 'admin.audit.export', 'AuditLog', undefined, { rows: result.items.length });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="journal-audit.csv"');
  res.send(auditLogCsv(result.items));
}));

router.get('/audit/commands/export.csv', validate('query', auditListQuerySchema), asyncHandler(async (_req, res) => {
  const actor = requireOwner(res);
  const query = { ...res.locals.validated.query, limit: 1000, offset: 0 };
  const result = await listAdminCommands(query);
  await writeAuditLog(actor.id, 'admin.command.export', 'AdminCommand', undefined, { rows: result.items.length });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="commandes-admin.csv"');
  res.send(adminCommandCsv(result.items));
}));
router.get(
  '/data-governance',
  asyncHandler(async (_req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'DATA_GOVERNANCE_MANAGE');
    res.json({ data: await listDataGovernance() });
  }),
);

router.get(
  '/data-rights-requests',
  validate('query', dataRightsListQuerySchema),
  asyncHandler(async (req, res) => {
    assertAdminPermission(res.locals.admin, 'DATA_GOVERNANCE_MANAGE');
    const result = await listDataRightsRequests(res.locals.validated.query);
    res.json({ data: result.items, meta: { total: result.total, summary: result.summary, templates: DATA_RIGHTS_RESPONSE_TEMPLATES } });
  }),
);

router.get(
  '/data-rights-requests/export.csv',
  validate('query', dataRightsListQuerySchema),
  asyncHandler(async (req, res) => {
    assertAdminPermission(res.locals.admin, 'DATA_GOVERNANCE_MANAGE');
    const result = await listDataRightsRequests(res.locals.validated.query);
    // The register is evidence; exporting it is an act worth recording in its own right.
    await writeAuditLog(res.locals.admin?.id, 'data_rights.export', 'DataRightsRequest', undefined, { total: result.total, query: res.locals.validated.query });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="droits-personnes-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(dataRightsCsv(result.items));
  }),
);

router.get(
  '/data-rights-requests/:id/response-template',
  validate('params', idParamsSchema),
  asyncHandler(async (req, res) => {
    assertAdminPermission(res.locals.admin, 'DATA_GOVERNANCE_MANAGE');
    const request = await prisma.dataRightsRequest.findUnique({ where: { id: routeParam(req.params.id) } });
    if (!request) throw notFound('Data rights request not found');
    const rendered = renderResponseTemplate(String(req.query.code ?? ''), request, String(req.query.reason ?? ''));
    if (!rendered) throw new HttpError(404, 'RESPONSE_TEMPLATE_NOT_FOUND', 'Modèle de réponse inconnu.');
    res.json({ data: rendered });
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

// Every card on the dashboard counts with the same predicate the list it links to
// uses, so a counter and its list can never disagree.
router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    res.json({ data: await buildAdminDashboard() });
  }),
);
router.get(
  '/saved-views',
  validate('query', adminSavedViewListQuerySchema),
  asyncHandler(async (_req, res) => {
    res.json({ data: await listAdminSavedViews(res.locals.admin!.id, res.locals.validated.query.scope) });
  }),
);

router.post(
  '/saved-views',
  validate('body', adminSavedViewSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await saveAdminSavedView(res.locals.admin!.id, req.body) });
  }),
);

router.delete(
  '/saved-views/:id',
  validate('params', idParamsSchema),
  asyncHandler(async (req, res) => {
    await deleteAdminSavedView(res.locals.admin!.id, routeParam(req.params.id));
    res.status(204).send();
  }),
);



router.get(
  '/reservations',
  validate('query', reservationListQuerySchema),
  asyncHandler(async (req, res) => {
    const query = res.locals.validated.query;
    const result = await listReservations(query);
    const reservations = result.items;

    await Promise.all(
      reservations
        .filter((reservation) => !reservation.snapshot)
        .map((reservation) => recordMissingReservationSnapshot(reservation.id, 'admin_reservation_list')),
    );

    res.json({ data: reservations, meta: { total: result.total, limit: result.limit, offset: result.offset } });
  }),
);

router.get(
  '/reservations/:id',
  validate('params', idParamsSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const reservation = await prisma.reservation.findFirst({
      where: { OR: [{ id }, { reference: id.toUpperCase() }] },
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
  validate('query', leadListQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await listReceivedRequests(res.locals.validated.query);
    res.json({ data: result.items, meta: { total: result.total, limit: result.limit, offset: result.offset } });
  }),
);

// Declared before '/leads/:id' so the literal path is not read as an identifier.
router.get(
  '/leads/export.csv',
  validate('query', leadListQuerySchema),
  asyncHandler(async (req, res) => {
    // The export is the filtered list, not the whole table: an export that quietly
    // ignored the filters would be a different document from the one on screen.
    const result = await listReceivedRequests({ ...res.locals.validated.query, limit: 1000, offset: 0 });
    await writeAuditLog(res.locals.admin?.id, 'lead.export', 'Lead', undefined, { total: result.total, query: res.locals.validated.query });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="demandes-recues-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(receivedRequestsCsv(result.items));
  }),
);

router.get(
  '/leads/:id',
  validate('params', idParamsSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const lead = await prisma.lead.findFirst({ where: { OR: [{ id }, { reference: id.toUpperCase() }] } });
    if (!lead) throw notFound('Lead not found');
    res.json({ data: lead });
  }),
);

router.patch(
  '/leads/:id',
  validate('params', idParamsSchema),
  validate('body', leadUpdateSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const lead = await updateReceivedRequest(id, req.body, res.locals.admin?.id);
    if (!lead) throw notFound('Lead not found');
    await writeAuditLog(res.locals.admin?.id, 'lead.update', 'Lead', lead.id, req.body);

    res.json({ data: lead });
  }),
);

router.get(
  '/catalogue-taxonomy',
  asyncHandler(async (_req, res) => {
    const data = await prisma.catalogueTaxonomy.findMany({ orderBy: { sortOrder: 'asc' }, include: { locales: { orderBy: { locale: 'asc' } } } });
    res.json({ data });
  }),
);
router.patch(
  '/catalogue-taxonomy/:key',
  validate('body', catalogueTaxonomyUpdateSchema),
  asyncHandler(async (req, res) => {
    assertAdminPermission(res.locals.admin, 'PACKAGE_PUBLISH');
    const key = routeParam(req.params.key);
    const data = await updateCatalogueTaxonomy(key, req.body);
    await writeAuditLog(res.locals.admin!.id, 'catalogue.taxonomy.update', 'CatalogueTaxonomy', key, req.body);
    res.json({ data });
  }),
);
router.get('/catalogue-benefits', asyncHandler(async (_req, res) => res.json({ data: await listAdminCatalogueBenefits() })));
router.post(
  '/catalogue-benefits', validate('body', catalogueBenefitCreateSchema),
  asyncHandler(async (req, res) => { assertAdminPermission(res.locals.admin, 'PACKAGE_PUBLISH'); const data = await createCatalogueBenefitDraft(req.body, res.locals.admin!.id); await writeAuditLog(res.locals.admin!.id, 'catalogue.benefit.create', 'CatalogueBenefit', data.id, req.body); res.status(201).json({ data }); }),
);
router.patch(
  '/catalogue-benefits/:id', validate('params', idParamsSchema), validate('body', catalogueBenefitUpdateSchema),
  asyncHandler(async (req, res) => { assertAdminPermission(res.locals.admin, 'PACKAGE_PUBLISH'); const id=routeParam(req.params.id); const { expectedVersion, ...input }=req.body; const data=await updateCatalogueBenefitDraft(id, expectedVersion, input, res.locals.admin!.id); await writeAuditLog(res.locals.admin!.id, 'catalogue.benefit.update', 'CatalogueBenefit', id, { expectedVersion, ...input }); res.json({ data }); }),
);
router.post(
  '/catalogue-benefits/:id/validate', validate('params', idParamsSchema), validate('body', packageVersionCommandSchema),
  asyncHandler(async (req, res) => { assertAdminPermission(res.locals.admin, 'PACKAGE_PUBLISH'); const id=routeParam(req.params.id); await validateCatalogueBenefitVersion(id, req.body.expectedVersion, res.locals.admin!.id); await writeAuditLog(res.locals.admin!.id, 'catalogue.benefit.validate', 'CatalogueBenefit', id, req.body); res.json({ data: await listAdminCatalogueBenefits() }); }),
);
router.post(
  '/catalogue-benefits/:id/publish', validate('params', idParamsSchema), validate('body', packageVersionCommandSchema),
  asyncHandler(async (req, res) => { assertAdminPermission(res.locals.admin, 'PACKAGE_PUBLISH'); const id=routeParam(req.params.id); const data=await publishCatalogueBenefitVersion(id, req.body.expectedVersion, res.locals.admin!.id); await writeAuditLog(res.locals.admin!.id, 'catalogue.benefit.publish', 'CatalogueBenefit', id, req.body); res.json({ data }); }),
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
    const scheduled = packageItem.publicationStatus === 'VALIDATED' && packageItem.effectiveAt && new Date(packageItem.effectiveAt) > new Date();
    await writeAuditLog(admin!.id, scheduled ? 'package.publish.schedule' : 'package.publish', 'Package', id, {
      version: packageItem.version,
      fromStatus: 'VALIDATED',
      toStatus: scheduled ? 'VALIDATED' : 'PUBLISHED',
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

// Declared before '/packages/:id' so the literal path is not read as an id.
router.post(
  '/packages/reorder',
  validate('body', packageReorderSchema),
  asyncHandler(async (req, res) => {
    assertAdminPermission(res.locals.admin, 'PACKAGE_PUBLISH');
    const data = await reorderPackages(req.body.orderedIds);
    await writeAuditLog(res.locals.admin?.id, 'package.reorder', 'Package', undefined, { orderedIds: req.body.orderedIds });
    res.json({ data });
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
    // §10: the alerts are computed from the columns already on each item, so the list and
    // the summary can never disagree about what is wrong with a media.
    const data = media.map((item) => ({ ...item, integrity: mediaIntegrity(item) }));
    res.json({ data, meta: { integrity: mediaIntegritySummary(media) } });
  }),
);

router.post(
  '/media/reorder',
  validate('body', mediaReorderSchema),
  asyncHandler(async (req, res) => {
    const data = await reorderMedia(req.body.orderedIds);
    await writeAuditLog(res.locals.admin?.id, 'media.reorder', 'MediaItem', undefined, { orderedIds: req.body.orderedIds });
    res.json({ data: data.map((item) => ({ ...item, integrity: mediaIntegrity(item) })) });
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
router.post(
  '/media/:id/archive',
  validate('params', idParamsSchema),
  asyncHandler(async (req, res) => {
    const media = await archiveMediaWithRights(routeParam(req.params.id), res.locals.admin);
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
router.post(
  '/media/:id/replace',
  validate('params', idParamsSchema),
  mediaUpload.single('file'),
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'MEDIA_RIGHTS_MANAGE');
    if (!req.file) throw new HttpError(400, 'MEDIA_FILE_REQUIRED', 'Choisissez un fichier image à remplacer.');
    const processed = await processUploadedMedia(req.file);
    try {
      const media = await replaceMediaFileWithHistory(routeParam(req.params.id), processed, admin);
      res.json({ data: media });
    } catch (error) {
      await deleteMediaFiles(processed);
      throw error;
    }
  }),
);

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

// Registered before '/payments/:id' so the export path is not read as an identifier.
router.get(
  '/payments/export.csv',
  validate('query', paymentListQuerySchema),
  asyncHandler(async (_req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'PAYMENT_DECIDE');
    const query = res.locals.validated.query;
    const result = await listPayments({ ...query, limit: 1000, offset: 0 });
    await writeAuditLog(admin?.id, 'payment.export', 'Payment', undefined, { filters: query, rows: result.items.length });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="paiements.csv"');
    res.send(toCsv(paymentCsvRows(result.items)));
  }),
);

router.get(
  '/payments',
  validate('query', paymentListQuerySchema),
  asyncHandler(async (_req, res) => {
    assertAdminPermission(res.locals.admin, 'PAYMENT_VIEW');
    const result = await listPayments(res.locals.validated.query);
    res.json({ data: result.items, meta: { total: result.total, limit: result.limit, offset: result.offset } });
  }),
);

router.get(
  '/payments/:id',
  validate('params', idParamsSchema),
  asyncHandler(async (req, res) => {
    assertAdminPermission(res.locals.admin, 'PAYMENT_VIEW');
    res.json({ data: await getPayment(routeParam(req.params.id)) });
  }),
);

router.get(
  '/payments/:id/duplicates',
  validate('params', idParamsSchema),
  asyncHandler(async (req, res) => {
    assertAdminPermission(res.locals.admin, 'PAYMENT_VIEW');
    res.json({ data: await findDuplicateCandidates(routeParam(req.params.id)) });
  }),
);

// Recording what the studio actually received. This annotates the payment; it is not a
// state transition, so it never touches the verification status machine.
router.patch(
  '/payments/:id/declared-amount',
  validate('params', idParamsSchema),
  validate('body', paymentDeclaredAmountSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'PAYMENT_DECIDE');
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.payment.updateMany({
        where: { id, version: req.body.expectedVersion },
        data: { declaredAmount: req.body.declaredAmount, version: { increment: 1 } },
      });
      if (changed.count !== 1) {
        throw new HttpError(409, 'PAYMENT_VERSION_CONFLICT', 'Le paiement a été modifié pendant cette requête.');
      }
      return tx.payment.findUniqueOrThrow({ where: { id } });
    });
    await writeAuditLog(admin?.id, 'payment.declared_amount', 'Payment', id, {
      commandId: req.body.commandId,
      declaredAmount: req.body.declaredAmount,
      expectedAmount: updated.amount,
      reason: req.body.reason,
    });
    res.json({ data: await getPayment(id) });
  }),
);

router.patch(
  '/payments/:id/duplicate',
  validate('params', idParamsSchema),
  validate('body', paymentDuplicateSchema),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'PAYMENT_DECIDE');
    const target = req.body.duplicateOfPaymentId;
    if (target === id) {
      throw new HttpError(400, 'PAYMENT_DUPLICATE_SELF', 'Un paiement ne peut pas être son propre doublon.');
    }
    if (target) {
      const exists = await prisma.payment.findUnique({ where: { id: target }, select: { id: true, duplicateOfPaymentId: true } });
      if (!exists) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Paiement de référence introuvable.');
      // Keep the link one level deep so the pair always resolves to a single original.
      if (exists.duplicateOfPaymentId) {
        throw new HttpError(409, 'PAYMENT_DUPLICATE_CHAIN', 'Ce paiement est déjà marqué comme doublon d’un autre.');
      }
    }
    await prisma.payment.update({ where: { id }, data: { duplicateOfPaymentId: target } });
    await writeAuditLog(admin?.id, target ? 'payment.duplicate.link' : 'payment.duplicate.unlink', 'Payment', id, {
      duplicateOfPaymentId: target,
      reason: req.body.reason,
    });
    res.json({ data: await getPayment(id) });
  }),
);

router.get(
  '/financial-tasks/export.csv',
  validate('query', financialTaskListQuerySchema),
  asyncHandler(async (_req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'REFUND_MANAGE');
    const query = res.locals.validated.query;
    const result = await listFinancialTasks({ ...query, limit: 1000, offset: 0 });
    await writeAuditLog(admin?.id, 'financial_task.export', 'FinancialTask', undefined, { filters: query, rows: result.items.length });
    const header = ['reservation', 'task_id', 'type', 'status', 'amount', 'due_at', 'channel', 'provider_reference', 'created_by', 'created_at', 'completed_at'];
    const rows = result.items.map((task) => [
      task.reservation?.reference ?? '', task.id, task.type, task.status, String(task.amount),
      task.dueAt.toISOString(), task.channel ?? '', task.providerReference ?? '',
      task.createdBy?.name ?? 'Système', task.createdAt.toISOString(),
      task.completedAt ? task.completedAt.toISOString() : '',
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="remboursements.csv"');
    res.send(toCsv([header, ...rows]));
  }),
);

router.get(
  '/financial-tasks',

  validate('query', financialTaskListQuerySchema),
  asyncHandler(async (_req, res) => {
    assertAdminPermission(res.locals.admin, 'REFUND_MANAGE');
    const result = await listFinancialTasks(res.locals.validated.query);
    res.json({ data: result.items, meta: { total: result.total, limit: result.limit, offset: result.offset, operators: result.operators } });
  }),
);

router.get(
  '/financial-tasks/:id',
  validate('params', idParamsSchema),
  asyncHandler(async (req, res) => {
    assertAdminPermission(res.locals.admin, 'REFUND_MANAGE');
    res.json({ data: await getFinancialTask(routeParam(req.params.id)) });
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
  validate('query', notificationListQuerySchema),
  asyncHandler(async (_req, res) => {
    const result = await listNotifications(res.locals.validated.query);
    res.json({
      data: result.items,
      meta: { total: result.total, limit: result.limit, offset: result.offset, hiddenChannels: result.hiddenChannels },
    });
  }),
);

// === Phase 7 (§8.1): the message library ===

router.get(
  '/messages',
  asyncHandler(async (req, res) => {
    assertAdminPermission(res.locals.admin, 'PACKAGE_PUBLISH');
    const locale = req.query.locale === 'en' ? 'en' : 'fr';
    res.json({ data: await listMessageTemplates(locale), meta: { overrides: templateOverrideStatus() } });
  }),
);

router.post(
  '/messages/:code',
  validate('body', messageTemplateDraftSchema),
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'PACKAGE_PUBLISH');
    res.json({ data: await saveTemplateDraft(routeParam(req.params.code), req.body.locale, req.body, admin?.id) });
  }),
);

router.post(
  '/messages/:code/publish',
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'PACKAGE_PUBLISH');
    const locale = req.query.locale === 'en' ? 'en' : 'fr';
    res.json({ data: await publishTemplate(routeParam(req.params.code), locale, admin?.id) });
  }),
);

// Going back to the version compiled into the application, without deleting history.
router.post(
  '/messages/:code/revert',
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'PACKAGE_PUBLISH');
    const locale = req.query.locale === 'en' ? 'en' : 'fr';
    await revertTemplate(routeParam(req.params.code), locale, admin?.id);
    res.status(204).send();
  }),
);

router.post(
  '/messages/:code/preview',
  validate('body', messagePreviewSchema),
  asyncHandler(async (req, res) => {
    assertAdminPermission(res.locals.admin, 'PACKAGE_PUBLISH');
    const { locale, subject, preheader, body } = req.body;
    const draft = subject !== undefined && body !== undefined
      ? { subject, preheader: preheader ?? '', body }
      : undefined;
    res.json({ data: previewTemplate(routeParam(req.params.code), locale, draft) });
  }),
);

// A test send renders through the real pipeline and goes to the studio's own address,
// never to a customer.
router.post(
  '/messages/:code/test-send',
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'PACKAGE_PUBLISH');
    const locale = req.query.locale === 'en' ? 'en' : 'fr';
    const code = routeParam(req.params.code);
    const rendered = renderWithSampleData(code, locale);
    const recipient = env.ADMIN_NOTIFICATION_EMAIL;
    await enqueueInternalEmailNotification({
      destination: { type: 'SHARED_OPERATIONAL' },
      type: 'message_template_test_admin',
      recipient,
      idempotencyKey: `template-test:${code}:${locale}:${Date.now()}`,
      templateCode: code,
      templateVersion: rendered.version,
      renderedContent: rendered as unknown as Prisma.InputJsonValue,
    });
    await writeAuditLog(admin?.id, 'message_template.test_send', 'MessageTemplate', code, { locale, recipient });
    res.status(202).json({ data: { recipient, subject: rendered.subject } });
  }),
);

router.get(
  '/message-rules',
  asyncHandler(async (_req, res) => {
    assertAdminPermission(res.locals.admin, 'PACKAGE_PUBLISH');
    res.json({ data: await listMessageRules(), meta: { applied: messageRuleStatus() } });
  }),
);

router.put(
  '/message-rules',
  validate('body', messageRuleSchema),
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'PACKAGE_PUBLISH');
    res.json({ data: await upsertMessageRule(req.body, admin?.id) });
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

// === Phase 6 (ADM-09): ordinary information stops needing a deployment ===

router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    assertAdminPermission(res.locals.admin, 'PACKAGE_PUBLISH');
    res.json({ data: await getAdminSettings() });
  }),
);

router.put(
  '/settings/:group',
  validate('body', settingGroupUpdateSchema),
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'PACKAGE_PUBLISH');
    res.json({ data: await updateSettingGroup(routeParam(req.params.group), req.body.values, admin?.id) });
  }),
);

router.get(
  '/content',
  asyncHandler(async (req, res) => {
    assertAdminPermission(res.locals.admin, 'PACKAGE_PUBLISH');
    const locale = req.query.locale === 'en' ? 'en' : 'fr';
    res.json({ data: await listAdminContent(locale) });
  }),
);

router.post(
  '/content/:key',
  validate('body', contentDraftSchema),
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'PACKAGE_PUBLISH');
    res.json({ data: await saveContentDraft(routeParam(req.params.key), req.body.locale, req.body.body, admin?.id) });
  }),
);

router.post('/content/:key/translation/queue', asyncHandler(async (req, res) => {
  const admin = res.locals.admin;
  assertAdminPermission(admin, 'PACKAGE_PUBLISH');
  res.json({ data: await queueEnglishTranslation(routeParam(req.params.key), admin?.id) });
}));

router.post('/content/:key/translation/generate', asyncHandler(async (req, res) => {
  const admin = res.locals.admin;
  assertAdminPermission(admin, 'PACKAGE_PUBLISH');
  res.json({ data: await generateEnglishTranslation(routeParam(req.params.key), admin?.id) });
}));

router.post('/content/:key/translation/review', asyncHandler(async (req, res) => {
  const admin = res.locals.admin;
  assertAdminPermission(admin, 'PACKAGE_PUBLISH');
  res.json({ data: await markEnglishTranslationReviewed(routeParam(req.params.key), admin?.id) });
}));

router.post(
  '/content/:key/publish',
  asyncHandler(async (req, res) => {
    const admin = res.locals.admin;
    assertAdminPermission(admin, 'PACKAGE_PUBLISH');
    const locale = req.query.locale === 'en' ? 'en' : 'fr';
    res.json({ data: await publishContent(routeParam(req.params.key), locale, admin?.id) });
  }),
);

router.post('/content/:key/restore/:version', asyncHandler(async (req, res) => {
  const admin = res.locals.admin;
  assertAdminPermission(admin, 'PACKAGE_PUBLISH');
  const locale = req.query.locale === 'en' ? 'en' : 'fr';
  const version = Number(routeParam(req.params.version));
  if (!Number.isInteger(version) || version < 1) throw new HttpError(400, 'INVALID_CONTENT_VERSION', 'Version de contenu invalide.');
  res.json({ data: await restoreContentVersion(routeParam(req.params.key), locale, version, admin?.id) });
}));

// === Phase 5 (ADM-05): the studio owns its own schedule ===
// Opening hours already existed in the database but nothing wrote them, so changing an
// opening time meant a developer. Every route here is audited and owner-gated, because
// a schedule change is immediately visible to the public.

router.get(
  '/schedule/business-hours',
  asyncHandler(async (_req, res) => {
    requireOwner(res);
    res.json({ data: await listBusinessHours() });
  }),
);

router.put(
  '/schedule/business-hours/:dayOfWeek',
  validate('body', businessHourUpdateSchema),
  asyncHandler(async (req, res) => {
    const admin = requireOwner(res);
    const dayOfWeek = Number(routeParam(req.params.dayOfWeek));
    if (dayOfWeek !== req.body.dayOfWeek) throw new HttpError(400, 'DAY_MISMATCH', 'Le jour de l’URL et celui du corps diffèrent.');
    const saved = await upsertBusinessHour(req.body, admin.id);
    const calendarSync = await syncStudioScheduleToCalendar(`business-hour:${saved.id}:${saved.updatedAt.getTime()}`);
    res.json({ data: saved, meta: { calendarSync } });
  }),
);

router.get('/schedule/exceptions', asyncHandler(async (req, res) => {
  requireOwner(res);
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  res.json({ data: await listScheduleExceptions(from, to) });
}));

router.put('/schedule/exceptions', validate('body', scheduleExceptionSchema), asyncHandler(async (req, res) => {
  const admin = requireOwner(res);
  const saved = await upsertScheduleException(req.body, admin.id);
  const calendarSync = await syncStudioScheduleToCalendar(`exception:${saved.id}:${saved.updatedAt.getTime()}`);
  res.json({ data: saved, meta: { calendarSync } });
}));

router.delete('/schedule/exceptions/:date', asyncHandler(async (req, res) => {
  const admin = requireOwner(res);
  const date = routeParam(req.params.date);
  await deleteScheduleException(date, admin.id);
  await syncStudioScheduleToCalendar(`exception-delete:${date}:${Date.now()}`);
  res.status(204).send();
}));

router.get('/schedule/booking-rules', asyncHandler(async (_req, res) => {
  requireOwner(res);
  res.json({ data: await listBookingRules() });
}));

router.put('/schedule/booking-rules', validate('body', bookingRuleSchema), asyncHandler(async (req, res) => {
  const admin = requireOwner(res);
  const saved = await upsertBookingRule(req.body, admin.id);
  const calendarSync = await syncStudioScheduleToCalendar(`booking-rule:${saved.id}:${saved.updatedAt.getTime()}`);
  res.json({ data: saved, meta: { calendarSync } });
}));

router.get('/schedule/planning', validate('query', planningWindowQuerySchema), asyncHandler(async (_req, res) => {
  requireOwner(res);
  const { from, to } = res.locals.validated.query;
  res.json({ data: await getPlanningWindow(from, to) });
}));

router.get('/calendar/sync-logs', validate('query', calendarSyncLogListQuerySchema), asyncHandler(async (_req, res) => {
  requireOwner(res);
  const result = await listCalendarSyncLogs(res.locals.validated.query);
  res.json({ data: result.items, meta: { total: result.total, limit: result.limit, offset: result.offset } });
}));

router.get('/calendar/health', asyncHandler(async (_req, res) => {
  requireOwner(res);
  res.json({ data: await getCalendarHealth() });
}));

router.post('/calendar/schedule-sync/test', asyncHandler(async (_req, res) => {
  const admin = requireOwner(res);
  const log = await syncStudioScheduleToCalendar(`test:${Date.now()}`);
  await writeAuditLog(admin.id, 'calendar.schedule_sync.test', 'CalendarSyncLog', log.id);
  res.status(200).json({ data: log });
}));

router.get('/availability-blocks', asyncHandler(async (_req, res) => {
  requireOwner(res);
  const blocks = await prisma.availabilityBlock.findMany({ orderBy: { startAt: 'desc' }, take: 100 });
  res.json({ data: blocks });
}));

router.post('/availability-blocks', validate('body', availabilityBlockCreateSchema), asyncHandler(async (req, res) => {
  const admin = requireOwner(res);
  const block = await createAvailabilityBlock(req.body);
  await writeAuditLog(admin.id, 'availability_block.create', 'AvailabilityBlock', block.id, req.body);
  const calendarSync = await syncStudioScheduleToCalendar(`availability-block:${block.id}:${block.updatedAt.getTime()}`);
  res.status(201).json({ data: block, meta: { calendarSync } });
}));

router.patch('/availability-blocks/:id', validate('params', idParamsSchema), validate('body', availabilityBlockUpdateSchema), asyncHandler(async (req, res) => {
  const admin = requireOwner(res);
  const id = routeParam(req.params.id);
  const block = await updateAvailabilityBlock(id, req.body);
  await writeAuditLog(admin.id, 'availability_block.update', 'AvailabilityBlock', block.id, req.body);
  const calendarSync = await syncStudioScheduleToCalendar(`availability-block:${block.id}:${block.updatedAt.getTime()}`);
  res.json({ data: block, meta: { calendarSync } });
}));

router.delete('/availability-blocks/:id', validate('params', idParamsSchema), asyncHandler(async (req, res) => {
  const admin = requireOwner(res);
  const id = routeParam(req.params.id);
  await deleteAvailabilityBlock(id);
  await writeAuditLog(admin.id, 'availability_block.delete', 'AvailabilityBlock', id);
  await syncStudioScheduleToCalendar(`availability-block-delete:${id}:${Date.now()}`);
  res.status(204).send();
}));

router.post(
  '/calendar/sync/:reservationId',
  validate('params', reservationIdParamsSchema),
  asyncHandler(async (req, res) => {
    const admin = requireOwner(res);
    const reservationId = routeParam(req.params.reservationId);
    const log = await retryCalendarSync(reservationId);
    await writeAuditLog(admin.id, 'calendar.sync', 'Reservation', reservationId, { logId: log.id });
    res.status(200).json({ data: log });
  }),
);

export default router;
