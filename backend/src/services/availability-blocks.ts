import { HttpError } from '../errors/http-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { lockBookingWindow } from './booking-slots.js';

type BlockInput = {
  startAt: Date;
  endAt: Date;
  reason?: string;
};

const serializable = <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
  prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

const withConflictRetry = async <T>(work: () => Promise<T>) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 3) {
        continue;
      }
      throw error;
    }
  }
  throw new HttpError(409, 'AVAILABILITY_BLOCK_CONFLICT', 'The availability block changed concurrently.');
};

export const createAvailabilityBlock = (input: BlockInput) =>
  withConflictRetry(() =>
    serializable(async (tx) => {
      await lockBookingWindow(tx, input.startAt, input.endAt);
      return tx.availabilityBlock.create({ data: input });
    }),
  );

export const updateAvailabilityBlock = (id: string, input: BlockInput) =>
  withConflictRetry(() =>
    serializable(async (tx) => {
      const current = await tx.availabilityBlock.findUnique({ where: { id } });
      if (!current) {
        throw new HttpError(404, 'AVAILABILITY_BLOCK_NOT_FOUND', 'Availability block not found.');
      }
      await lockBookingWindow(tx, current.startAt, current.endAt);
      await lockBookingWindow(tx, input.startAt, input.endAt);
      return tx.availabilityBlock.update({ where: { id }, data: input });
    }),
  );

export const deleteAvailabilityBlock = (id: string) =>
  withConflictRetry(() =>
    serializable(async (tx) => {
      const current = await tx.availabilityBlock.findUnique({ where: { id } });
      if (!current) {
        throw new HttpError(404, 'AVAILABILITY_BLOCK_NOT_FOUND', 'Availability block not found.');
      }
      await lockBookingWindow(tx, current.startAt, current.endAt);
      await tx.availabilityBlock.delete({ where: { id } });
    }),
  );
