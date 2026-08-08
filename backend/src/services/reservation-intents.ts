import { HttpError } from '../errors/http-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { BUSINESS_TIME_ZONE } from '../utils/business-time.js';
import { allocatePublicReservationReference } from '../utils/reservation-reference.js';
import { addMinutes, assertBookableSlot, lockBookingWindow } from './booking-slots.js';
import { ensurePublishedPackageVersion } from './packages.js';

const INTENT_TTL_MINUTES = 30;

type ReservationIntentInput = {
  idempotencyKey: string;
  packageId: string;
  startAt: Date;
};

const publicIntent = <T extends {
  id: string;
  reference: string;
  packageId: string;
  startAt: Date;
  endAt: Date;
  expiresAt: Date;
  reservationId: string | null;
}>(intent: T) => ({
  id: intent.id,
  reference: intent.reference,
  packageId: intent.packageId,
  startAt: intent.startAt,
  endAt: intent.endAt,
  expiresAt: intent.expiresAt,
  reservationId: intent.reservationId,
  timeZone: BUSINESS_TIME_ZONE,
});

export const createOrRefreshReservationIntent = async (input: ReservationIntentInput) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existing = await tx.reservationIntent.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
          });

          if (existing?.reservationId) {
            return publicIntent(existing);
          }

          const pack = await tx.package.findFirst({
            where: { id: input.packageId, isActive: true, isArchived: false },
          });
          if (!pack) {
            throw new HttpError(404, 'PACKAGE_NOT_FOUND', 'Package not found or inactive.');
          }

          const packageVersion = await ensurePublishedPackageVersion(tx, pack);
          const startAt = input.startAt;
          const endAt = addMinutes(startAt, packageVersion.durationMin);
          await lockBookingWindow(tx, startAt, endAt);
          await assertBookableSlot(tx, pack, startAt, endAt, {
            excludeIntentId: existing?.id,
          });

          const expiresAt = addMinutes(new Date(), INTENT_TTL_MINUTES);
          const reference = existing
            ? existing.reference
            : await allocatePublicReservationReference({
                exists: async (candidate) => {
                  const [intentMatch, reservationMatch] = await Promise.all([
                    tx.reservationIntent.findUnique({ where: { reference: candidate }, select: { id: true } }),
                    tx.reservation.findUnique({ where: { reference: candidate }, select: { id: true } }),
                  ]);
                  return Boolean(intentMatch || reservationMatch);
                },
              });
          const intent = existing
            ? await tx.reservationIntent.update({
                where: { id: existing.id },
                data: {
                  packageId: pack.id,
                  packageVersionId: packageVersion.id,
                  startAt,
                  endAt,
                  expiresAt,
                },
              })
            : await tx.reservationIntent.create({
                data: {
                  idempotencyKey: input.idempotencyKey,
                  reference,
                  packageId: pack.id,
                  startAt,
                  endAt,
                  expiresAt,
                },
              });

          return publicIntent(intent);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error instanceof Error && error.message.startsWith('PUBLIC_REFERENCE_')) {
        throw new HttpError(
          409,
          'RESERVATION_REFERENCE_CONFLICT',
          'Unable to allocate a public reservation reference. Please try again.',
        );
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        if (attempt < 7) continue;
        throw new HttpError(409, 'SLOT_TEMPORARILY_HELD', 'The selected slot was claimed concurrently.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && attempt < 7) {
        continue;
      }
      throw error;
    }
  }

  throw new HttpError(409, 'INTENT_CREATION_CONFLICT', 'Unable to hold this slot. Please try again.');
};
