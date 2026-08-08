import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { Prisma, ReservationStatus } from '../generated/prisma/client.js';
import { recordMissingReservationSnapshot } from '../services/integrity-incidents.js';
import { EMAIL_TEMPLATE_VERSION, renderEmailTemplate } from './templates.js';

const formatDate = (date: Date) => new Intl.DateTimeFormat('fr-CM', {
  dateStyle: 'long',
  timeZone: 'Africa/Douala',
}).format(date);

export const queueReservationDeliveryNotification = async (deliveryId: string) => {
  const delivery = await prisma.reservationDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      reservation: {
        include: {
          snapshot: true,
          payments: { orderBy: { createdAt: 'desc' } },
        },
      },
    },
  });
  if (!delivery || delivery.status !== 'AVAILABLE') return null;
  const reservation = delivery.reservation;
  if (!reservation.snapshot) {
    await recordMissingReservationSnapshot(reservation.id, 'delivery_notification_queue');
    return null;
  }
  const recipient = reservation.snapshot.notificationEmail ?? reservation.snapshot.email;
  if (
    !recipient ||
    reservation.status !== ReservationStatus.COMPLETED ||
    delivery.expiresAt <= new Date() ||
    delivery.verificationStatusCode < 200 ||
    delivery.verificationStatusCode >= 300
  ) return null;

  const rendered = renderEmailTemplate('E-19', {
    prenom_client: reservation.snapshot.firstName,
    reference_courte: reservation.reference,
    lien_livraison: delivery.deliveryUrl,
    instruction_acces: delivery.accessInstruction,
    date_limite_acces: formatDate(delivery.expiresAt),
  });
  const data = {
    reservationId: reservation.id,
    channel: 'email',
    type: 'deliverables_available_customer',
    recipient,
    idempotencyKey: `reservation-delivery:${delivery.id}:E-19:email`,
    templateCode: 'E-19',
    templateVersion: EMAIL_TEMPLATE_VERSION,
    renderedContent: rendered as unknown as Prisma.InputJsonValue,
    metadata: {
      templateCode: 'E-19',
      deliveryId: delivery.id,
      reservationVersion: delivery.reservationVersionAtPublish,
      verifiedAt: delivery.verifiedAt.toISOString(),
      expiresAt: delivery.expiresAt.toISOString(),
      adminUrl: `${env.CLIENT_ORIGINS[0] ?? 'https://gsplus.vip'}/admin?reservation=${reservation.id}`,
    },
  } satisfies Prisma.NotificationEventUncheckedCreateInput;
  try {
    return await prisma.notificationEvent.upsert({
      where: { idempotencyKey: data.idempotencyKey },
      update: {},
      create: data,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.notificationEvent.findUniqueOrThrow({ where: { idempotencyKey: data.idempotencyKey } });
    }
    throw error;
  }
};
