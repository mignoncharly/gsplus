import { createHash } from 'node:crypto';

import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';
import {
  PaymentStatus,
  Prisma,
  ReservationStatus,
  type AdminUser,
  type FinancialTask,
  type Payment,
  type Reservation,
} from '../generated/prisma/client.js';
import { transitionPaymentStatus, transitionReservationStatus } from './status-transitions.js';
import {
  normalizePaymentReference,
  paymentReferenceValidationMessage,
  type SupportedPaymentMethod,
} from '../utils/payment-reference.js';

export type CommandOutcome<T> = {
  commandId: string;
  replayed: boolean;
  value: T;
};

export type RunCommandInput<T> = {
  commandId: string;
  action: string;
  entityType: string;
  entityId: string;
  request: unknown;
  admin: AdminUser;
  execute: (tx: Prisma.TransactionClient) => Promise<T>;
  loadReplay: () => Promise<T>;
};

const requestHash = (request: unknown) =>
  createHash('sha256').update(JSON.stringify(request)).digest('hex');

const validateReplay = (
  command: { action: string; entityType: string; entityId: string; requestHash: string; status: string },
  expected: { action: string; entityType: string; entityId: string; requestHash: string },
) => {
  if (
    command.action !== expected.action ||
    command.entityType !== expected.entityType ||
    command.entityId !== expected.entityId ||
    command.requestHash !== expected.requestHash
  ) {
    throw new HttpError(
      409,
      'COMMAND_ID_REUSED',
      'Cet identifiant de commande a déjà été utilisé pour une autre décision.',
    );
  }
  if (command.status !== 'COMPLETED') {
    throw new HttpError(409, 'COMMAND_IN_PROGRESS', 'Cette commande est encore en cours de traitement.');
  }
};

const isUniqueConflict = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export const runAdminCommand = async <T>(input: RunCommandInput<T>): Promise<CommandOutcome<T>> => {
  const hash = requestHash(input.request);
  const expected = {
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    requestHash: hash,
  };
  const existing = await prisma.adminCommand.findUnique({ where: { id: input.commandId } });
  if (existing) {
    validateReplay(existing, expected);
    return { commandId: input.commandId, replayed: true, value: await input.loadReplay() };
  }

  try {
    const value = await prisma.$transaction(async (tx) => {
      await tx.adminCommand.create({
        data: {
          id: input.commandId,
          ...expected,
          adminUserId: input.admin.id,
        },
      });
      const result = await input.execute(tx);
      await tx.adminCommand.update({
        where: { id: input.commandId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: { completed: true },
        },
      });
      return result;
    });
    return { commandId: input.commandId, replayed: false, value };
  } catch (error) {
    if (isUniqueConflict(error)) {
      const raced = await prisma.adminCommand.findUnique({ where: { id: input.commandId } });
      if (raced) {
        validateReplay(raced, expected);
        return { commandId: input.commandId, replayed: true, value: await input.loadReplay() };
      }
    }

    await prisma.auditLog
      .create({
        data: {
          adminUserId: input.admin.id,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          metadata: {
            commandId: input.commandId,
            actorRole: input.admin.role,
            result: 'FAILURE',
            errorCode: error instanceof HttpError ? error.code : 'INTERNAL_ERROR',
          },
        },
      })
      .catch(() => undefined);
    throw error;
  }
};

const paymentAction = (status: PaymentStatus) => {
  if (status === PaymentStatus.VERIFIED) return 'payment.verify';
  if (status === PaymentStatus.REJECTED) return 'payment.reject';
  if (status === PaymentStatus.PAYMENT_INFO_REQUIRED) return 'payment.request_info';
  if (status === PaymentStatus.VERIFICATION_BLOCKED) return 'payment.block_verification';
  if (status === PaymentStatus.PENDING) return 'payment.resume_verification';
  return 'payment.update';
};

export type PaymentDecisionInput = {
  paymentId: string;
  commandId: string;
  expectedVersion: number;
  status: PaymentStatus;
  reason?: string | null;
  transactionRef?: string | null;
  transactionRefNormalized?: string | null;
  admin: AdminUser;
};

