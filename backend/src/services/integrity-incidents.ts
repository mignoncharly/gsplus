import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { NotificationStatus, Prisma } from '../generated/prisma/client.js';
import { EMAIL_TEMPLATE_VERSION, renderEmailTemplate } from '../emails/templates.js';

const maskPhone = (phone: string) => `•••• ${phone.slice(-3)}`;
const maskEmail = (email: string | null) => {
  if (!email) return 'Non renseigné';
  const [local, domain] = email.split('@');
  if (!domain) return 'Adresse invalide';
  return `${local.slice(0, 1)}•••@${domain}`;
};

export const recordMissingReservationSnapshot = async (reservationId: string, context: string) => {
  const code = 'I-10_RESERVATION_SNAPSHOT_MISSING';
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const incident = await tx.dataIntegrityIncident.upsert({
      where: { dedupeKey: `${code}:${reservationId}` },
      update: {
        status: 'OPEN',
        occurrenceCount: { increment: 1 },
        lastSeenAt: now,
        metadata: { context },
      },
      create: {
        code,
        reservationId,
        dedupeKey: `${code}:${reservationId}`,
        metadata: { context },
        firstSeenAt: now,
        lastSeenAt: now,
      },
    });
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: { customer: true },
    });
    if (!reservation) return incident;

    const rendered = renderEmailTemplate('I-10', {
      reference_courte: reservation.reference,
      references_liees: 'Aucune autre référence identifiée',
      telephone_masque: maskPhone(reservation.customer.phone),
      identites: `Snapshot absent; profil courant ${reservation.customer.firstName} ${reservation.customer.lastName}`,
      emails_masques: maskEmail(reservation.customer.email),
      champ_concerne: `ReservationSnapshot absent — contexte ${context}`,
      lien_admin_reservation: `${env.CLIENT_ORIGINS[0] ?? 'https://gsplus.vip'}/admin?reservation=${reservation.id}`,
    });
    await tx.notificationEvent.upsert({
      where: { idempotencyKey: `integrity-incident:${incident.id}:I-10:email` },
      update: {},
      create: {
        channel: 'email',
        type: 'data_integrity_incident_admin',
        recipient: env.ADMIN_NOTIFICATION_EMAIL,
        idempotencyKey: `integrity-incident:${incident.id}:I-10:email`,
        templateCode: 'I-10',
        templateVersion: EMAIL_TEMPLATE_VERSION,
        renderedContent: rendered as unknown as Prisma.InputJsonValue,
        metadata: {
          templateCode: 'I-10',
          audience: 'ADMIN',
          destinationType: 'SHARED_OPERATIONAL',
          actorType: 'SYSTEM',
          incidentId: incident.id,
          reservationId,
          incidentCode: code,
        },
        status: NotificationStatus.PENDING,
      },
    });
    return incident;
  });
};
