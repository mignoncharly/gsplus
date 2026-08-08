import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';
import type { AdminUser, Prisma } from '../generated/prisma/client.js';
import { assertAdminPermission } from './admin-permissions.js';
import { runAdminCommand, type CommandOutcome } from './payment-reservation-commands.js';

const FUTURE_CLOCK_TOLERANCE_MS = 5 * 60 * 1000;
const TERMINAL_STATUSES = new Set(['PARTIALLY_FULFILLED', 'FULFILLED', 'REFUSED']);

export const RETENTION_POLICIES = [
  { category: 'RESERVATIONS', automaticExecution: false },
  { category: 'PAYMENTS', automaticExecution: false },
  { category: 'CONSENTS', automaticExecution: false },
  { category: 'MEDIA_WORK_FILES', automaticExecution: false },
  { category: 'TECHNICAL_LOGS', automaticExecution: false },
  { category: 'BACKUPS', automaticExecution: false },
  { category: 'RIGHTS_REQUESTS', automaticExecution: false },
] as const;

const rightsRequestInclude = {
  retentionPolicy: true,
  createdBy: { select: { id: true, name: true } },
  events: {
    orderBy: [{ effectiveAt: 'desc' as const }, { createdAt: 'desc' as const }],
    include: { recordedBy: { select: { id: true, name: true } } },
  },
} satisfies Prisma.DataRightsRequestInclude;

type RightsRequestRecord = Prisma.DataRightsRequestGetPayload<{ include: typeof rightsRequestInclude }>;

export const listDataGovernance = async () => {
  const [policies, requests] = await Promise.all([
    prisma.dataRetentionPolicy.findMany({ orderBy: { category: 'asc' } }),
    prisma.dataRightsRequest.findMany({
      orderBy: [{ targetResponseAt: 'asc' }, { receivedAt: 'desc' }],
      include: rightsRequestInclude,
    }),
  ]);
  return { policies, requests };
};

const loadRequestById = async (id: string): Promise<RightsRequestRecord> => {
  const request = await prisma.dataRightsRequest.findUnique({
    where: { id },
    include: rightsRequestInclude,
  });
  if (!request) throw new HttpError(404, 'DATA_RIGHTS_REQUEST_NOT_FOUND', 'Demande de droits introuvable.');
  return request;
};

const loadRequestByCommand = async (commandId: string): Promise<RightsRequestRecord> => {
  const event = await prisma.dataRightsRequestEvent.findUnique({
    where: { commandId },
    select: { requestId: true },
  });
  if (!event) throw new HttpError(409, 'DATA_RIGHTS_REPLAY_UNAVAILABLE', 'Le résultat de cette commande est indisponible.');
  return loadRequestById(event.requestId);
};

export type CreateDataRightsRequestInput = {
  commandId: string;
  requestType: 'ACCESS' | 'RECTIFICATION' | 'RESTRICTION' | 'OBJECTION' | 'PORTABILITY' | 'CONSENT_WITHDRAWAL' | 'ERASURE';
  requesterName: string;
  requesterEmail?: string;
  requesterPhone?: string;
  reservationReference?: string;
  requestChannel: 'EMAIL' | 'WHATSAPP' | 'PHONE' | 'IN_PERSON' | 'MAIL' | 'OTHER';
  requestSummary: string;
  identityStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'NOT_REQUIRED';
  identityEvidenceReference?: string;
  receivedAt: Date;
  targetResponseAt: Date;
  admin: AdminUser;
  now?: Date;
};

