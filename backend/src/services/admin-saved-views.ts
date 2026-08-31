import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';

export const listAdminSavedViews = async (adminUserId: string, scope: string) =>
  prisma.adminSavedView.findMany({
    where: { adminUserId, scope },
    orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
  });

export const saveAdminSavedView = async (adminUserId: string, input: { scope: string; name: string; filters: Prisma.InputJsonValue }) =>
  prisma.adminSavedView.upsert({
    where: { adminUserId_scope_name: { adminUserId, scope: input.scope, name: input.name } },
    create: { adminUserId, scope: input.scope, name: input.name, filters: input.filters },
    update: { filters: input.filters },
  });

export const deleteAdminSavedView = async (adminUserId: string, id: string) => {
  const deleted = await prisma.adminSavedView.deleteMany({ where: { id, adminUserId } });
  if (deleted.count === 0) throw new HttpError(404, 'SAVED_VIEW_NOT_FOUND', 'Vue enregistrée introuvable.');
};