type PaymentDecisionValue = { payment: Payment; reservation: Reservation };

const ACTIVE_PAYMENT_STATUSES = [
  PaymentStatus.PENDING,
  PaymentStatus.PAYMENT_INFO_REQUIRED,
  PaymentStatus.VERIFICATION_BLOCKED,
  PaymentStatus.VERIFIED,
  PaymentStatus.PAID,
  PaymentStatus.REFUND_PENDING,
] as const;

export type AddPaymentInput = {
  reservationId: string;
  commandId: string;
  expectedReservationVersion: number;
  method: SupportedPaymentMethod;
  paymentPhone: string;
  transactionRef: string;
  admin: AdminUser;
};

export const executeAddPayment = async (
  input: AddPaymentInput,
): Promise<CommandOutcome<PaymentDecisionValue>> => {
  const transactionRef = input.transactionRef.trim();
  const transactionRefNormalized = normalizePaymentReference(transactionRef);
  const referenceIssue = paymentReferenceValidationMessage(input.method, transactionRef);
  if (referenceIssue || !transactionRefNormalized) {
    throw new HttpError(400, 'INVALID_PAYMENT_REFERENCE', referenceIssue ?? 'Référence de paiement invalide.');
  }

  return runAdminCommand({
    commandId: input.commandId,
    action: 'payment.add',
    entityType: 'Reservation',
    entityId: input.reservationId,
    request: {
      expectedReservationVersion: input.expectedReservationVersion,
      method: input.method,
      paymentPhone: input.paymentPhone,
      transactionRef,
    },
    admin: input.admin,
    execute: async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: input.reservationId },
        include: { snapshot: true, payments: true },
      });
      if (!reservation) throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Réservation introuvable.');
      if (!reservation.snapshot) {
        throw new HttpError(409, 'RESERVATION_SNAPSHOT_REQUIRED', 'Le snapshot de réservation est absent.');
      }
      if (reservation.version !== input.expectedReservationVersion) {
        throw new HttpError(409, 'RESERVATION_VERSION_CONFLICT', 'La réservation a été modifiée. Actualisez le dossier.');
      }
      if (reservation.status !== ReservationStatus.PENDING_CONFIRMATION) {
        throw new HttpError(
          409,
          'PAYMENT_ADD_RESERVATION_STATUS',
          'Un paiement ne peut être ajouté qu’à une réservation en attente de confirmation.',
        );
      }
      if (reservation.payments.some((payment) => ACTIVE_PAYMENT_STATUSES.includes(payment.status as typeof ACTIVE_PAYMENT_STATUSES[number]))) {
        throw new HttpError(409, 'ACTIVE_PAYMENT_EXISTS', 'Un paiement actif existe déjà pour cette réservation.');
      }
      const reusedReference = await tx.payment.findFirst({
        where: { method: input.method, transactionRefNormalized },
        select: { id: true },
      });
      if (reusedReference) {
        throw new HttpError(409, 'PAYMENT_REFERENCE_ALREADY_USED', 'Cette référence de paiement est déjà utilisée.');
      }

      const versionUpdate = await tx.reservation.updateMany({
        where: { id: reservation.id, version: reservation.version },
        data: { version: { increment: 1 } },
      });
      if (versionUpdate.count !== 1) {
        throw new HttpError(409, 'RESERVATION_VERSION_CONFLICT', 'La réservation a été modifiée pendant cette requête.');
      }
      const payment = await tx.payment.create({
        data: {
          reservationId: reservation.id,
          amount: reservation.snapshot.amount,
          method: input.method,
          paymentPhone: input.paymentPhone,
          transactionRef,
          transactionRefNormalized,
          status: PaymentStatus.PENDING,
          transitions: {
            create: {
              fromStatus: null,
              toStatus: PaymentStatus.PENDING,
              actorType: 'ADMIN',
              adminUserId: input.admin.id,
              metadata: { commandId: input.commandId, addedToExistingReservation: true },
            },
          },
        },
      });
      const updatedReservation = await tx.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
      await tx.auditLog.create({
        data: {
          adminUserId: input.admin.id,
          action: 'payment.add',
          entityType: 'Payment',
          entityId: payment.id,
          metadata: {
            commandId: input.commandId,
            reservationId: reservation.id,
            actorRole: input.admin.role,
            method: input.method,
            amount: payment.amount,
            transactionReferenceMasked: `•••• ${transactionRef.slice(-4)}`,
            result: 'SUCCESS',
          },
        },
      });
      return { payment, reservation: updatedReservation };
    },
    loadReplay: async () => {
      const payment = await prisma.payment.findFirst({
        where: { reservationId: input.reservationId, method: input.method, transactionRefNormalized },
      });
      if (!payment) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Paiement ajouté introuvable.');
      const reservation = await prisma.reservation.findUniqueOrThrow({ where: { id: input.reservationId } });
      return { payment, reservation };
    },
  });
};