export const executeCreateDataRightsRequest = async (
  input: CreateDataRightsRequestInput,
): Promise<CommandOutcome<{ request: RightsRequestRecord }>> => {
  assertAdminPermission(input.admin, 'DATA_GOVERNANCE_MANAGE');
  const now = input.now ?? new Date();
  if (input.receivedAt.getTime() > now.getTime() + FUTURE_CLOCK_TOLERANCE_MS) {
    throw new HttpError(400, 'DATA_RIGHTS_RECEIVED_AT_FUTURE', 'La date de réception ne peut pas être future.');
  }
  if (input.targetResponseAt < input.receivedAt) {
    throw new HttpError(400, 'DATA_RIGHTS_TARGET_INVALID', 'L’échéance interne ne peut pas précéder la demande.');
  }
  const reference = `DR-${input.receivedAt.toISOString().slice(0, 10).replaceAll('-', '')}-${input.commandId.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const normalized = {
    requesterName: input.requesterName.trim(),
    requesterEmail: input.requesterEmail?.trim().toLowerCase(),
    requesterPhone: input.requesterPhone?.trim(),
    reservationReference: input.reservationReference?.trim().toUpperCase(),
    requestSummary: input.requestSummary.trim(),
    identityEvidenceReference: input.identityEvidenceReference?.trim(),
  };

  return runAdminCommand({
    commandId: input.commandId,
    action: 'data_rights.create',
    entityType: 'DataRightsRequest',
    entityId: reference,
    request: {
      ...normalized,
      requestType: input.requestType,
      requestChannel: input.requestChannel,
      identityStatus: input.identityStatus,
      receivedAt: input.receivedAt.toISOString(),
      targetResponseAt: input.targetResponseAt.toISOString(),
    },
    admin: input.admin,
    execute: async (tx) => {
      const policy = await tx.dataRetentionPolicy.findUnique({ where: { category: 'RIGHTS_REQUESTS' } });
      if (!policy || policy.status !== 'PUBLISHED' || policy.automaticExecution) {
        throw new HttpError(503, 'RETENTION_POLICY_UNAVAILABLE', 'La politique publiée des demandes de droits est indisponible.');
      }
      const request = await tx.dataRightsRequest.create({
        data: {
          reference,
          requestType: input.requestType,
          requesterName: normalized.requesterName,
          requesterEmail: normalized.requesterEmail,
          requesterPhone: normalized.requesterPhone,
          reservationReference: normalized.reservationReference,
          requestChannel: input.requestChannel,
          requestSummary: normalized.requestSummary,
          identityStatus: input.identityStatus,
          identityEvidenceReference: normalized.identityEvidenceReference,
          receivedAt: input.receivedAt,
          targetResponseAt: input.targetResponseAt,
          retentionPolicyId: policy.id,
          createdById: input.admin.id,
          events: {
            create: {
              commandId: input.commandId,
              eventType: 'CREATED',
              toStatus: 'RECEIVED',
              identityStatus: input.identityStatus,
              identityEvidenceReference: normalized.identityEvidenceReference,
              processingRestricted: false,
              retentionAction: 'NONE',
              reason: normalized.requestSummary,
              effectiveAt: input.receivedAt,
              recordedById: input.admin.id,
            },
          },
        },
        include: rightsRequestInclude,
      });
      await tx.auditLog.create({
        data: {
          adminUserId: input.admin.id,
          action: 'data_rights.create',
          entityType: 'DataRightsRequest',
          entityId: request.id,
          metadata: { commandId: input.commandId, reference, requestType: input.requestType, targetResponseAt: input.targetResponseAt },
        },
      });
      return { request };
    },
    loadReplay: async () => ({ request: await loadRequestByCommand(input.commandId) }),
  });
};

export type UpdateDataRightsRequestInput = {
  requestId: string;
  commandId: string;
  expectedVersion: number;
  status: 'RECEIVED' | 'IDENTITY_CHECK' | 'IN_REVIEW' | 'ACTION_REQUIRED' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'REFUSED' | 'CLOSED';
  identityStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'NOT_REQUIRED';
  identityEvidenceReference?: string | null;
  processingRestricted: boolean;
  retentionAction: 'NONE' | 'KEEP_ACTIVE' | 'RESTRICTED_ARCHIVE' | 'ANONYMIZATION_REQUIRED' | 'ERASURE_REQUIRED' | 'LEGAL_HOLD';
  reason: string;
  responseEvidence?: string | null;
  legalHoldUntil?: Date | null;
  effectiveAt: Date;
  admin: AdminUser;
  now?: Date;
};

export const executeUpdateDataRightsRequest = async (
  input: UpdateDataRightsRequestInput,
): Promise<CommandOutcome<{ request: RightsRequestRecord }>> => {
  assertAdminPermission(input.admin, 'DATA_GOVERNANCE_MANAGE');
  const now = input.now ?? new Date();
  if (input.effectiveAt.getTime() > now.getTime() + FUTURE_CLOCK_TOLERANCE_MS) {
    throw new HttpError(400, 'DATA_RIGHTS_EFFECTIVE_AT_FUTURE', 'La date de décision ne peut pas être future.');
  }
  if (input.retentionAction === 'LEGAL_HOLD' && (!input.legalHoldUntil || input.legalHoldUntil <= input.effectiveAt)) {
    throw new HttpError(400, 'DATA_RIGHTS_LEGAL_HOLD_INVALID', 'Le gel juridique doit se terminer après la décision.');
  }
  const reason = input.reason.trim();
  const responseEvidence = input.responseEvidence?.trim() || null;
  const identityEvidenceReference = input.identityEvidenceReference?.trim() || null;

  return runAdminCommand({
    commandId: input.commandId,
    action: 'data_rights.update',
    entityType: 'DataRightsRequest',
    entityId: input.requestId,
    request: {
      expectedVersion: input.expectedVersion,
      status: input.status,
      identityStatus: input.identityStatus,
      identityEvidenceReference,
      processingRestricted: input.processingRestricted,
      retentionAction: input.retentionAction,
      reason,
      responseEvidence,
      legalHoldUntil: input.legalHoldUntil?.toISOString() ?? null,
      effectiveAt: input.effectiveAt.toISOString(),
    },
    admin: input.admin,
    execute: async (tx) => {
      const current = await tx.dataRightsRequest.findUnique({ where: { id: input.requestId } });
      if (!current) throw new HttpError(404, 'DATA_RIGHTS_REQUEST_NOT_FOUND', 'Demande de droits introuvable.');
      if (current.version !== input.expectedVersion) {
        throw new HttpError(409, 'DATA_RIGHTS_VERSION_CONFLICT', 'La demande a changé. Actualisez le registre.');
      }
      if (current.status === 'CLOSED') {
        throw new HttpError(409, 'DATA_RIGHTS_ALREADY_CLOSED', 'Une demande clôturée ne peut plus être modifiée.');
      }
      if (input.effectiveAt < current.receivedAt) {
        throw new HttpError(400, 'DATA_RIGHTS_CHRONOLOGY_INVALID', 'La décision ne peut pas précéder la demande.');
      }
      if (input.status === 'CLOSED' && !TERMINAL_STATUSES.has(current.status)) {
        throw new HttpError(409, 'DATA_RIGHTS_CLOSE_REQUIRES_OUTCOME', 'Enregistrez une réponse finale avant la clôture.');
      }
      if (['PARTIALLY_FULFILLED', 'FULFILLED', 'REFUSED', 'CLOSED'].includes(input.status) && !responseEvidence) {
        throw new HttpError(400, 'DATA_RIGHTS_RESPONSE_EVIDENCE_REQUIRED', 'La preuve de réponse est obligatoire pour cet état.');
      }

      const updated = await tx.dataRightsRequest.update({
        where: { id: current.id, version: input.expectedVersion },
        data: {
          status: input.status,
          identityStatus: input.identityStatus,
          identityEvidenceReference,
          processingRestricted: input.processingRestricted,
          retentionAction: input.retentionAction,
          responseSummary: reason,
          responseEvidence,
          legalHoldUntil: input.retentionAction === 'LEGAL_HOLD' ? input.legalHoldUntil : null,
          closedAt: input.status === 'CLOSED' ? input.effectiveAt : null,
          version: { increment: 1 },
          events: {
            create: {
              commandId: input.commandId,
              eventType: input.status === 'CLOSED' ? 'CLOSED' : 'UPDATED',
              fromStatus: current.status,
              toStatus: input.status,
              identityStatus: input.identityStatus,
              identityEvidenceReference,
              processingRestricted: input.processingRestricted,
              retentionAction: input.retentionAction,
              reason,
              responseEvidence,
              effectiveAt: input.effectiveAt,
              recordedById: input.admin.id,
            },
          },
        },
        include: rightsRequestInclude,
      });
      await tx.auditLog.create({
        data: {
          adminUserId: input.admin.id,
          action: 'data_rights.update',
          entityType: 'DataRightsRequest',
          entityId: current.id,
          metadata: {
            commandId: input.commandId,
            reference: current.reference,
            fromStatus: current.status,
            toStatus: input.status,
            processingRestricted: input.processingRestricted,
            retentionAction: input.retentionAction,
          },
        },
      });
      return { request: updated };
    },
    loadReplay: async () => ({ request: await loadRequestByCommand(input.commandId) }),
  });
};
