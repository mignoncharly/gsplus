import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { CookieOptions, Request, Response } from 'express';

import { env } from '../config/env.js';
import { HttpError } from '../errors/http-error.js';
import type { AdminUser } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';

export const ADMIN_SESSION_COOKIE = 'gsp_admin_session';
export const ADMIN_SESSION_COOKIE_PRODUCTION = '__Host-gsp_admin_session';
const ADMIN_SESSION_ISSUER = 'golden-studio-plus';
const ADMIN_SESSION_AUDIENCE = 'golden-studio-plus-admin';

type AdminSessionPayload = JwtPayload & {
  sub: string;
  role: AdminUser['role'];
  sessionVersion: number;
  /**
   * The session record this cookie belongs to.
   *
   * `sessionVersion` is a kill switch for *every* device at once, which is the wrong tool
   * for "sign out my old phone". Absent on cookies issued before this existed, and those
   * keep working until they expire rather than logging everyone out on deployment.
   */
  sid?: string;
};

export type SessionContext = { userAgent?: string | null; ipAddress?: string | null };

const requestContext = (req: Request): SessionContext => ({
  userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
  ipAddress: req.ip ?? null,
});

const adminSessionCookieName = () =>
  env.NODE_ENV === 'production' ? ADMIN_SESSION_COOKIE_PRODUCTION : ADMIN_SESSION_COOKIE;

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: env.ADMIN_SESSION_TTL_SECONDS * 1000,
});

export const publicAdminUser = (admin: AdminUser) => ({
  id: admin.id,
  email: admin.email,
  name: admin.name,
  role: admin.role,
  twoFactorEnabled: Boolean(admin.totpConfirmedAt),
});

export const setAdminSessionCookie = (res: Response, admin: AdminUser, sessionId?: string) => {
  const token = jwt.sign(
    {
      role: admin.role,
      sessionVersion: admin.sessionVersion,
      ...(sessionId ? { sid: sessionId } : {}),
    },
    env.ADMIN_SESSION_SECRET,
    {
      algorithm: 'HS256',
      audience: ADMIN_SESSION_AUDIENCE,
      issuer: ADMIN_SESSION_ISSUER,
      subject: admin.id,
      expiresIn: env.ADMIN_SESSION_TTL_SECONDS,
    },
  );

  if (env.NODE_ENV === 'production') {
    res.clearCookie(ADMIN_SESSION_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });
  }
  res.cookie(adminSessionCookieName(), token, cookieOptions());
};

export const clearAdminSessionCookie = (res: Response) => {
  res.clearCookie(adminSessionCookieName(), {
    ...cookieOptions(),
    maxAge: undefined,
  });

  if (env.NODE_ENV === 'production') {
    res.clearCookie(ADMIN_SESSION_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });
  }
};

export const verifyAdminCredentials = async (email: string, password: string) => {
  const admin = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (!admin || !admin.isActive) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
  if (!passwordMatches) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  return admin;
};

export const changeAdminPassword = async (
  admin: AdminUser,
  currentPassword: string,
  newPassword: string,
) => {
  const currentPasswordMatches = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!currentPasswordMatches) {
    throw new HttpError(400, 'CURRENT_PASSWORD_INVALID', 'Le mot de passe actuel est incorrect.');
  }

  if (currentPassword === newPassword) {
    throw new HttpError(400, 'PASSWORD_UNCHANGED', 'Le nouveau mot de passe doit être différent du mot de passe actuel.');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  return prisma.$transaction(async (transaction) => {
    const result = await transaction.adminUser.updateMany({
      where: { id: admin.id, isActive: true, sessionVersion: admin.sessionVersion },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    if (result.count !== 1) {
      throw new HttpError(409, 'ADMIN_SESSION_CHANGED', 'La session a changé. Reconnectez-vous avant de réessayer.');
    }

    const updatedAdmin = await transaction.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
    await transaction.adminSession.updateMany({
      where: { adminUserId: admin.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedById: admin.id, revokedReason: 'PASSWORD_CHANGED' },
    });
    await transaction.auditLog.create({
      data: {
        adminUserId: admin.id,
        action: 'admin.password.change',
        entityType: 'AdminUser',
        entityId: admin.id,
        metadata: { otherSessionsInvalidated: true },
      },
    });
    return updatedAdmin;
  });
};
/** Record a signed-in device, so it can be listed and withdrawn on its own. */
export const startAdminSession = async (admin: AdminUser, req: Request) => {
  const context = requestContext(req);
  return prisma.adminSession.create({
    data: {
      adminUserId: admin.id,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      expiresAt: new Date(Date.now() + env.ADMIN_SESSION_TTL_SECONDS * 1000),
    },
  });
};

export const getAdminFromRequest = async (req: Request) => {
  const token = req.cookies?.[adminSessionCookieName()];
  if (!token) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Admin authentication required.');
  }

  let payload: AdminSessionPayload;
  try {
    payload = jwt.verify(token, env.ADMIN_SESSION_SECRET, {
      algorithms: ['HS256'],
      audience: ADMIN_SESSION_AUDIENCE,
      issuer: ADMIN_SESSION_ISSUER,
    }) as unknown as AdminSessionPayload;
  } catch {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Admin session is invalid or expired.');
  }

  if (typeof payload.sub !== 'string' || !Number.isInteger(payload.sessionVersion)) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Admin session is invalid or expired.');
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: payload.sub },
  });

  if (!admin || !admin.isActive || admin.sessionVersion !== payload.sessionVersion) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Admin session is invalid or expired.');
  }

  if (payload.sid) {
    const session = await prisma.adminSession.findUnique({ where: { id: payload.sid } });
    // A cookie whose session was withdrawn, expired or deleted is no longer a session.
    if (!session || session.adminUserId !== admin.id || session.revokedAt || session.expiresAt <= new Date()) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Admin session is invalid or expired.');
    }
    // Best effort: "last seen" is worth having, and is never worth failing a request for.
    void prisma.adminSession
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  return admin;
};

export const recordSignInAttempt = async (
  email: string,
  req: Request,
  succeeded: boolean,
  failureCode?: string,
) => {
  const context = requestContext(req);
  // Never let the record of an attempt decide whether the attempt itself succeeds.
  await prisma.adminSignInAttempt
    .create({ data: { email: email.trim().toLowerCase(), ipAddress: context.ipAddress, userAgent: context.userAgent, succeeded, failureCode } })
    .catch(() => undefined);
};