export const executePaymentDecision = async (
  input: PaymentDecisionInput,
): Promise<CommandOutcome<PaymentDecisionValue>> => {
  const action = paymentAction(input.status);
  return runAdminCommand({
    commandId: input.commandId,
    action,
    entityType: 'Payment',
    entityId: input.paymentId,
    request: {
      expectedVersion: input.expectedVersion,
      status: input.status,
      reason: input.reason?.trim() || null,
      transactionRef: input.transactionRef ?? null,
    },
    admin: input.admin,
    execute: async (tx) => {
      const before = await tx.payment.findUnique({ where: { id: input.paymentId } });
      if (!before) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable.');
      const payment = await transitionPaymentStatus(tx, input.paymentId, {
        toStatus: input.status,
        expectedVersion: input.expectedVersion,
        reason: input.reason,
        adminUserId: input.admin.id,
        actorType: 'ADMIN',
        transactionRef: input.transactionRef,
        transactionRefNormalized: input.transactionRefNormalized,
        metadata: { commandId: input.commandId },
      });
      const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: payment.reservationId } });
      await tx.auditLog.create({
        data: {
          adminUserId: input.admin.id,
          action,
          entityType: 'Payment',
          entityId: payment.id,
          metadata: {
            commandId: input.commandId,
            actorRole: input.admin.role,
            oldPaymentStatus: before.status,
            newPaymentStatus: payment.status,
            reservationStatus: reservation.status,
            reason: input.reason?.trim() || null,
            transactionReferenceUpdated: input.transactionRef !== undefined,
            result: 'SUCCESS',
          },
        },
      });
      return { payment, reservation };
    },
    loadReplay: async () => {
      const payment = await prisma.payment.findUnique({ where: { id: input.paymentId } });
      if (!payment) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable.');
      const reservation = await prisma.reservation.findUniqueOrThrow({ where: { id: payment.reservationId } });
      return { payment, reservation };
    },
  });
};

export type ReservationDecisionInput = {
  reservationId: string;
  commandId: string;
  expectedVersion: number;
  status: typeof ReservationStatus.CONFIRMED | typeof ReservationStatus.REJECTED;
  reason?: string | null;
  admin: AdminUser;
};

export const executeReservationDecision = async (
  input: ReservationDecisionInput,
): Promise<CommandOutcome<Reservation>> => {
  const action =
    input.status === ReservationStatus.CONFIRMED ? 'reservation.confirm' : 'reservation.reject';
  return runAdminCommand({
    commandId: input.commandId,
    action,
    entityType: 'Reservation',
    entityId: input.reservationId,
    request: {
      expectedVersion: input.expectedVersion,
      status: input.status,
      reason: input.reason?.trim() || null,
    },
    admin: input.admin,
    execute: async (tx) => {
      const before = await tx.reservation.findUnique({ where: { id: input.reservationId } });
      if (!before) throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Réservation introuvable.');
      const reservation = await transitionReservationStatus(tx, input.reservationId, {
        toStatus: input.status,
        expectedVersion: input.expectedVersion,
        reason: input.reason,
        adminUserId: input.admin.id,
        actorType: 'ADMIN',
        metadata: { commandId: input.commandId },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: input.admin.id,
          action,
          entityType: 'Reservation',
          entityId: reservation.id,
          metadata: {
            commandId: input.commandId,
            actorRole: input.admin.role,
            oldReservationStatus: before.status,
            newReservationStatus: reservation.status,
            reason: input.reason?.trim() || null,
            result: 'SUCCESS',
          },
        },
      });
      return reservation;
    },
    loadReplay: () => prisma.reservation.findUniqueOrThrow({ where: { id: input.reservationId } }),
  });
};

