import { HttpError } from '../errors/http-error.js';
import {
  PaymentStatus,
  Prisma,
  ReservationStatus,
  type Payment,
  type Reservation,
} from '../generated/prisma/client.js';

import { paymentReferenceValidationMessage, type SupportedPaymentMethod } from '../utils/payment-reference.js';
const RESERVATION_TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  [ReservationStatus.PENDING_CONFIRMATION]: [
    ReservationStatus.CONFIRMED,
    ReservationStatus.CANCELLED,
    ReservationStatus.REJECTED,
    ReservationStatus.EXPIRED,
  ],
  [ReservationStatus.CONFIRMED]: [
    ReservationStatus.COMPLETED,
    ReservationStatus.NO_SHOW,
    ReservationStatus.CANCELLED,
  ],
  [ReservationStatus.CANCELLED]: [ReservationStatus.PENDING_CONFIRMATION],
  [ReservationStatus.REJECTED]: [ReservationStatus.PENDING_CONFIRMATION],
  [ReservationStatus.EXPIRED]: [ReservationStatus.PENDING_CONFIRMATION],
  [ReservationStatus.COMPLETED]: [],
  [ReservationStatus.NO_SHOW]: [],
};

const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [
    PaymentStatus.PAYMENT_INFO_REQUIRED,
    PaymentStatus.VERIFICATION_BLOCKED,
    PaymentStatus.VERIFIED,
    PaymentStatus.PAID,
    PaymentStatus.REJECTED,
    PaymentStatus.FAILED,
    PaymentStatus.EXPIRED,
  ],
  [PaymentStatus.PAYMENT_INFO_REQUIRED]: [
    PaymentStatus.PENDING,
    PaymentStatus.VERIFICATION_BLOCKED,
    PaymentStatus.VERIFIED,
    PaymentStatus.REJECTED,
  ],
  [PaymentStatus.VERIFICATION_BLOCKED]: [
    PaymentStatus.PENDING,
    PaymentStatus.PAYMENT_INFO_REQUIRED,
    PaymentStatus.VERIFIED,
    PaymentStatus.REJECTED,
  ],
  [PaymentStatus.VERIFIED]: [PaymentStatus.PAID, PaymentStatus.REFUND_PENDING],
  [PaymentStatus.PAID]: [PaymentStatus.REFUND_PENDING],
  [PaymentStatus.REFUND_PENDING]: [PaymentStatus.REFUNDED, PaymentStatus.FAILED],
  [PaymentStatus.REJECTED]: [PaymentStatus.PENDING],
  [PaymentStatus.FAILED]: [PaymentStatus.PENDING],
  [PaymentStatus.EXPIRED]: [PaymentStatus.PENDING],
  [PaymentStatus.REFUNDED]: [],
};

const RESERVATION_REASON_TARGETS = new Set<ReservationStatus>([
  ReservationStatus.CANCELLED,
  ReservationStatus.REJECTED,
  ReservationStatus.EXPIRED,
  ReservationStatus.NO_SHOW,
]);

const TEMPORAL_CLOSURE_TARGETS = new Set<ReservationStatus>([
  ReservationStatus.COMPLETED,
  ReservationStatus.NO_SHOW,
]);

export const isReservationEndReached = (endAt: Date, now = new Date()) => now.getTime() >= endAt.getTime();

const PAYMENT_REASON_TARGETS = new Set<PaymentStatus>([
  PaymentStatus.REJECTED,
  PaymentStatus.PAYMENT_INFO_REQUIRED,
  PaymentStatus.VERIFICATION_BLOCKED,
  PaymentStatus.FAILED,
  PaymentStatus.EXPIRED,
  PaymentStatus.REFUND_PENDING,
  PaymentStatus.REFUNDED,
]);

const RESTORABLE_RESERVATION_STATUSES = new Set<ReservationStatus>([
  ReservationStatus.CANCELLED,
  ReservationStatus.REJECTED,
  ReservationStatus.EXPIRED,
]);

const RESTORABLE_PAYMENT_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.REJECTED,
  PaymentStatus.PAYMENT_INFO_REQUIRED,
  PaymentStatus.VERIFICATION_BLOCKED,
  PaymentStatus.FAILED,
  PaymentStatus.EXPIRED,
]);

const requiredReason = (reason: string | null | undefined, code: string) => {
  const normalized = reason?.trim();
  if (!normalized) {
    throw new HttpError(400, code, 'A reason is required for this transition.');
  }
  return normalized;
};

export const allowedReservationTargets = (status: ReservationStatus) => RESERVATION_TRANSITIONS[status];

export const allowedPaymentTargets = (status: PaymentStatus) => PAYMENT_TRANSITIONS[status];

