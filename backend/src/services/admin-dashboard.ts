import { PaymentStatus, ReservationStatus } from '../generated/prisma/enums.js';
import { prisma } from '../db/prisma.js';
import { businessDateKey, businessDayWindow } from '../utils/business-time.js';
import { PAYMENT_OPEN_STATUSES } from './payments.js';

/**
 * The dashboard the report asks for shows what needs a decision before it shows any
 * statistic, and every number opens the list it counts.
 *
 * Each count is a database count over the same predicate the linked list uses, so the
 * card and the list it opens can never disagree. The previous tiles were computed in
 * the browser from the first 50 rows, which made them silently wrong past 50 records.
 */

const REVENUE_PAYMENT_STATUSES = [PaymentStatus.VERIFIED, PaymentStatus.PAID];

/** Reservations that still hold their money: a cancelled or refunded booking does not. */
const ACTIVE_RESERVATION_STATUSES = [
  ReservationStatus.PENDING_CONFIRMATION,
  ReservationStatus.CONFIRMED,
  ReservationStatus.COMPLETED,
  ReservationStatus.NO_SHOW,
];

const LOST_RESERVATION_STATUSES = [
  ReservationStatus.CANCELLED,
  ReservationStatus.REJECTED,
  ReservationStatus.EXPIRED,
];

export const buildAdminDashboard = async (now = new Date()) => {
  const today = businessDateKey(now);
  const { start: dayStart, end: dayEnd } = businessDayWindow(today);
  const monthStart = businessDayWindow(`${today.slice(0, 7)}-01`).start;

  const [
    paymentsToVerify,
    reservationsToDecide,
    informationRequired,
    reschedulesPending,
    refundsToProcess,
    sessionsToday,
    calendarFailures,
    emailFailures,
    newRequests,
    verifiedActive,
    verifiedCancelled,
    refunded,
    reservationsThisMonth,
    uniqueCustomers,
  ] = await prisma.$transaction([
    prisma.payment.count({ where: { status: { in: [...PAYMENT_OPEN_STATUSES] } } }),
    prisma.reservation.count({ where: { status: ReservationStatus.PENDING_CONFIRMATION } }),
    prisma.payment.count({ where: { status: PaymentStatus.PAYMENT_INFO_REQUIRED } }),
    prisma.reservationRescheduleRequest.count({ where: { status: 'PENDING' } }),
    prisma.financialTask.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
    prisma.reservation.count({
      where: {
        startAt: { gte: dayStart, lt: dayEnd },
        status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING_CONFIRMATION] },
      },
    }),
    prisma.calendarSyncLog.count({ where: { status: { in: ['FAILED', 'RETRYING'] } } }),
    prisma.notificationEvent.count({ where: { status: 'FAILED', resolvedAt: null } }),
    prisma.lead.count({ where: { status: 'NEW' } }),
    // Revenue, split by what happened to the reservation the money belongs to.
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: { in: REVENUE_PAYMENT_STATUSES },
        createdAt: { gte: monthStart },
        reservation: { status: { in: ACTIVE_RESERVATION_STATUSES } },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: { in: REVENUE_PAYMENT_STATUSES },
        createdAt: { gte: monthStart },
        reservation: { status: { in: LOST_RESERVATION_STATUSES } },
      },
    }),
    prisma.payment.aggregate({
      _sum: { refundAmount: true },
      where: { status: PaymentStatus.REFUNDED, refundedAt: { gte: monthStart } },
    }),
    prisma.reservation.count({ where: { startAt: { gte: monthStart } } }),
    prisma.customer.count(),
  ]);

  const grossActive = verifiedActive._sum.amount ?? 0;
  const onCancelled = verifiedCancelled._sum.amount ?? 0;
  const refundedAmount = refunded._sum.refundAmount ?? 0;

  const queue = (key: string, label: string, count: number, href: string) => ({ key, label, count, href });

  return {
    generatedAt: now.toISOString(),
    businessDate: today,
    // Zone 1 — À traiter.
    toHandle: [
      queue('paymentsToVerify', 'Paiements à vérifier', paymentsToVerify, '/admin/paiements/verification?open=true'),
      queue('reservationsToDecide', 'Réservations à décider', reservationsToDecide, '/admin/reservations?status=PENDING_CONFIRMATION'),
      queue('informationRequired', 'Informations manquantes', informationRequired, '/admin/paiements/verification?status=PAYMENT_INFO_REQUIRED'),
      queue('reschedulesPending', 'Reports en attente', reschedulesPending, '/admin/reservations?rescheduleStatus=PENDING'),
    ],
    // Zone 2 — Aujourd'hui.
    today: [
      queue('sessionsToday', 'Séances du jour', sessionsToday, `/admin/reservations?from=${today}&to=${today}`),
    ],
    // Zone 3 — Finances.
    finance: [
      queue('refundsToProcess', 'Remboursements à traiter', refundsToProcess, '/admin/paiements/remboursements?status=PENDING&status=IN_PROGRESS'),
    ],
    // Zone 4 — Intégrations.
    integrations: [
      queue('calendarFailures', 'Échecs Cal.com', calendarFailures, '/admin/planning?calendarStatus=FAILED&calendarStatus=RETRYING'),
      queue('emailFailures', 'Envois en échec', emailFailures, '/admin/messages?status=FAILED&actionableOnly=true'),
    ],
    // Zone 5 — Demandes reçues.
    requests: [
      queue('newRequests', 'Demandes non lues', newRequests, '/admin/demandes?status=NEW'),
    ],
    // Zone 6 — Résumé. Revenue is stated net, with the deductions shown rather than
    // folded away, because a verified payment on a cancelled booking is not income.
    summary: {
      reservationsThisMonth,
      uniqueCustomers,
      revenue: {
        net: grossActive - refundedAmount,
        onActiveReservations: grossActive,
        onCancelledReservations: onCancelled,
        refunded: refundedAmount,
      },
    },
  };
};
