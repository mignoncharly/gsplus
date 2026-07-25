import { randomBytes } from 'node:crypto';

import { HttpError } from '../errors/http-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { BUSINESS_TIME_ZONE, businessDateKey } from '../utils/business-time.js';
import { addMinutes, assertBookableSlot, lockBookingWindow } from './booking-slots.js';

const INTENT_TTL_MINUTES = 30;

type ReservationIntentInput = {
  idempotencyKey: string;
  packageId: string;
  startAt: Date;
};

const generateReference = () => {
  const date = businessDateKey(new Date()).replaceAll('-', '');
  const suffix = randomBytes(5).toString('hex').toUpperCase();
  return `GSP${date}${suffix}`;
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
  for (let attempt = 0; attempt < 4; attempt += 1) {
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

          const startAt = input.startAt;
          const endAt = addMinutes(startAt, pack.durationMin);
          await lockBookingWindow(tx, startAt, endAt);
          await assertBookableSlot(tx, pack, startAt, endAt, {
            excludeIntentId: existing?.id,
          });

          const expiresAt = addMinutes(new Date(), INTENT_TTL_MINUTES);
          const intent = existing
            ? await tx.reservationIntent.update({
                where: { id: existing.id },
                data: {
                  packageId: pack.id,
                  startAt,
                  endAt,
                  expiresAt,
                },
              })
            : await tx.reservationIntent.create({
                data: {
                  idempotencyKey: input.idempotencyKey,
                  reference: generateReference(),
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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        if (attempt < 3) continue;
        throw new HttpError(409, 'SLOT_TEMPORARILY_HELD', 'The selected slot was claimed concurrently.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && attempt < 3) {
        continue;
      }
      throw error;
    }
  }

  throw new HttpError(409, 'INTENT_CREATION_CONFLICT', 'Unable to hold this slot. Please try again.');
};
