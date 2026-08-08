import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';
import {
  type AdminUser,
  type Reservation,
  type ReservationWithdrawalRequest,
} from '../generated/prisma/client.js';
import { runAdminCommand, type CommandOutcome } from './payment-reservation-commands.js';

const LEGAL_WITHDRAWAL_WINDOW_MS = 15 * 24 * 60 * 60 * 1000;
const FUTURE_CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

export const WITHDRAWAL_DECISION_EFFECT_NOTICE =
  'Aucune annulation ni aucun remboursement n’est exécuté automatiquement par cette décision.';

type WithdrawalValue = {
  request: ReservationWithdrawalRequest;
  reservation: Reservation;
};

export type CreateWithdrawalRequestInput = {
  reservationId: string;
  commandId: string;
  expectedReservationVersion: number;
  receivedAt: Date;
  requestChannel: string;
  requestText: string;
  requestEvidence: string;
  serviceStatus: 'NOT_STARTED' | 'STARTED' | 'COMPLETED';
  executionStartedAt?: Date | null;
  admin: AdminUser;
  now?: Date;
};

export const executeCreateWithdrawalRequest = async (
  input: CreateWithdrawalRequestInput,
): Promise<CommandOutcome<WithdrawalValue>> => {
  const now = input.now ?? new Date();
  const requestText = input.requestText.trim();
  const requestEvidence = input.requestEvidence.trim();
  if (input.receivedAt.getTime() > now.getTime() + FUTURE_CLOCK_TOLERANCE_MS) {
    throw new HttpError(400, 'WITHDRAWAL_RECEIVED_AT_FUTURE', 'La date de réception ne peut pas être future.');
  }
  if (input.serviceStatus === 'NOT_STARTED' && input.executionStartedAt) {
    throw new HttpError(400, 'WITHDRAWAL_EXECUTION_STATE_INVALID', 'Aucun début d’exécution ne doit être fourni pour un service non commencé.');
  }
  if (input.serviceStatus !== 'NOT_STARTED' && !input.executionStartedAt) {
    throw new HttpError(400, 'WITHDRAWAL_EXECUTION_START_REQUIRED', 'La date de début d’exécution est obligatoire pour un service commencé ou achevé.');
  }
  if (input.executionStartedAt && input.executionStartedAt > input.receivedAt) {
    throw new HttpError(400, 'WITHDRAWAL_EXECUTION_AFTER_REQUEST', 'Le début d’exécution ne peut pas être postérieur à la demande enregistrée.');
  }

  return runAdminCommand({
    commandId: input.commandId,
    action: 'reservation.withdrawal_request.create',
    entityType: 'Reservation',
    entityId: input.reservationId,
    request: {
      expectedReservationVersion: input.expectedReservationVersion,
      receivedAt: input.receivedAt.toISOString(),
      requestChannel: input.requestChannel,
      requestText,
      requestEvidence,
      serviceStatus: input.serviceStatus,
      executionStartedAt: input.executionStartedAt?.toISOString() ?? null,
    },
    admin: input.admin,
    execute: async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: input.reservationId },
        include: { snapshot: true },
      });
      if (!reservation) throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Réservation introuvable.');
      if (reservation.version !== input.expectedReservationVersion) {
        throw new HttpError(409, 'RESERVATION_VERSION_CONFLICT', 'La réservation a été modifiée. Actualisez le dossier.');
      }
      const contractConcludedAt = reservation.snapshot?.termsAcceptedAt
        ?? reservation.acceptedTermsAt
        ?? reservation.createdAt;
      if (input.receivedAt < contractConcludedAt) {
        throw new HttpError(400, 'WITHDRAWAL_BEFORE_CONTRACT', 'La demande ne peut pas précéder la conclusion du contrat.');
      }
      if (input.executionStartedAt && input.executionStartedAt < contractConcludedAt) {
        throw new HttpError(400, 'WITHDRAWAL_EXECUTION_BEFORE_CONTRACT', 'Le début d’exécution ne peut pas précéder la conclusion du contrat.');
      }
      const pending = await tx.reservationWithdrawalRequest.findFirst({
        where: { reservationId: reservation.id, status: 'PENDING' },
        select: { id: true },
      });
      if (pending) {
        throw new HttpError(409, 'WITHDRAWAL_REQUEST_PENDING', 'Une demande de rétractation est déjà en attente pour cette réservation.');
      }
      const legalDeadlineAt = new Date(contractConcludedAt.getTime() + LEGAL_WITHDRAWAL_WINDOW_MS);
      const receivedWithinLegalWindow = input.receivedAt <= legalDeadlineAt;
      const request = await tx.reservationWithdrawalRequest.create({
        data: {
          reservationId: reservation.id,
          commandId: input.commandId,
          requestedById: input.admin.id,
          reservationVersionAtRequest: reservation.version,
          contractConcludedAt,
          legalDeadlineAt,
          receivedAt: input.receivedAt,
          receivedWithinLegalWindow,
          requestChannel: input.requestChannel,
          requestText,
          requestEvidence,
          serviceStatus: input.serviceStatus,
          executionStartedAt: input.executionStartedAt ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: input.admin.id,
          action: 'reservation.withdrawal_request.create',
          entityType: 'ReservationWithdrawalRequest',
          entityId: request.id,
          metadata: {
            commandId: input.commandId,
            reservationId: reservation.id,
            reservationReference: reservation.reference,
            actorRole: input.admin.role,
            receivedAt: input.receivedAt,
            serviceStatus: input.serviceStatus,
            receivedWithinLegalWindow,
            result: 'SUCCESS',
          },
        },
      });
      return { request, reservation };
    },
    loadReplay: async () => {
      const request = await prisma.reservationWithdrawalRequest.findUniqueOrThrow({
        where: { commandId: input.commandId },
      });
      const reservation = await prisma.reservation.findUniqueOrThrow({ where: { id: request.reservationId } });
      return { request, reservation };
    },
  });
};

