import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';

export const FINANCIAL_TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] as const;
export type FinancialTaskStatus = typeof FINANCIAL_TASK_STATUSES[number];
export type FinancialTaskListFilters = {
  limit: number;
  offset: number;
  status?: FinancialTaskStatus[];
  overdue?: boolean;
  reservationReference?: string;
  operatorId?: string;
};

export const financialTaskInclude = {
  reservation: {
    select: {
      id: true, reference: true, status: true, startAt: true,
      snapshot: { select: { firstName: true, lastName: true, notificationPhoneE164: true, notificationEmail: true, packageName: true } },
      customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
    },
  },
  payment: { select: { id: true, version: true, status: true, method: true, amount: true, refundAmount: true, transactionRef: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.FinancialTaskInclude;

export const listFinancialTasks = async (filters: FinancialTaskListFilters) => {
  const statuses = filters.overdue
    ? (filters.status?.filter((status) => status === 'PENDING' || status === 'IN_PROGRESS') ?? ['PENDING', 'IN_PROGRESS'])
    : filters.status;
  const where: Prisma.FinancialTaskWhereInput = {
    ...(statuses?.length ? { status: { in: statuses } } : {}),
    ...(filters.reservationReference ? { reservation: { reference: filters.reservationReference } } : {}),
    ...(filters.operatorId ? { createdById: filters.operatorId } : {}),
    ...(filters.overdue ? { dueAt: { lt: new Date() } } : {}),
  };
  const [items, total, operators] = await prisma.$transaction([
    prisma.financialTask.findMany({ where, take: filters.limit, skip: filters.offset, orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }], include: financialTaskInclude }),
    prisma.financialTask.count({ where }),
    prisma.adminUser.findMany({ where: { financialTasks: { some: {} } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  return { items, total, limit: filters.limit, offset: filters.offset, operators };
};

export const getFinancialTask = async (id: string) => {
  const task = await prisma.financialTask.findUnique({ where: { id }, include: financialTaskInclude });
  if (!task) throw new HttpError(404, 'FINANCIAL_TASK_NOT_FOUND', 'Tâche financière introuvable ou obsolète.');
  return task;
};