export type VerifyAndConfirmInput = {
  reservationId: string;
  paymentId: string;
  commandId: string;
  expectedPaymentVersion: number;
  expectedReservationVersion: number;
  reason?: string | null;
  transactionRef?: string | null;
  transactionRefNormalized?: string | null;
  admin: AdminUser;
};

type VerifyAndConfirmValue = { payment: Payment; reservation: Reservation };

export const executeVerifyAndConfirm = async (
  input: VerifyAndConfirmInput,
): Promise<CommandOutcome<VerifyAndConfirmValue>> =>
  runAdminCommand({
    commandId: input.commandId,
    action: 'payment.verify_and_reservation.confirm',
    entityType: 'Reservation',
    entityId: input.reservationId,
    request: {
      paymentId: input.paymentId,
      expectedPaymentVersion: input.expectedPaymentVersion,
      expectedReservationVersion: input.expectedReservationVersion,
      reason: input.reason?.trim() || null,
      transactionRef: input.transactionRef ?? null,
    },
    admin: input.admin,
    execute: async (tx) => {
      const beforePayment = await tx.payment.findUnique({ where: { id: input.paymentId } });
      const beforeReservation = await tx.reservation.findUnique({ where: { id: input.reservationId } });
      if (!beforePayment) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable.');
      if (!beforeReservation) throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Réservation introuvable.');
      if (beforePayment.reservationId !== input.reservationId) {
        throw new HttpError(409, 'PAYMENT_RESERVATION_MISMATCH', 'Ce paiement ne correspond pas à la réservation.');
      }

      const payment = await transitionPaymentStatus(tx, input.paymentId, {
        toStatus: PaymentStatus.VERIFIED,
        expectedVersion: input.expectedPaymentVersion,
        reason: input.reason,
        adminUserId: input.admin.id,
        actorType: 'ADMIN',
        transactionRef: input.transactionRef,
        transactionRefNormalized: input.transactionRefNormalized,
        metadata: { commandId: input.commandId, combined: true },
      });
      const reservation = await transitionReservationStatus(tx, input.reservationId, {
        toStatus: ReservationStatus.CONFIRMED,
        expectedVersion: input.expectedReservationVersion,
        reason: input.reason,
        adminUserId: input.admin.id,
        actorType: 'ADMIN',
        metadata: { commandId: input.commandId, combined: true },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: input.admin.id,
          action: 'payment.verify_and_reservation.confirm',
          entityType: 'Reservation',
          entityId: reservation.id,
          metadata: {
            commandId: input.commandId,
            paymentId: payment.id,
            actorRole: input.admin.role,
            oldPaymentStatus: beforePayment.status,
            newPaymentStatus: payment.status,
            oldReservationStatus: beforeReservation.status,
            newReservationStatus: reservation.status,
            reason: input.reason?.trim() || null,
            transactionReferenceUpdated: input.transactionRef !== undefined,
            result: 'SUCCESS',
          },
        },
      });
      return { payment, reservation };
    },
    loadReplay: async () => {
      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
      const reservation = await prisma.reservation.findUniqueOrThrow({ where: { id: input.reservationId } });
      return { payment, reservation };
    },
  });

export type CancellationOrigin = 'CUSTOMER' | 'STUDIO';

export type CancellationDecisionInput = {
  reservationId: string;
  commandId: string;
  expectedVersion: number;
  origin: CancellationOrigin;
  reason: string;
  admin: AdminUser;
  now?: Date;
};

type CancellationDecisionValue = {
  reservation: Reservation;
  financialTask: FinancialTask | null;
};

const CANCELLATION_THRESHOLD_MS = 48 * 60 * 60 * 1000;

