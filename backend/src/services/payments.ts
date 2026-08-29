import { Prisma } from '../generated/prisma/client.js';
import { PaymentStatus } from '../generated/prisma/enums.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';

/**
 * Payment states the report requires, in its own order:
 * En attente · Information requise · Vérification bloquée · Vérifié · Rejeté.
 * The two post-refund states belong to the refund object, not to verification.
 */
export const PAYMENT_VERIFICATION_STATUSES = [
  PaymentStatus.PENDING,
  PaymentStatus.PAYMENT_INFO_REQUIRED,
  PaymentStatus.VERIFICATION_BLOCKED,
  PaymentStatus.VERIFIED,
  PaymentStatus.REJECTED,
] as const;

/** Awaiting a decision: the queue the studio has to empty. */
export const PAYMENT_OPEN_STATUSES = [
  PaymentStatus.PENDING,
  PaymentStatus.PAYMENT_INFO_REQUIRED,
  PaymentStatus.VERIFICATION_BLOCKED,
] as const;

export type PaymentListFilters = {
  limit: number;
  offset: number;
  status?: string[];
  method?: string;
  open?: boolean;
  mismatch?: boolean;
  duplicate?: boolean;
  from?: Date;
  to?: Date;
  q?: string;
};

export const paymentListInclude = {
  reservation: {
    select: {
      id: true, reference: true, status: true, startAt: true, endAt: true,
      snapshot: { select: { firstName: true, lastName: true, notificationPhoneE164: true, notificationEmail: true, packageName: true, amount: true } },
      customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
    },
  },
  verifiedBy: { select: { id: true, name: true } },
  duplicateOf: { select: { id: true, transactionRef: true, status: true, createdAt: true, reservation: { select: { reference: true } } } },
  duplicates: { select: { id: true, transactionRef: true, status: true, createdAt: true, reservation: { select: { reference: true } } } },
} satisfies Prisma.PaymentInclude;

/**
 * Difference between what the studio observed and what the package costs.
 * Null when nobody has recorded a declared amount yet — an unrecorded amount is not
 * the same as an amount that matches, and must never be presented as one.
 */
export const paymentAmountVariance = (payment: { amount: number; declaredAmount: number | null }) =>
  payment.declaredAmount === null || payment.declaredAmount === undefined
    ? null
    : payment.declaredAmount - payment.amount;

const searchWhere = (q: string): Prisma.PaymentWhereInput => {
  const term = q.trim();
  const normalised = term.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return {
    OR: [
      { transactionRef: { contains: term, mode: 'insensitive' } },
      ...(normalised ? [{ transactionRefNormalized: { contains: normalised } }] : []),
      { paymentPhone: { contains: term } },
      { reservation: { reference: { contains: term.toUpperCase() } } },
      { reservation: { snapshot: { firstName: { contains: term, mode: 'insensitive' } } } },
      { reservation: { snapshot: { lastName: { contains: term, mode: 'insensitive' } } } },
      { reservation: { snapshot: { notificationPhoneE164: { contains: term } } } },
      { reservation: { snapshot: { notificationEmail: { contains: term, mode: 'insensitive' } } } },
      // The live customer row can drift from the frozen snapshot, so both are searched.
      { reservation: { customer: { firstName: { contains: term, mode: 'insensitive' } } } },
      { reservation: { customer: { lastName: { contains: term, mode: 'insensitive' } } } },
      { reservation: { customer: { phone: { contains: term } } } },
      { reservation: { customer: { email: { contains: term, mode: 'insensitive' } } } },
    ],
  };
};

