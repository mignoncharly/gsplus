import { Prisma } from '../generated/prisma/client.js';
import { PaymentStatus, ReservationStatus } from '../generated/prisma/enums.js';
import { prisma } from '../db/prisma.js';
import { businessDayWindow } from '../utils/business-time.js';

export type ReservationListFilters = {
  limit: number;
  offset: number;
  q?: string;
  status?: string[];
  payment?: string[];
  packageId?: string;
  from?: string;
  to?: string;
  sort?: 'startAt' | 'createdAt' | 'reference';
  direction?: 'asc' | 'desc';
  reference?: string;
  rescheduleStatus?: string[];
};

/**
 * Free text has to reach the frozen snapshot as well as the live customer row: a
 * customer can edit their profile after booking, and the snapshot is what the studio
 * actually agreed to. Searching only one of the two loses records either way.
 */
const searchWhere = (q: string): Prisma.ReservationWhereInput => {
  const term = q.trim();
  const digits = term.replace(/\D/g, '');
  const insensitive = { contains: term, mode: 'insensitive' as const };
  return {
    OR: [
      { reference: { contains: term.toUpperCase() } },
      { snapshot: { firstName: insensitive } },
      { snapshot: { lastName: insensitive } },
      { snapshot: { notificationEmail: insensitive } },
      { snapshot: { email: insensitive } },
      { snapshot: { packageName: insensitive } },
      ...(digits ? [
        { snapshot: { notificationPhoneE164: { contains: digits } } },
        { snapshot: { phoneE164: { contains: digits } } },
        { customer: { phone: { contains: digits } } },
      ] : []),
      { customer: { firstName: insensitive } },
      { customer: { lastName: insensitive } },
      { customer: { email: insensitive } },
      { package: { name: insensitive } },
      { payments: { some: { transactionRef: insensitive } } },
      { payments: { some: { transactionRefNormalized: { contains: term.replace(/[^A-Za-z0-9]/g, '').toUpperCase() } } } },
    ],
  };
};

export const reservationListWhere = (filters: ReservationListFilters): Prisma.ReservationWhereInput => {
  const and: Prisma.ReservationWhereInput[] = [];
  // The historical exact-reference lookup keeps working unchanged.
  if (filters.reference) and.push({ reference: filters.reference });
  if (filters.q) and.push(searchWhere(filters.q));
  if (filters.status?.length) and.push({ status: { in: filters.status as ReservationStatus[] } });
  if (filters.rescheduleStatus?.length) and.push({ rescheduleRequests: { some: { status: { in: filters.rescheduleStatus } } } });
  if (filters.payment?.length) {
    and.push(filters.payment.includes('NONE')
      ? { OR: [{ payments: { none: {} } }, { payments: { some: { status: { in: filters.payment.filter((s) => s !== 'NONE') as PaymentStatus[] } } } }] }
      : { payments: { some: { status: { in: filters.payment as PaymentStatus[] } } } });
  }
  if (filters.packageId) and.push({ packageId: filters.packageId });
  // Dates are Douala business days, not UTC days, so a session at 00:30 Douala counts
  // as that day rather than the previous one.
  if (filters.from) and.push({ startAt: { gte: businessDayWindow(filters.from).start } });
  // `end` is the start of the next business day, so the bound is exclusive.
  if (filters.to) and.push({ startAt: { lt: businessDayWindow(filters.to).end } });
  return and.length ? { AND: and } : {};
};

const reservationListInclude = {
  customer: true,
  snapshot: true,
  package: true,
  packageVersion: true,
  payments: true,
  transitions: { orderBy: { createdAt: 'desc' as const }, take: 10, include: { adminUser: { select: { id: true, name: true } } } },
  calendarSyncLogs: { orderBy: { createdAt: 'desc' as const }, take: 5 },
  financialTasks: { orderBy: { createdAt: 'desc' as const } },
  rescheduleRequests: { orderBy: { createdAt: 'desc' as const }, take: 5 },
  withdrawalRequests: { orderBy: { createdAt: 'desc' as const }, take: 5 },
  imageConsentEvents: {
    orderBy: [{ effectiveAt: 'desc' as const }, { createdAt: 'desc' as const }],
    take: 10,
    include: { legalVersion: true, recordedBy: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ReservationInclude;

export const listReservations = async (filters: ReservationListFilters) => {
  const where = reservationListWhere(filters);
  const sort = filters.sort ?? 'startAt';
  const direction = filters.direction ?? 'desc';
  const [items, total] = await prisma.$transaction([
    prisma.reservation.findMany({
      where,
      take: filters.limit,
      skip: filters.offset,
      orderBy: { [sort]: direction },
      include: reservationListInclude,
    }),
    prisma.reservation.count({ where }),
  ]);
  return { items, total, limit: filters.limit, offset: filters.offset };
};
