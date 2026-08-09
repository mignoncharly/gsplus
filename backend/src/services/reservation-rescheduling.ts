import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';
import {
  ReservationStatus,
  type AdminUser,
  type Reservation,
  type ReservationRescheduleRequest,
} from '../generated/prisma/client.js';
import { addMinutes, assertBookableSlot, lockBookingWindow } from './booking-slots.js';
import { runAdminCommand, type CommandOutcome } from './payment-reservation-commands.js';

const RESCHEDULABLE_STATUSES = new Set<ReservationStatus>([
  ReservationStatus.PENDING_CONFIRMATION,
  ReservationStatus.CONFIRMED,
]);
const RESCHEDULE_NOTICE_MS = 48 * 60 * 60 * 1000;

type RescheduleRequestValue = {
  request: ReservationRescheduleRequest;
  reservation: Reservation;
};

export type CreateRescheduleRequestInput = {
  reservationId: string;
  commandId: string;
  expectedReservationVersion: number;
  requestedStartAt: Date;
  reason: string;
  admin: AdminUser;
  now?: Date;
};

export const executeCreateRescheduleRequest = async (
  input: CreateRescheduleRequestInput,
): Promise<CommandOutcome<RescheduleRequestValue>> => {
  const reason = input.reason.trim();
  if (!reason) {
    throw new HttpError(400, 'RESCHEDULE_REASON_REQUIRED', 'Le motif de la demande de report est obligatoire.');
  }
  const requestedAt = input.now ?? new Date();

  return runAdminCommand({
    commandId: input.commandId,
    action: 'reservation.reschedule_request.create',
    entityType: 'Reservation',
    entityId: input.reservationId,
    request: {
      expectedReservationVersion: input.expectedReservationVersion,
      requestedStartAt: input.requestedStartAt.toISOString(),
      reason,
    },
    admin: input.admin,
    execute: async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: input.reservationId },
        include: { packageVersion: true },
      });
      if (!reservation) throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Réservation introuvable.');
      if (reservation.version !== input.expectedReservationVersion) {
        throw new HttpError(409, 'RESERVATION_VERSION_CONFLICT', 'La réservation a été modifiée. Actualisez le dossier.');
      }
      if (!RESCHEDULABLE_STATUSES.has(reservation.status)) {
        throw new HttpError(409, 'RESERVATION_NOT_RESCHEDULABLE', 'Cette réservation ne peut pas être reportée.');
      }
      if (reservation.startAt.getTime() === input.requestedStartAt.getTime()) {
        throw new HttpError(409, 'SCHEDULE_UNCHANGED', 'Le nouveau créneau doit être différent.');
      }
      if (input.requestedStartAt <= requestedAt) {
        throw new HttpError(400, 'RESCHEDULE_SLOT_IN_PAST', 'Le créneau demandé doit être futur.');
      }
      const pending = await tx.reservationRescheduleRequest.findFirst({
        where: { reservationId: reservation.id, status: 'PENDING' },
      });
      if (pending) {
        throw new HttpError(409, 'RESCHEDULE_REQUEST_PENDING', 'Une demande de report est déjà en attente.');
      }
      if (reservation.packageVersion.durationMin === null) {
        throw new HttpError(409, 'PACKAGE_DURATION_MISSING', 'La durée historique de cette formule est absente.');
      }
      const requestedEndAt = addMinutes(input.requestedStartAt, reservation.packageVersion.durationMin);
      const acceptedCount = await tx.reservationRescheduleRequest.count({
        where: { reservationId: reservation.id, status: 'ACCEPTED' },
      });
      const leadTimeMs = reservation.startAt.getTime() - requestedAt.getTime();
      const request = await tx.reservationRescheduleRequest.create({
        data: {
          reservationId: reservation.id,
          commandId: input.commandId,
          requestedById: input.admin.id,
          reservationVersionAtRequest: reservation.version,
          oldStartAt: reservation.startAt,
          oldEndAt: reservation.endAt,
          requestedStartAt: input.requestedStartAt,
          requestedEndAt,
          reason,
          requestedAt,
        },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: input.admin.id,
          action: 'reservation.reschedule_request.create',
          entityType: 'ReservationRescheduleRequest',
          entityId: request.id,
          metadata: {
            commandId: input.commandId,
            reservationId: reservation.id,
            actorRole: input.admin.role,
            oldStartAt: reservation.startAt,
            oldEndAt: reservation.endAt,
            requestedStartAt: input.requestedStartAt,
            requestedEndAt,
            leadTimeMs,
            acceptedCount,
            reason,
            result: 'SUCCESS',
          },
        },
      });
      return { request, reservation };
    },
    loadReplay: async () => {
      const [request, reservation] = await Promise.all([
        prisma.reservationRescheduleRequest.findUniqueOrThrow({ where: { commandId: input.commandId } }),
        prisma.reservation.findUniqueOrThrow({ where: { id: input.reservationId } }),
      ]);
      return { request, reservation };
    },
  });
};

export type DecideRescheduleRequestInput = {
  requestId: string;
  commandId: string;
  expectedVersion: number;
  decision: 'ACCEPTED' | 'REJECTED';
  reason: string;
  admin: AdminUser;
  now?: Date;
};

