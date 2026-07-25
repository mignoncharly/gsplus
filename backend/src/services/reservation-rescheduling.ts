import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';
import { Prisma, ReservationStatus } from '../generated/prisma/client.js';
import { addMinutes, assertBookableSlot, lockBookingWindow } from './booking-slots.js';

const RESCHEDULABLE_STATUSES = new Set<ReservationStatus>([
  ReservationStatus.PENDING_CONFIRMATION,
  ReservationStatus.CONFIRMED,
]);

type RescheduleInput = {
  startAt: Date;
  reason: string;
  adminUserId?: string;
};

export const rescheduleReservation = async (reservationId: string, input: RescheduleInput) => {
  const reason = input.reason.trim();
  if (!reason) {
    throw new HttpError(400, 'RESCHEDULE_REASON_REQUIRED', 'A reason is required to reschedule a reservation.');
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const initial = await tx.reservation.findUnique({
            where: { id: reservationId },
            include: { package: true, packageVersion: true },
          });
          if (!initial) throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found.');
          if (!RESCHEDULABLE_STATUSES.has(initial.status)) {
            throw new HttpError(409, 'RESERVATION_NOT_RESCHEDULABLE', 'This reservation cannot be rescheduled in its current state.');
          }

          const endAt = addMinutes(input.startAt, initial.packageVersion.durationMin);
          await lockBookingWindow(tx, input.startAt, endAt);
          const current = await tx.reservation.findUnique({
            where: { id: reservationId },
            include: { package: true, packageVersion: true },
          });
          if (!current) throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found.');
          if (!RESCHEDULABLE_STATUSES.has(current.status)) {
            throw new HttpError(409, 'RESERVATION_NOT_RESCHEDULABLE', 'This reservation cannot be rescheduled in its current state.');
          }
          if (current.startAt.getTime() === input.startAt.getTime()) {
            throw new HttpError(409, 'SCHEDULE_UNCHANGED', 'The new appointment time must be different.');
          }

          await assertBookableSlot(tx, current.package, input.startAt, endAt, {
            excludeReservationId: current.id,
          });
          const updated = await tx.reservation.updateMany({
            where: { id: current.id, version: current.version },
            data: { startAt: input.startAt, endAt, version: { increment: 1 } },
          });
          if (updated.count !== 1) {
            throw new HttpError(409, 'RESERVATION_VERSION_CONFLICT', 'Reservation changed during this request.');
          }

          await tx.reservationTransition.create({
            data: {
              reservationId: current.id,
              fromStatus: current.status,
              toStatus: current.status,
              reason,
              actorType: 'ADMIN',
              adminUserId: input.adminUserId,
              oldStartAt: current.startAt,
              oldEndAt: current.endAt,
              newStartAt: input.startAt,
              newEndAt: endAt,
              metadata: { kind: 'RESCHEDULE' },
            },
          });

          return tx.reservation.findUniqueOrThrow({ where: { id: current.id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 3) continue;
      throw error;
    }
  }

  throw new HttpError(409, 'RESCHEDULE_CONFLICT', 'Unable to reschedule this reservation. Please try again.');
};