export type DecideWithdrawalRequestInput = {
  requestId: string;
  commandId: string;
  expectedVersion: number;
  decision: 'ACCEPTED' | 'REJECTED';
  reason: string;
  admin: AdminUser;
  now?: Date;
};

export const executeWithdrawalRequestDecision = async (
  input: DecideWithdrawalRequestInput,
): Promise<CommandOutcome<WithdrawalValue>> => {
  const reason = input.reason.trim();
  if (!reason) {
    throw new HttpError(400, 'WITHDRAWAL_DECISION_REASON_REQUIRED', 'Le motif de la décision est obligatoire.');
  }
  const action = input.decision === 'ACCEPTED'
    ? 'reservation.withdrawal_request.accept'
    : 'reservation.withdrawal_request.reject';

  return runAdminCommand({
    commandId: input.commandId,
    action,
    entityType: 'ReservationWithdrawalRequest',
    entityId: input.requestId,
    request: { expectedVersion: input.expectedVersion, decision: input.decision, reason },
    admin: input.admin,
    execute: async (tx) => {
      const current = await tx.reservationWithdrawalRequest.findUnique({ where: { id: input.requestId } });
      if (!current) throw new HttpError(404, 'WITHDRAWAL_REQUEST_NOT_FOUND', 'Demande de rétractation introuvable.');
      if (current.version !== input.expectedVersion) {
        throw new HttpError(409, 'WITHDRAWAL_VERSION_CONFLICT', 'La demande a été modifiée. Actualisez le dossier.');
      }
      if (current.status !== 'PENDING') {
        throw new HttpError(409, 'WITHDRAWAL_ALREADY_DECIDED', 'Cette demande de rétractation a déjà été décidée.');
      }
      const updated = await tx.reservationWithdrawalRequest.updateMany({
        where: { id: current.id, version: current.version, status: 'PENDING' },
        data: {
          status: input.decision,
          version: { increment: 1 },
          decisionReason: reason,
          decidedById: input.admin.id,
          decidedAt: input.now ?? new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new HttpError(409, 'WITHDRAWAL_VERSION_CONFLICT', 'La demande a changé pendant la décision.');
      }
      const request = await tx.reservationWithdrawalRequest.findUniqueOrThrow({ where: { id: current.id } });
      const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: current.reservationId } });
      await tx.auditLog.create({
        data: {
          adminUserId: input.admin.id,
          action,
          entityType: 'ReservationWithdrawalRequest',
          entityId: request.id,
          metadata: {
            commandId: input.commandId,
            reservationId: reservation.id,
            reservationReference: reservation.reference,
            actorRole: input.admin.role,
            decision: input.decision,
            reason,
            automaticCancellation: false,
            automaticRefund: false,
            result: 'SUCCESS',
          },
        },
      });
      return { request, reservation };
    },
    loadReplay: async () => {
      const request = await prisma.reservationWithdrawalRequest.findUniqueOrThrow({ where: { id: input.requestId } });
      const reservation = await prisma.reservation.findUniqueOrThrow({ where: { id: request.reservationId } });
      return { request, reservation };
    },
  });
};