const listWhere = (filters: PaymentListFilters): Prisma.PaymentWhereInput => {
  const and: Prisma.PaymentWhereInput[] = [];
  if (filters.open) and.push({ status: { in: [...PAYMENT_OPEN_STATUSES] } });
  if (filters.status?.length) and.push({ status: { in: filters.status as PaymentStatus[] } });
  if (filters.method) and.push({ method: filters.method });
  if (filters.duplicate) and.push({ OR: [{ duplicateOfPaymentId: { not: null } }, { duplicates: { some: {} } }] });
  if (filters.mismatch) and.push({ declaredAmount: { not: null } });
  if (filters.from) and.push({ createdAt: { gte: filters.from } });
  if (filters.to) and.push({ createdAt: { lte: filters.to } });
  if (filters.q) and.push(searchWhere(filters.q));
  return and.length ? { AND: and } : {};
};

export const listPayments = async (filters: PaymentListFilters) => {
  const where = listWhere(filters);
  const [rows, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      take: filters.limit,
      skip: filters.offset,
      orderBy: [{ createdAt: 'desc' }],
      include: paymentListInclude,
    }),
    prisma.payment.count({ where }),
  ]);

  const items = rows.map((payment) => ({ ...payment, amountVariance: paymentAmountVariance(payment) }));
  // A declared amount equal to the expected one is not a mismatch; filtering that in
  // SQL would need a column comparison Prisma cannot express in a where clause.
  const filtered = filters.mismatch ? items.filter((item) => item.amountVariance !== null && item.amountVariance !== 0) : items;

  return { items: filtered, total: filters.mismatch ? filtered.length : total, limit: filters.limit, offset: filters.offset };
};

export const getPayment = async (id: string) => {
  const payment = await prisma.payment.findUnique({ where: { id }, include: paymentListInclude });
  if (!payment) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable ou obsolète.');
  return { ...payment, amountVariance: paymentAmountVariance(payment) };
};

/**
 * Payments that look like the same transfer arriving twice: the same normalised
 * reference on another operator, or the same payer phone and expected amount on the
 * same day. The unique index already blocks an exact re-use on one operator; this
 * surfaces the near misses it cannot see.
 */
export const findDuplicateCandidates = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable ou obsolète.');

  const dayStart = new Date(payment.createdAt);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const or: Prisma.PaymentWhereInput[] = [];
  if (payment.transactionRefNormalized) or.push({ transactionRefNormalized: payment.transactionRefNormalized });
  if (payment.paymentPhone) {
    or.push({ paymentPhone: payment.paymentPhone, amount: payment.amount, createdAt: { gte: dayStart, lt: dayEnd } });
  }
  if (!or.length) return [];

  return prisma.payment.findMany({
    where: { AND: [{ id: { not: paymentId } }, { OR: or }] },
    orderBy: { createdAt: 'asc' },
    include: paymentListInclude,
  });
};

export const paymentCsvRows = (items: Awaited<ReturnType<typeof listPayments>>['items']) => {
  const header = [
    'reference', 'payment_id', 'status', 'method', 'transaction_ref', 'payer_phone',
    'expected_amount', 'declared_amount', 'variance', 'duplicate_of', 'reservation_status',
    'created_at', 'verified_at', 'verified_by',
  ];
  const rows = items.map((payment) => [
    payment.reservation?.reference ?? '',
    payment.id,
    payment.status,
    payment.method,
    payment.transactionRef ?? '',
    payment.paymentPhone ?? '',
    String(payment.amount),
    payment.declaredAmount === null ? '' : String(payment.declaredAmount),
    payment.amountVariance === null ? '' : String(payment.amountVariance),
    payment.duplicateOf?.reservation?.reference ?? '',
    payment.reservation?.status ?? '',
    payment.createdAt.toISOString(),
    payment.verifiedAt ? payment.verifiedAt.toISOString() : '',
    payment.verifiedBy?.name ?? '',
  ]);
  return [header, ...rows];
};

/** RFC 4180 quoting, and a leading apostrophe on anything a spreadsheet would treat as a formula. */
export const toCsv = (rows: string[][]) =>
  rows
    .map((row) => row.map((cell) => {
      const guarded = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
      return `"${guarded.replaceAll('"', '""')}"`;
    }).join(','))
    .join('\r\n');
