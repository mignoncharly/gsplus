import type { RequestHandler } from 'express';

import { env } from '../config/env.js';
import { HttpError } from '../errors/http-error.js';

type TurnstileResponse = {
  success: boolean;
  'error-codes'?: string[];
};

const blockedByHoneypot = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

const verifyTurnstileToken = async (token: unknown, remoteIp: string | undefined) => {
  if (!env.TURNSTILE_SECRET_KEY) {
    return;
  }

  if (typeof token !== 'string' || token.trim().length === 0) {
    throw new HttpError(400, 'BOT_PROTECTION_REQUIRED', 'Bot protection verification is required.');
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      ...(remoteIp ? { remoteip: remoteIp } : {}),
    }),
  });

  const result = (await response.json()) as TurnstileResponse;
  if (!response.ok || !result.success) {
    throw new HttpError(400, 'BOT_PROTECTION_FAILED', 'Bot protection verification failed.');
  }
};

export const publicWriteProtection: RequestHandler = async (req, _res, next) => {
  try {
    if (blockedByHoneypot(req.body?.website)) {
      throw new HttpError(400, 'BOT_PROTECTION_FAILED', 'Bot protection verification failed.');
    }

    await verifyTurnstileToken(req.body?.turnstileToken, req.ip);

    if (req.body && typeof req.body === 'object') {
      delete req.body.website;
      delete req.body.turnstileToken;
    }

    next();
  } catch (error) {
    next(error);
  }
};
