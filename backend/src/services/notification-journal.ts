import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { businessDayWindow } from '../utils/business-time.js';

export type NotificationListFilters = {
  limit: number;
  offset: number;
  channel?: string;
  status?: string[];
  type?: string;
  from?: string;
  to?: string;
  actionableOnly?: boolean;
  includeDisabledChannels?: boolean;
};

/**
 * Channels the studio has not switched on. Their rows are real history and are never
 * deleted, but they clutter a journal nobody can act on, so they are hidden unless
 * asked for — the report's *"masquer par défaut les files d'un canal désactivé"*.
 */
export const disabledChannels = () => {
  const disabled: string[] = [];
  if (!env.WHATSAPP_DELIVERY_ENABLED) disabled.push('whatsapp');
  if (!env.EMAIL_DELIVERY_ENABLED) disabled.push('email');
  return disabled;
};

const listWhere = (filters: NotificationListFilters): Prisma.NotificationEventWhereInput => {
  const and: Prisma.NotificationEventWhereInput[] = [];
  if (filters.channel) and.push({ channel: filters.channel });
  else if (!filters.includeDisabledChannels) {
    const hidden = disabledChannels();
    if (hidden.length) and.push({ channel: { notIn: hidden } });
  }
  if (filters.status?.length) and.push({ status: { in: filters.status as Prisma.EnumNotificationStatusFilter['in'] } });
  if (filters.type) and.push({ type: filters.type });
  if (filters.from) and.push({ createdAt: { gte: businessDayWindow(filters.from).start } });
  if (filters.to) and.push({ createdAt: { lt: businessDayWindow(filters.to).end } });
  // What an operator can still do something about: a failure nobody has classified.
  if (filters.actionableOnly) and.push({ status: 'FAILED', resolvedAt: null });
  return and.length ? { AND: and } : {};
};

export const listNotifications = async (filters: NotificationListFilters) => {
  const where = listWhere(filters);
  const [items, total] = await prisma.$transaction([
    prisma.notificationEvent.findMany({
      where,
      take: filters.limit,
      skip: filters.offset,
      orderBy: { createdAt: 'desc' },
      include: {
        attempts: { orderBy: { attemptNumber: 'asc' } },
        reservation: { select: { id: true, reference: true } },
        lead: { select: { id: true, name: true, type: true, reference: true } },
      },
    }),
    prisma.notificationEvent.count({ where }),
  ]);
  return { items, total, limit: filters.limit, offset: filters.offset, hiddenChannels: filters.includeDisabledChannels ? [] : disabledChannels() };
};
