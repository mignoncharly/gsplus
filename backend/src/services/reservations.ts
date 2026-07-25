import { HttpError } from '../errors/http-error.js';
import { queueReservationCreatedNotifications } from '../emails/notifications.js';
import { PaymentStatus, Prisma, ReservationStatus } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { ensureCurrentPackageVersion } from './packages.js';
import { assertBookableSlot, lockBookingWindow } from './booking-slots.js';
import {
  normalizePaymentReference,
  paymentReferenceValidationMessage,
  type SupportedPaymentMethod,
} from '../utils/payment-reference.js';

type ReservationCreateInput = {
  intentId: string;
  idempotencyKey: string;
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    birthDate?: Date;
    gender?: string;
    discoveryChannel?: string;
  };
  consentImage: boolean;
  whatsappConsent: boolean;
  acceptedTerms: true;
  paymentChoice?: 'base' | 'quote';
  paymentMethod?: SupportedPaymentMethod;
  paymentPhone?: string;
  transactionRef?: string;
  extraInfo?: string;
};

const reservationInclude = {
  customer: true,
  package: true,
  packageVersion: true,
  payments: true,
} satisfies Prisma.ReservationInclude;

const findOrCreateCustomer = async (tx: Prisma.TransactionClient, input: ReservationCreateInput['customer']) => {
  const existing = await tx.customer.findFirst({
    where: {
      OR: [{ phone: input.phone }, ...(input.email ? [{ email: input.email }] : [])],
    },
    orderBy: { updatedAt: 'desc' },
  });

  const data = {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    email: input.email,
    birthDate: input.birthDate,
    gender: input.gender,
    discoveryChannel: input.discoveryChannel,
  };

  return existing
    ? tx.customer.update({ where: { id: existing.id }, data })
    : tx.customer.create({ data });
};

export const createReservation = async (input: ReservationCreateInput) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const initialIntent = await tx.reservationIntent.findFirst({
            where: { id: input.intentId, idempotencyKey: input.idempotencyKey },
          });
          if (!initialIntent) {
            throw new HttpError(404, 'RESERVATION_INTENT_NOT_FOUND', 'The booking intent was not found.');
          }

          await lockBookingWindow(tx, initialIntent.startAt, initialIntent.endAt);
          const intent = await tx.reservationIntent.findFirst({
            where: { id: input.intentId, idempotencyKey: input.idempotencyKey },
            include: { package: true },
          });
          if (!intent) {
            throw new HttpError(404, 'RESERVATION_INTENT_NOT_FOUND', 'The booking intent was not found.');
          }

          if (intent.reservationId) {
            const reservation = await tx.reservation.findUniqueOrThrow({
              where: { id: intent.reservationId },
              include: reservationInclude,
            });
            return { reservation, created: false };
          }
          if (intent.expiresAt <= new Date()) {
            throw new HttpError(409, 'RESERVATION_INTENT_EXPIRED', 'The slot hold expired. Please verify the slot again.');
          }

          await assertBookableSlot(tx, intent.package, intent.startAt, intent.endAt, {
            excludeIntentId: intent.id,
          });

          const referenceIssue =
            input.paymentChoice === 'base'
              ? paymentReferenceValidationMessage(input.paymentMethod, input.transactionRef)
              : null;
          if (referenceIssue) {
            throw new HttpError(400, 'INVALID_PAYMENT_REFERENCE', referenceIssue);
          }

          const customer = await findOrCreateCustomer(tx, input.customer);
          const packageVersion = await ensureCurrentPackageVersion(tx, intent.package);
          const transactionRef = input.paymentChoice === 'base' ? input.transactionRef?.trim() : undefined;
          const transactionRefNormalized = normalizePaymentReference(transactionRef);

          const reservation = await tx.reservation.create({
            data: {
              reference: intent.reference,
              customerId: customer.id,
              packageId: intent.package.id,
              packageVersionId: packageVersion.id,
              startAt: intent.startAt,
              endAt: intent.endAt,
              status: ReservationStatus.PENDING_CONFIRMATION,
              paymentChoice: input.paymentChoice,
              extraInfo: input.extraInfo,
              acceptedTermsAt: new Date(),
              consentImage: input.consentImage,
              whatsappConsentAt: input.whatsappConsent ? new Date() : null,
              transitions: {
                create: {
                  fromStatus: null,
                  toStatus: ReservationStatus.PENDING_CONFIRMATION,
                  actorType: 'CUSTOMER',
                  oldStartAt: intent.startAt,
                  oldEndAt: intent.endAt,
                  newStartAt: intent.startAt,
                  newEndAt: intent.endAt,
                },
              },
              payments: transactionRef
                ? {
                    create: {
                      amount: intent.package.price,
                      method: input.paymentMethod ?? 'mobile_money',
                      transactionRef,
                      transactionRefNormalized,
                      paymentPhone: input.paymentPhone,
                      status: PaymentStatus.PENDING,
                      transitions: {
                        create: {
                          fromStatus: null,
                          toStatus: PaymentStatus.PENDING,
                          actorType: 'CUSTOMER',
                        },
                      },
                    },
                  }
                : undefined,
            },
            include: reservationInclude,
          });

          await tx.reservationIntent.update({
            where: { id: intent.id },
            data: { reservationId: reservation.id, consumedAt: new Date() },
          });

          return { reservation, created: true };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (result.created) {
        await queueReservationCreatedNotifications(result.reservation.id);
      }
      return result.reservation;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        if (attempt < 3) continue;
        throw new HttpError(409, 'SLOT_ALREADY_RESERVED', 'The selected slot is no longer available.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const submittedReference =
          input.paymentChoice === 'base' ? normalizePaymentReference(input.transactionRef) : null;
        if (submittedReference) {
          throw new HttpError(409, 'PAYMENT_REFERENCE_ALREADY_USED', 'This payment reference has already been used.');
        }
      }
      throw error;
    }
  }

  throw new HttpError(409, 'RESERVATION_CONFLICT', 'Unable to complete this reservation. Please try again.');
};
