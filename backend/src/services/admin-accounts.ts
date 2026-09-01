import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors/http-error.js';
import { AdminRole, type AdminUser } from '../generated/prisma/client.js';
import { ADMIN_PERMISSIONS, effectiveAdminPermissions, isAdminPermission, refreshAdminPermissionGrants, rolePermissions } from './admin-permissions.js';
import { generateTotpSecret, totpProvisioningUri, verifyTotp } from '../utils/totp.js';
import { openSecret, sealSecret } from '../utils/secret-box.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RECOVERY_CODE_COUNT = 8;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const normaliseEmail = (email: string) => email.trim().toLowerCase();

export const listAdminAccounts = async () => {
  const accounts = await prisma.adminUser.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: {
      permissionGrants: { select: { permission: true, grantedAt: true, grantedBy: { select: { id: true, name: true } } } },
      invitedBy: { select: { id: true, name: true } },
      sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } },
    },
  });
  return accounts.map((account) => ({
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
    isActive: account.isActive,
    // An invitation that was never accepted is a different state from an active account,
    // and the difference matters when deciding who still has a way in.
    invitationPending: Boolean(account.invitationTokenHash) && !account.activatedAt,
    invitationExpiresAt: account.invitationExpiresAt,
    invitedBy: account.invitedBy,
    activatedAt: account.activatedAt,
    deactivatedAt: account.deactivatedAt,
    lastSignInAt: account.lastSignInAt,
    twoFactorEnabled: Boolean(account.totpConfirmedAt),
    activeSessionCount: account.sessions.length,
    rolePermissions: rolePermissions(account.role),
    grantedPermissions: account.permissionGrants.map((grant) => grant.permission),
    effectivePermissions: effectiveAdminPermissions(account),
  }));
};

export const inviteAdminAccount = async (
  input: { email: string; name: string; role: AdminRole },
  invitedById: string,
) => {
  const email = normaliseEmail(input.email);
  if (await prisma.adminUser.findUnique({ where: { email } })) {
    throw new HttpError(409, 'ADMIN_EMAIL_EXISTS', 'Un compte utilise déjà cette adresse.');
  }
  const token = randomBytes(32).toString('base64url');
  const account = await prisma.adminUser.create({
    data: {
      email,
      name: input.name.trim(),
      role: input.role,
      // No password until the invitation is accepted. A random hash means the account
      // cannot be signed into in the meantime, even by accident.
      passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
      isActive: true,
      invitationTokenHash: hashToken(token),
      invitationExpiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      invitedById,
    },
  });
  // The clear token is returned once, to be handed over out of band. It is never stored.
  return { account, token };
};

export const acceptAdminInvitation = async (token: string, password: string) => {
  const account = await prisma.adminUser.findUnique({ where: { invitationTokenHash: hashToken(token) } });
  if (!account || !account.isActive) throw new HttpError(404, 'INVITATION_NOT_FOUND', 'Cette invitation n’est plus valable.');
  if (account.activatedAt) throw new HttpError(409, 'INVITATION_ALREADY_USED', 'Cette invitation a déjà été utilisée.');
  if (!account.invitationExpiresAt || account.invitationExpiresAt <= new Date()) {
    throw new HttpError(410, 'INVITATION_EXPIRED', 'Cette invitation a expiré. Demandez-en une nouvelle.');
  }
  return prisma.adminUser.update({
    where: { id: account.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      activatedAt: new Date(),
      invitationTokenHash: null,
      invitationExpiresAt: null,
    },
  });
};

/**
 * Deactivation, not deletion.
 *
 * An account is attached to audit entries, transitions and published versions; deleting it
 * would either fail on a foreign key or erase who did what. Deactivating withdraws every
 * way in — the flag, the session version, and each open session — and leaves the history
 * intact.
 */
