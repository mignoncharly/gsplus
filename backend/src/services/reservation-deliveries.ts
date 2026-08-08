import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { prisma } from '../db/prisma.js';
import { queueReservationDeliveryNotification } from '../emails/delivery-notifications.js';
import { HttpError } from '../errors/http-error.js';
import { ReservationStatus, type AdminUser, type ReservationDelivery } from '../generated/prisma/client.js';
import { assertAdminPermission } from './admin-permissions.js';
import { runAdminCommand, type CommandOutcome } from './payment-reservation-commands.js';

export type DeliveryLinkVerification = {
  accessible: boolean;
  statusCode: number | null;
  checkedAt: Date;
};

export type DeliveryLinkVerifier = (url: string) => Promise<DeliveryLinkVerification>;

const isPrivateIpv4 = (address: string) => {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
};

const isPrivateAddress = (address: string) => {
  if (isIP(address) === 4) return isPrivateIpv4(address);
  const normalized = address.toLowerCase();
  return (
    normalized === '::' || normalized === '::1' ||
    normalized.startsWith('fc') || normalized.startsWith('fd') ||
    normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
    normalized.startsWith('fea') || normalized.startsWith('feb') ||
    normalized.startsWith('::ffff:127.') || normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.')
  );
};

const validatedPublicUrl = async (rawUrl: string) => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HttpError(400, 'DELIVERY_URL_INVALID', 'Le lien de livraison est invalide.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) {
    throw new HttpError(400, 'DELIVERY_URL_INVALID', 'Le lien de livraison doit être une adresse HTTPS publique.');
  }
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || (isIP(host) && isPrivateAddress(host))) {
    throw new HttpError(400, 'DELIVERY_URL_NOT_PUBLIC', 'Le lien de livraison doit être public.');
  }
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new HttpError(409, 'DELIVERY_LINK_INACCESSIBLE', 'Le domaine du lien de livraison est inaccessible.');
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new HttpError(400, 'DELIVERY_URL_NOT_PUBLIC', 'Le lien de livraison doit cibler un service public.');
  }
  return url;
};

export const verifyPublicDeliveryLink: DeliveryLinkVerifier = async (rawUrl) => {
  let current = await validatedPublicUrl(rawUrl);
  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    let response: Response;
    try {
      response = await fetch(current, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
        headers: { 'User-Agent': 'GoldenStudioPlus-DeliveryVerifier/1.0' },
      });
    } catch {
      return { accessible: false, statusCode: null, checkedAt: new Date() };
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirectCount === 5) {
        return { accessible: false, statusCode: response.status, checkedAt: new Date() };
      }
      current = await validatedPublicUrl(new URL(location, current).toString());
      continue;
    }
    return {
      accessible: response.status >= 200 && response.status < 300,
      statusCode: response.status,
      checkedAt: new Date(),
    };
  }
  return { accessible: false, statusCode: null, checkedAt: new Date() };
};

export type PublishReservationDeliverablesInput = {
  reservationId: string;
  commandId: string;
  expectedReservationVersion: number;
  deliveryUrl: string;
  accessInstruction: string;
  expiresAt: Date;
  admin: AdminUser;
  now?: Date;
  verifyLink?: DeliveryLinkVerifier;
};

export const publishReservationDeliverables = async (
  input: PublishReservationDeliverablesInput,
): Promise<CommandOutcome<ReservationDelivery>> => {
  assertAdminPermission(input.admin, 'DELIVERY_PUBLISH');
  const deliveryUrl = input.deliveryUrl.trim();
  const accessInstruction = input.accessInstruction.trim();
  const now = input.now ?? new Date();
  if (!accessInstruction) {
    throw new HttpError(400, 'DELIVERY_ACCESS_INSTRUCTION_REQUIRED', 'Une instruction d’accès est obligatoire.');
  }
  if (input.expiresAt <= now) {
    throw new HttpError(400, 'DELIVERY_EXPIRY_INVALID', 'La date limite d’accès doit être future.');
  }

  const existingCommand = await prisma.adminCommand.findUnique({ where: { id: input.commandId } });
  let verification: DeliveryLinkVerification | null = null;
  if (!existingCommand) {
    verification = await (input.verifyLink ?? verifyPublicDeliveryLink)(deliveryUrl);
    if (!verification.accessible || !verification.statusCode || verification.statusCode < 200 || verification.statusCode >= 300) {
      throw new HttpError(
        409,
        'DELIVERY_LINK_INACCESSIBLE',
        'Les livrables ne sont pas accessibles au lien indiqué. Aucun message n’a été créé.',
        { statusCode: verification.statusCode },
      );
    }
  }

  const outcome = await runAdminCommand({
    commandId: input.commandId,
    action: 'reservation.delivery.publish',
    entityType: 'Reservation',
    entityId: input.reservationId,
    request: {
      expectedReservationVersion: input.expectedReservationVersion,
      deliveryUrl,
      accessInstruction,
      expiresAt: input.expiresAt.toISOString(),
    },
    admin: input.admin,
    execute: async (tx) => {
      const reservation = await tx.reservation.findUnique({ where: { id: input.reservationId } });
      if (!reservation) throw new HttpError(404, 'RESERVATION_NOT_FOUND', 'Réservation introuvable.');
      if (reservation.version !== input.expectedReservationVersion) {
        throw new HttpError(409, 'RESERVATION_VERSION_CONFLICT', 'La réservation a été modifiée. Actualisez le dossier.');
      }
      if (reservation.status !== ReservationStatus.COMPLETED) {
        throw new HttpError(409, 'RESERVATION_NOT_COMPLETED', 'Les livrables ne peuvent être publiés qu’après la fin de la séance.');
      }
      const active = await tx.reservationDelivery.findFirst({
        where: { reservationId: reservation.id, status: 'AVAILABLE', expiresAt: { gt: now } },
      });
      if (active) {
        throw new HttpError(409, 'DELIVERY_ALREADY_AVAILABLE', 'Des livrables accessibles sont déjà publiés pour cette réservation.');
      }
      const checked = verification;
      if (!checked?.statusCode) throw new HttpError(409, 'DELIVERY_LINK_PROOF_MISSING', 'La preuve de disponibilité du lien est absente.');
      const delivery = await tx.reservationDelivery.create({
        data: {
          reservationId: reservation.id,
          commandId: input.commandId,
          publishedById: input.admin.id,
          reservationVersionAtPublish: reservation.version,
          deliveryUrl,
          accessInstruction,
          expiresAt: input.expiresAt,
          verificationStatusCode: checked.statusCode,
          verifiedAt: checked.checkedAt,
        },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: input.admin.id,
          action: 'reservation.delivery.publish',
          entityType: 'ReservationDelivery',
          entityId: delivery.id,
          metadata: {
            commandId: input.commandId,
            reservationId: reservation.id,
            reservationVersion: reservation.version,
            verificationStatusCode: checked.statusCode,
            verifiedAt: checked.checkedAt,
            expiresAt: input.expiresAt,
            result: 'SUCCESS',
          },
        },
      });
      return delivery;
    },
    loadReplay: () => prisma.reservationDelivery.findUniqueOrThrow({ where: { commandId: input.commandId } }),
  });

  await queueReservationDeliveryNotification(outcome.value.id);
  return outcome;
};
