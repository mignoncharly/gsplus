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
};

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
});

export const setAdminSessionCookie = (res: Response, admin: AdminUser) => {
  const token = jwt.sign(
    {
      role: admin.role,
      sessionVersion: admin.sessionVersion,
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

  return admin;
};