export const executeRescheduleRequestDecision = async (
  input: DecideRescheduleRequestInput,
): Promise<CommandOutcome<RescheduleRequestValue>> => {
  const reason = input.reason.trim();
  if (!reason) {
    throw new HttpError(400, 'RESCHEDULE_DECISION_REASON_REQUIRED', 'Le motif de la décision est obligatoire.');
  }
  const decidedAt = input.now ?? new Date();

  return runAdminCommand({
    commandId: input.commandId,
    action: input.decision === 'ACCEPTED'
      ? 'reservation.reschedule_request.accept'
      : 'reservation.reschedule_request.reject',
    entityType: 'ReservationRescheduleRequest',
    entityId: input.requestId,
    request: { expectedVersion: input.expectedVersion, decision: input.decision, reason },
    admin: input.admin,
    execute: async (tx) => {
      const current = await tx.reservationRescheduleRequest.findUnique({
        where: { id: input.requestId },
        include: { reservation: { include: { package: true, packageVersion: true } } },
      });
      if (!current) throw new HttpError(404, 'RESCHEDULE_REQUEST_NOT_FOUND', 'Demande de report introuvable.');
      if (current.version !== input.expectedVersion) {
        throw new HttpError(409, 'RESCHEDULE_REQUEST_VERSION_CONFLICT', 'La demande a été modifiée. Actualisez le dossier.');
      }
      if (current.status !== 'PENDING') {
        throw new HttpError(409, 'RESCHEDULE_REQUEST_ALREADY_DECIDED', 'Cette demande a déjà reçu une décision.');
      }

      let reservation: Reservation = current.reservation;
      if (input.decision === 'ACCEPTED') {
        const leadTimeMs = current.oldStartAt.getTime() - current.requestedAt.getTime();
        if (leadTimeMs < RESCHEDULE_NOTICE_MS) {
          throw new HttpError(
            409,
            'RESCHEDULE_NOTICE_TOO_SHORT',
            'Un report ne peut être accepté que si la demande a été reçue au moins 48 heures avant le créneau initial.',
          );
        }
        const acceptedCount = await tx.reservationRescheduleRequest.count({
          where: { reservationId: reservation.id, status: 'ACCEPTED' },
        });
        if (acceptedCount >= 1) {
          throw new HttpError(409, 'RESCHEDULE_LIMIT_REACHED', 'Un report a déjà été accordé à cette réservation.');
        }
        if (
          reservation.version !== current.reservationVersionAtRequest ||
          reservation.startAt.getTime() !== current.oldStartAt.getTime() ||
          reservation.endAt.getTime() !== current.oldEndAt.getTime()
        ) {
          throw new HttpError(409, 'RESCHEDULE_REQUEST_STALE', 'Le créneau initial a changé depuis la demande.');
        }
        if (!RESCHEDULABLE_STATUSES.has(reservation.status)) {
          throw new HttpError(409, 'RESERVATION_NOT_RESCHEDULABLE', 'Cette réservation ne peut plus être reportée.');
        }
        await lockBookingWindow(tx, current.requestedStartAt, current.requestedEndAt);
        await assertBookableSlot(
          tx,
          current.reservation.package,
          current.requestedStartAt,
          current.requestedEndAt,
          { excludeReservationId: reservation.id },
        );
        const updated = await tx.reservation.updateMany({
          where: { id: reservation.id, version: reservation.version },
          data: {
            startAt: current.requestedStartAt,
            endAt: current.requestedEndAt,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new HttpError(409, 'RESERVATION_VERSION_CONFLICT', 'La réservation a changé pendant la décision.');
        }
        reservation = await tx.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
        await tx.reservationTransition.create({
          data: {
            reservationId: reservation.id,
            fromStatus: reservation.status,
            toStatus: reservation.status,
            reason,
            actorType: 'ADMIN',
            adminUserId: input.admin.id,
            oldStartAt: current.oldStartAt,
            oldEndAt: current.oldEndAt,
            newStartAt: current.requestedStartAt,
            newEndAt: current.requestedEndAt,
            metadata: {
              kind: 'RESCHEDULE',
              rescheduleRequestId: current.id,
              commandId: input.commandId,
            },
          },
        });
      }

      const request = await tx.reservationRescheduleRequest.update({
        where: { id: current.id },
        data: {
          status: input.decision,
          version: { increment: 1 },
          decisionReason: reason,
          decidedById: input.admin.id,
          decidedAt,
        },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: input.admin.id,
          action: input.decision === 'ACCEPTED'
            ? 'reservation.reschedule_request.accept'
            : 'reservation.reschedule_request.reject',
          entityType: 'ReservationRescheduleRequest',
          entityId: request.id,
          metadata: {
            commandId: input.commandId,
            reservationId: reservation.id,
            actorRole: input.admin.role,
            decision: input.decision,
            reason,
            oldStartAt: current.oldStartAt,
            requestedStartAt: current.requestedStartAt,
            result: 'SUCCESS',
          },
        },
      });
      return { request, reservation };
    },
    loadReplay: async () => {
      const request = await prisma.reservationRescheduleRequest.findUniqueOrThrow({
        where: { id: input.requestId },
      });
      const reservation = await prisma.reservation.findUniqueOrThrow({
        where: { id: request.reservationId },
      });
      return { request, reservation };
    },
  });
};