export const executeCancellationDecision = async (
  input: CancellationDecisionInput,
): Promise<CommandOutcome<CancellationDecisionValue>> => {
  const reason = input.reason.trim();
  if (!reason) {
    throw new HttpError(400, 'CANCELLATION_REASON_REQUIRED', 'Le motif de l’annulation est obligatoire.');
  }
  const requestedAt = input.now ?? new Date();

  return runAdminCommand({
    commandId: input.commandId,
    action: 'reservation.cancel',
    entityType: 'Reservation',
    entityId: input.reservationId,
    request: {
      expectedVersion: input.expectedVersion,
      origin: input.origin,
      reason,
    },
    admin: input.admin,
    execute: async (tx) => {
      const before = await tx.reservation.findUnique({ where: { id: input.reservationId } });
      if (!before) throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Réservation introuvable.');
      const payment = await tx.payment.findFirst({
        where: {
          reservationId: before.id,
          status: { in: [PaymentStatus.VERIFIED, PaymentStatus.PAID] },
        },
        orderBy: { createdAt: 'desc' },
      });
      const leadTimeMs = before.startAt.getTime() - requestedAt.getTime();
      const customerRefundable = input.origin === 'CUSTOMER' && leadTimeMs > CANCELLATION_THRESHOLD_MS;
      const refundAmount = payment
        ? input.origin === 'STUDIO'
          ? payment.amount
          : customerRefundable
            ? Math.floor(payment.amount / 2)
            : 0
        : 0;
      const taskType = input.origin === 'STUDIO' ? 'FULL_REFUND' : 'PARTIAL_REFUND';
      const policy = {
        origin: input.origin,
        requestedAt: requestedAt.toISOString(),
        leadTimeMs,
        thresholdHours: 48,
        paidAmount: payment?.amount ?? 0,
        refundableAmount: refundAmount,
        taskType: refundAmount > 0 ? taskType : null,
      };
      const reservation = await transitionReservationStatus(tx, input.reservationId, {
        toStatus: ReservationStatus.CANCELLED,
        expectedVersion: input.expectedVersion,
        reason,
        adminUserId: input.admin.id,
        actorType: 'ADMIN',
        metadata: { commandId: input.commandId, cancellationPolicy: policy },
        now: requestedAt,
      });
      const dedupeKey =
        `reservation:${before.id}:v${reservation.version}:cancellation:${input.origin.toLowerCase()}:${taskType.toLowerCase()}`;
      const financialTask = payment && refundAmount > 0
        ? await tx.financialTask.upsert({
            where: { dedupeKey },
            update: {},
            create: {
              reservationId: before.id,
              paymentId: payment.id,
              createdById: input.admin.id,
              dedupeKey,
              type: taskType,
              status: 'PENDING',
              amount: refundAmount,
              currency: 'XAF',
              reason,
              dueAt: new Date(requestedAt.getTime() + CANCELLATION_THRESHOLD_MS),
            },
          })
        : null;
      await tx.auditLog.create({
        data: {
          adminUserId: input.admin.id,
          action: 'reservation.cancel',
          entityType: 'Reservation',
          entityId: reservation.id,
          metadata: {
            commandId: input.commandId,
            actorRole: input.admin.role,
            oldReservationStatus: before.status,
            newReservationStatus: reservation.status,
            reason,
            cancellationPolicy: policy,
            financialTaskId: financialTask?.id ?? null,
            result: 'SUCCESS',
          },
        },
      });
      return { reservation, financialTask };
    },
    loadReplay: async () => {
      const reservation = await prisma.reservation.findUniqueOrThrow({ where: { id: input.reservationId } });
      const financialTask = await prisma.financialTask.findFirst({
        where: { reservationId: input.reservationId, type: { in: ['FULL_REFUND', 'PARTIAL_REFUND'] } },
        orderBy: { createdAt: 'desc' },
      });
      return { reservation, financialTask };
    },
  });
};

export type RefundDecisionInput = {
  paymentId: string;
  commandId: string;
  expectedVersion: number;
  status: typeof PaymentStatus.REFUND_PENDING | typeof PaymentStatus.REFUNDED;
  refundAmount: number;
  channel: string;
  providerReference: string;
  reason: string;
  admin: AdminUser;
};

