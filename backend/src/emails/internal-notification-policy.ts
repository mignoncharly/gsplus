import { prisma } from '../db/prisma.js';
import { NotificationStatus, Prisma } from '../generated/prisma/client.js';

export type NotificationActor = {
  id: string;
  email: string;
};

export type NotificationAudience = 'ADMIN' | 'CUSTOMER' | 'EXTERNAL';

export type InternalNotificationDestination =
  | { type: 'SHARED_OPERATIONAL' }
  | { type: 'NOMINATIVE'; adminUserId?: string };

const NON_SUPPRESSIBLE_INTERNAL_CODES = new Set(['I-07', 'I-08', 'I-09', 'I-10']);
const SELF_NOMINATIVE_REDUNDANT = 'SELF_NOMINATIVE_REDUNDANT';

const normalizeEmail = (value: string) => value.trim().toLocaleLowerCase('en-US');

export const administrativeSuppressionReason = (input: {
  audience: NotificationAudience;
  recipient: string;
  actor?: NotificationActor | null;
  destination: InternalNotificationDestination;
  templateCode?: string;
}) => {
  if (
    input.audience !== 'ADMIN' ||
    !input.actor ||
    input.destination.type !== 'NOMINATIVE' ||
    (input.templateCode && NON_SUPPRESSIBLE_INTERNAL_CODES.has(input.templateCode))
  ) return null;

  const sameAdmin = input.destination.adminUserId === input.actor.id;
  const sameMailbox = normalizeEmail(input.recipient) === normalizeEmail(input.actor.email);
  return sameAdmin || sameMailbox ? SELF_NOMINATIVE_REDUNDANT : null;
};

export type InternalEmailNotificationInput = {
  reservationId?: string;
  leadId?: string;
  type: string;
  recipient: string;
  idempotencyKey: string;
  nextAttemptAt?: Date;
  maxAttempts?: number;
  templateCode?: string;
  templateVersion?: string;
  renderedContent?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonObject;
  actor?: NotificationActor | null;
  actorType?: 'SYSTEM' | 'CUSTOMER' | 'EXTERNAL';
  destination: InternalNotificationDestination;
};

export const enqueueInternalEmailNotification = async (input: InternalEmailNotificationInput) => {
  const suppressionReason = administrativeSuppressionReason({
    audience: 'ADMIN',
    recipient: input.recipient,
    actor: input.actor,
    destination: input.destination,
    templateCode: input.templateCode,
  });
  const now = new Date();
  const metadata: Prisma.InputJsonObject = {
    ...(input.metadata ?? {}),
    audience: 'ADMIN',
    destinationType: input.destination.type,
    actorType: input.actor ? 'ADMIN' : (input.actorType ?? 'SYSTEM'),
    ...(input.actor ? { actorAdminUserId: input.actor.id } : {}),
    ...(input.destination.type === 'NOMINATIVE' && input.destination.adminUserId
      ? { destinationAdminUserId: input.destination.adminUserId }
      : {}),
    ...(suppressionReason ? { suppressionReason } : {}),
  };
  const data: Prisma.NotificationEventUncheckedCreateInput = {
    reservationId: input.reservationId,
    leadId: input.leadId,
    channel: 'email',
    type: input.type,
    recipient: input.recipient,
    idempotencyKey: input.idempotencyKey,
    nextAttemptAt: suppressionReason ? null : input.nextAttemptAt,
    maxAttempts: input.maxAttempts,
    templateCode: input.templateCode,
    templateVersion: input.templateVersion,
    renderedContent: input.renderedContent,
    metadata,
    status: suppressionReason ? NotificationStatus.CANCELLED : NotificationStatus.PENDING,
    ...(suppressionReason
      ? {
          providerStatus: 'suppressed_self_nominative',
          resolution: 'SUPPRESSED',
          resolutionNote: suppressionReason,
          resolvedAt: now,
          resolvedBy: 'SYSTEM',
        }
      : {}),
  };

  try {
    return await prisma.notificationEvent.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      update: {},
      create: data,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.notificationEvent.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey } });
    }
    throw error;
  }
};