type ReservationTransitionInput = {
  toStatus: ReservationStatus;
  expectedVersion?: number;
  reason?: string | null;
  adminUserId?: string;
  actorType?: 'ADMIN' | 'CUSTOMER' | 'SYSTEM';
  metadata?: Prisma.InputJsonValue;
  temporalOverride?: boolean;
  overrideConfirmed?: boolean;
  now?: Date;
};

export const transitionReservationStatus = async (
  tx: Prisma.TransactionClient,
  reservationId: string,
  input: ReservationTransitionInput,
): Promise<Reservation> => {
  const current = await tx.reservation.findUnique({ where: { id: reservationId } });

  if (!current) {
    throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found.');
  }

  if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
    throw new HttpError(409, 'RESERVATION_VERSION_CONFLICT', 'La réservation a été modifiée. Actualisez le dossier.');
  }

  if (current.status === input.toStatus) {
    return current;
  }

  if (!RESERVATION_TRANSITIONS[current.status].includes(input.toStatus)) {
    throw new HttpError(
      409,
      'INVALID_RESERVATION_TRANSITION',
      `Cannot move reservation from ${current.status} to ${input.toStatus}.`,
      { from: current.status, to: input.toStatus, allowed: RESERVATION_TRANSITIONS[current.status] },
    );
  }

  const authorizedPayment =
    input.toStatus === ReservationStatus.CONFIRMED || input.toStatus === ReservationStatus.REJECTED
      ? await tx.payment.findFirst({
      where: {
        reservationId: current.id,
        status: { in: [PaymentStatus.VERIFIED, PaymentStatus.PAID] },
      },
      select: { id: true, amount: true },
    })
      : null;

  if (input.toStatus === ReservationStatus.CONFIRMED) {
    if (!authorizedPayment) {
      throw new HttpError(
        409,
        'PAYMENT_NOT_VERIFIED',
        'La réservation ne peut pas être confirmée avant la vérification du paiement.',
      );
    }
  }

  const now = input.now ?? new Date();
  let earlyClosureReason: string | null = null;
  let temporalOverrideMetadata: Prisma.InputJsonValue | undefined;

  if (TEMPORAL_CLOSURE_TARGETS.has(input.toStatus) && !isReservationEndReached(current.endAt, now)) {
    if (!input.temporalOverride) {
      throw new HttpError(
        409,
        'RESERVATION_END_NOT_REACHED',
        'La séance ne peut pas être clôturée avant son heure de fin réelle.',
        { endAt: current.endAt.toISOString(), now: now.toISOString() },
      );
    }
    if (!input.overrideConfirmed) {
      throw new HttpError(
        400,
        'TEMPORAL_OVERRIDE_CONFIRMATION_REQUIRED',
        'La dérogation temporelle doit être confirmée explicitement.',
      );
    }
    earlyClosureReason = requiredReason(input.reason, 'TEMPORAL_OVERRIDE_REASON_REQUIRED');
    temporalOverrideMetadata = {
      temporalOverride: {
        applied: true,
        confirmed: true,
        reason: earlyClosureReason,
        authorizedAt: now.toISOString(),
        scheduledEndAt: current.endAt.toISOString(),
      },
    };
  }

  const isRestoration =
    input.toStatus === ReservationStatus.PENDING_CONFIRMATION &&
    RESTORABLE_RESERVATION_STATUSES.has(current.status);
  const reason =
    earlyClosureReason ??
    (RESERVATION_REASON_TARGETS.has(input.toStatus) || isRestoration
      ? requiredReason(input.reason, 'RESERVATION_REASON_REQUIRED')
      : input.reason?.trim() || null);

  const result = await tx.reservation.updateMany({
    where: { id: current.id, version: current.version },
    data: {
      status: input.toStatus,
      statusReason: reason,
      statusChangedAt: now,
      version: { increment: 1 },
    },
  });

  if (result.count !== 1) {
    throw new HttpError(409, 'RESERVATION_VERSION_CONFLICT', 'Reservation changed during this request.');
  }

  await tx.reservationTransition.create({
    data: {
      reservationId: current.id,
      fromStatus: current.status,
      toStatus: input.toStatus,
      reason,
      actorType: input.actorType ?? (input.adminUserId ? 'ADMIN' : 'SYSTEM'),
      adminUserId: input.adminUserId,
      oldStartAt: current.startAt,
      oldEndAt: current.endAt,
      newStartAt: current.startAt,
      newEndAt: current.endAt,
      metadata: temporalOverrideMetadata ?? input.metadata,
    },
  });

  if (input.toStatus === ReservationStatus.REJECTED && authorizedPayment) {
    const dedupeKey = `reservation:${current.id}:v${current.version + 1}:paid-rejection:full-refund`;
    await tx.financialTask.upsert({
      where: { dedupeKey },
      update: {},
      create: {
        reservationId: current.id,
        paymentId: authorizedPayment.id,
        createdById: input.adminUserId,
        dedupeKey,
        type: 'FULL_REFUND',
        status: 'PENDING',
        amount: authorizedPayment.amount,
        currency: 'XAF',
        reason: reason ?? 'Réservation payée refusée',
        dueAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      },
    });
  }

  return tx.reservation.findUniqueOrThrow({ where: { id: current.id } });
};