export const setAdminAccountActive = async (adminUserId: string, isActive: boolean, actorId: string) => {
  if (adminUserId === actorId && !isActive) {
    throw new HttpError(422, 'ADMIN_CANNOT_DEACTIVATE_SELF', 'Vous ne pouvez pas désactiver votre propre compte.');
  }
  const account = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!account) throw new HttpError(404, 'ADMIN_NOT_FOUND', 'Compte introuvable.');

  if (!isActive && account.role === AdminRole.OWNER) {
    const owners = await prisma.adminUser.count({ where: { role: AdminRole.OWNER, isActive: true } });
    // Locking every owner out of the administration is not a state to allow by accident.
    if (owners <= 1) throw new HttpError(422, 'ADMIN_LAST_OWNER', 'Le dernier propriétaire actif ne peut pas être désactivé.');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.adminUser.update({
      where: { id: adminUserId },
      data: {
        isActive,
        deactivatedAt: isActive ? null : new Date(),
        ...(isActive ? {} : { sessionVersion: { increment: 1 } }),
      },
    });
    if (!isActive) {
      await tx.adminSession.updateMany({
        where: { adminUserId, revokedAt: null },
        data: { revokedAt: new Date(), revokedById: actorId, revokedReason: 'ACCOUNT_DEACTIVATED' },
      });
    }
    return updated;
  });
};

export const setAdminAccountRole = async (adminUserId: string, role: AdminRole, actorId: string) => {
  const account = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!account) throw new HttpError(404, 'ADMIN_NOT_FOUND', 'Compte introuvable.');
  if (account.role === AdminRole.OWNER && role !== AdminRole.OWNER) {
    const owners = await prisma.adminUser.count({ where: { role: AdminRole.OWNER, isActive: true } });
    if (owners <= 1) throw new HttpError(422, 'ADMIN_LAST_OWNER', 'Le dernier propriétaire actif doit le rester.');
  }
  if (adminUserId === actorId && role !== AdminRole.OWNER) {
    throw new HttpError(422, 'ADMIN_CANNOT_DEMOTE_SELF', 'Vous ne pouvez pas retirer votre propre rôle de propriétaire.');
  }
  return prisma.adminUser.update({ where: { id: adminUserId }, data: { role } });
};

export const setAdminPermissionGrants = async (adminUserId: string, permissions: string[], grantedById: string) => {
  const account = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!account) throw new HttpError(404, 'ADMIN_NOT_FOUND', 'Compte introuvable.');
  const unknown = permissions.filter((permission) => !isAdminPermission(permission));
  if (unknown.length) throw new HttpError(422, 'ADMIN_PERMISSION_UNKNOWN', 'Droit inconnu.', { permissions: unknown });

  // A grant on top of what the role already carries is noise, not a right: it would look
  // removable and removing it would change nothing.
  const roleAlready = new Set<string>(rolePermissions(account.role));
  const redundant = permissions.filter((permission) => roleAlready.has(permission));
  if (redundant.length) {
    throw new HttpError(422, 'ADMIN_PERMISSION_REDUNDANT', 'Ce rôle possède déjà ce droit.', { permissions: redundant });
  }

  await prisma.$transaction([
    prisma.adminPermissionGrant.deleteMany({ where: { adminUserId, permission: { notIn: permissions } } }),
    ...permissions.map((permission) => prisma.adminPermissionGrant.upsert({
      where: { adminUserId_permission: { adminUserId, permission } },
      update: {},
      create: { adminUserId, permission, grantedById },
    })),
  ]);
  await refreshAdminPermissionGrants();
  return prisma.adminPermissionGrant.findMany({ where: { adminUserId } });
};

export const listAdminSessions = async (query: { adminUserId?: string; limit: number; offset: number; status?: 'active' | 'revoked' | 'expired'; q?: string }) => {
  const now = new Date();
  const and: import('../generated/prisma/client.js').Prisma.AdminSessionWhereInput[] = [];
  if (query.adminUserId) and.push({ adminUserId: query.adminUserId });
  if (query.status === 'active') and.push({ revokedAt: null, expiresAt: { gt: now } });
  if (query.status === 'revoked') and.push({ revokedAt: { not: null } });
  if (query.status === 'expired') and.push({ revokedAt: null, expiresAt: { lte: now } });
  if (query.q) { const text = { contains: query.q.trim(), mode: 'insensitive' as const }; and.push({ OR: [{ ipAddress: text }, { userAgent: text }, { admin: { is: { name: text } } }, { admin: { is: { email: text } } }] }); }
  const where = and.length ? { AND: and } : {};
  const [sessions, total] = await Promise.all([
    prisma.adminSession.findMany({ where, orderBy: [{ revokedAt: 'asc' }, { lastSeenAt: 'desc' }], take: query.limit, skip: query.offset, include: { admin: { select: { id: true, name: true, email: true } }, revokedBy: { select: { id: true, name: true } } } }),
    prisma.adminSession.count({ where }),
  ]);
  return { items: sessions.map((session) => ({ ...session, isCurrentlyValid: !session.revokedAt && session.expiresAt > now })), total, limit: query.limit, offset: query.offset };
};