type RefundDecisionValue = {
  payment: Payment;
  reservation: Reservation;
  financialTask: FinancialTask;
};

export const executeRefundDecision = async (
  input: RefundDecisionInput,
): Promise<CommandOutcome<RefundDecisionValue>> => {
  const channel = input.channel.trim();
  const providerReference = input.providerReference.trim();
  const reason = input.reason.trim();
  if (!channel || !providerReference || !reason) {
    throw new HttpError(
      400,
      'REFUND_EVIDENCE_REQUIRED',
      'Le canal, la référence opérateur et le motif du remboursement sont obligatoires.',
    );
  }

  const action = input.status === PaymentStatus.REFUNDED ? 'payment.refund.complete' : 'payment.refund.engage';
  return runAdminCommand({
    commandId: input.commandId,
    action,
    entityType: 'Payment',
    entityId: input.paymentId,
    request: {
      expectedVersion: input.expectedVersion,
      status: input.status,
      refundAmount: input.refundAmount,
      channel,
      providerReference,
      reason,
    },
    admin: input.admin,
    execute: async (tx) => {
      const before = await tx.payment.findUnique({ where: { id: input.paymentId } });
      if (!before) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable.');
      const task = await tx.financialTask.findFirst({
        where: { paymentId: input.paymentId, type: { in: ['FULL_REFUND', 'PARTIAL_REFUND'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (!task) {
        throw new HttpError(
          409,
          'REFUND_TASK_REQUIRED',
          'Aucune obligation financière durable ne permet ce remboursement.',
        );
      }
      const expectedTaskStatus =
        input.status === PaymentStatus.REFUNDED ? 'IN_PROGRESS' : 'PENDING';
      if (task.status !== expectedTaskStatus) {
        throw new HttpError(
          409,
          'INVALID_REFUND_TASK_STATUS',
          `La tâche financière est ${task.status}; le statut attendu est ${expectedTaskStatus}.`,
        );
      }
      if (input.refundAmount !== task.amount) {
        throw new HttpError(
          400,
          'INVALID_REFUND_AMOUNT',
          `Le remboursement attendu est de ${task.amount} FCFA.`,
        );
      }

      const now = new Date();
      const payment = await transitionPaymentStatus(tx, input.paymentId, {
        toStatus: input.status,
        expectedVersion: input.expectedVersion,
        reason,
        adminUserId: input.admin.id,
        actorType: 'ADMIN',
        refundAmount: input.refundAmount,
        metadata: {
          commandId: input.commandId,
          financialTaskId: task.id,
          refundChannel: channel,
          providerReference,
        },
      });
      const financialTask = await tx.financialTask.update({
        where: { id: task.id },
        data: input.status === PaymentStatus.REFUNDED
          ? {
              status: 'COMPLETED',
              channel,
              providerReference,
              completedAt: now,
              proof: {
                channel,
                providerReference,
                recordedAt: now.toISOString(),
                recordedById: input.admin.id,
              },
            }
          : {
              status: 'IN_PROGRESS',
              channel,
              providerReference,
              initiatedAt: now,
            },
      });
      const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: payment.reservationId } });
      await tx.auditLog.create({
        data: {
          adminUserId: input.admin.id,
          action,
          entityType: 'Payment',
          entityId: payment.id,
          metadata: {
            commandId: input.commandId,
            financialTaskId: financialTask.id,
            actorRole: input.admin.role,
            oldPaymentStatus: before.status,
            newPaymentStatus: payment.status,
            refundAmount: input.refundAmount,
            channel,
            providerReference,
            result: 'SUCCESS',
          },
        },
      });
      return { payment, reservation, financialTask };
    },
    loadReplay: async () => {
      const payment = await prisma.payment.findUnique({ where: { id: input.paymentId } });
      if (!payment) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable.');
      const [reservation, financialTask] = await Promise.all([
        prisma.reservation.findUniqueOrThrow({ where: { id: payment.reservationId } }),
        prisma.financialTask.findFirstOrThrow({
          where: { paymentId: input.paymentId, type: { in: ['FULL_REFUND', 'PARTIAL_REFUND'] } },
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      return { payment, reservation, financialTask };
    },
  });
};