type PaymentTransitionInput = {
  toStatus: PaymentStatus;
  expectedVersion?: number;
  reason?: string | null;
  adminUserId?: string;
  actorType?: 'ADMIN' | 'CUSTOMER' | 'SYSTEM';
  transactionRef?: string | null;
  transactionRefNormalized?: string | null;
  refundAmount?: number | null;
  metadata?: Prisma.InputJsonValue;
};

export const transitionPaymentStatus = async (
  tx: Prisma.TransactionClient,
  paymentId: string,
  input: PaymentTransitionInput,
): Promise<Payment> => {
  const current = await tx.payment.findUnique({ where: { id: paymentId } });

  if (!current) {
    throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Payment not found.');
  }

  if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
    throw new HttpError(409, 'PAYMENT_VERSION_CONFLICT', 'Le paiement a été modifié. Actualisez le dossier.');
  }

  if (current.status === input.toStatus) {
    return current;
  }

  if (!PAYMENT_TRANSITIONS[current.status].includes(input.toStatus)) {
    throw new HttpError(
      409,
      'INVALID_PAYMENT_TRANSITION',
      `Cannot move payment from ${current.status} to ${input.toStatus}.`,
      { from: current.status, to: input.toStatus, allowed: PAYMENT_TRANSITIONS[current.status] },
    );
  }

  const isRestoration = input.toStatus === PaymentStatus.PENDING && RESTORABLE_PAYMENT_STATUSES.has(current.status);
  const reason =
    PAYMENT_REASON_TARGETS.has(input.toStatus) || isRestoration
      ? requiredReason(input.reason, 'PAYMENT_REASON_REQUIRED')
      : input.reason?.trim() || null;

  if (input.transactionRef !== undefined) {
    const referenceIssue = paymentReferenceValidationMessage(
      current.method as SupportedPaymentMethod,
      input.transactionRef,
    );
    if (referenceIssue) {
      throw new HttpError(400, 'INVALID_PAYMENT_REFERENCE', referenceIssue);
    }
  }

  if (
    input.toStatus === PaymentStatus.REFUNDED &&
    (!input.refundAmount || input.refundAmount < 1 || input.refundAmount > current.amount)
  ) {
    throw new HttpError(400, 'INVALID_REFUND_AMOUNT', 'Refund amount must be between 1 and the payment amount.');
  }

  const result = await tx.payment.updateMany({
    where: { id: current.id, version: current.version },
    data: {
      status: input.toStatus,
      statusReason: reason,
      statusChangedAt: new Date(),
      version: { increment: 1 },
      transactionRef: input.transactionRef === undefined ? current.transactionRef : input.transactionRef,
      transactionRefNormalized:
        input.transactionRefNormalized === undefined
          ? current.transactionRefNormalized
          : input.transactionRefNormalized,
      verifiedAt:
        input.toStatus === PaymentStatus.VERIFIED || input.toStatus === PaymentStatus.PAID
          ? new Date()
          : current.verifiedAt,
      verifiedById:
        input.toStatus === PaymentStatus.VERIFIED || input.toStatus === PaymentStatus.PAID
          ? input.adminUserId
          : current.verifiedById,
      refundAmount: input.refundAmount === undefined ? current.refundAmount : input.refundAmount,
      refundedAt: input.toStatus === PaymentStatus.REFUNDED ? new Date() : current.refundedAt,
    },
  });

  if (result.count !== 1) {
    throw new HttpError(409, 'PAYMENT_VERSION_CONFLICT', 'Payment changed during this request.');
  }

  await tx.paymentTransition.create({
    data: {
      paymentId: current.id,
      fromStatus: current.status,
      toStatus: input.toStatus,
      reason,
      actorType: input.actorType ?? (input.adminUserId ? 'ADMIN' : 'SYSTEM'),
      adminUserId: input.adminUserId,
      metadata: input.metadata,
    },
  });

  return tx.payment.findUniqueOrThrow({ where: { id: current.id } });
};