export const revokeAdminSession = async (sessionId: string, actorId: string, reason = 'REVOKED_BY_ADMIN') => {
  const session = await prisma.adminSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new HttpError(404, 'ADMIN_SESSION_NOT_FOUND', 'Session introuvable.');
  if (session.revokedAt) return session;
  return prisma.adminSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date(), revokedById: actorId, revokedReason: reason },
  });
};

// === Two-factor ===

export const beginTotpEnrolment = async (admin: AdminUser) => {
  const secret = generateTotpSecret();
  await prisma.adminUser.update({
    where: { id: admin.id },
    // Stored but unconfirmed: the secret only takes effect once a code proves the
    // authenticator actually holds it, so a half-finished enrolment cannot lock anyone out.
    data: { totpSecretEncrypted: sealSecret(secret), totpConfirmedAt: null },
  });
  return { secret, uri: totpProvisioningUri(secret, admin.email) };
};

export const confirmTotpEnrolment = async (admin: AdminUser, code: string) => {
  const account = await prisma.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
  if (!account.totpSecretEncrypted) throw new HttpError(409, 'TOTP_NOT_STARTED', 'Aucune configuration en cours.');
  if (account.totpConfirmedAt) throw new HttpError(409, 'TOTP_ALREADY_CONFIRMED', 'La double authentification est déjà active.');
  if (!verifyTotp(openSecret(account.totpSecretEncrypted), code)) {
    throw new HttpError(422, 'TOTP_CODE_INVALID', 'Ce code est incorrect ou expiré.');
  }

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomBytes(5).toString('hex').toUpperCase());
  await prisma.$transaction([
    prisma.adminUser.update({ where: { id: admin.id }, data: { totpConfirmedAt: new Date() } }),
    prisma.adminRecoveryCode.deleteMany({ where: { adminUserId: admin.id } }),
    prisma.adminRecoveryCode.createMany({
      data: codes.map((code) => ({ adminUserId: admin.id, codeHash: hashToken(code) })),
    }),
  ]);
  // Shown once. They are hashed, so nobody — including the studio — can read them back.
  return { recoveryCodes: codes };
};

export const disableTotp = async (adminUserId: string) => prisma.$transaction([
  prisma.adminUser.update({ where: { id: adminUserId }, data: { totpSecretEncrypted: null, totpConfirmedAt: null } }),
  prisma.adminRecoveryCode.deleteMany({ where: { adminUserId } }),
]);

export const verifySecondFactor = async (account: AdminUser, code: string) => {
  if (!account.totpConfirmedAt || !account.totpSecretEncrypted) return true;
  const candidate = String(code ?? '').trim();
  if (!candidate) return false;
  const secret = openSecret(account.totpSecretEncrypted);
  if (verifyTotp(secret, candidate)) {
    // During a key rollover `openSecret` may have used the previous key. Every successful
    // TOTP use then migrates that one account to the current key without exposing it.
    await prisma.adminUser.update({ where: { id: account.id }, data: { totpSecretEncrypted: sealSecret(secret) } });
    return true;
  }

  // A recovery code is single use, and burning it is the whole point.
  const normalised = candidate.toUpperCase().replace(/\s|-/g, '');
  const hash = hashToken(normalised);
  const match = await prisma.adminRecoveryCode.findFirst({ where: { adminUserId: account.id, codeHash: hash, usedAt: null } });
  if (!match) return false;
  await prisma.$transaction([
    prisma.adminRecoveryCode.update({ where: { id: match.id }, data: { usedAt: new Date() } }),
    prisma.adminUser.update({ where: { id: account.id }, data: { totpSecretEncrypted: sealSecret(secret) } }),
  ]);
  return true;
};

export const remainingRecoveryCodes = (adminUserId: string) =>
  prisma.adminRecoveryCode.count({ where: { adminUserId, usedAt: null } });

export const ADMIN_PERMISSION_CATALOGUE = ADMIN_PERMISSIONS;
