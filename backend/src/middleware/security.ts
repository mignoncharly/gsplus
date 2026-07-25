import { rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import type { Options, RateLimitExceededEventHandler } from 'express-rate-limit';

const rateLimitHandler: RateLimitExceededEventHandler = (_req, res) => {
  res.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
    },
  });
};

const createJsonRateLimiter = (options: Partial<Options>): RequestHandler =>
  rateLimit({
    legacyHeaders: false,
    standardHeaders: 'draft-8',
    handler: rateLimitHandler,
    skip: () => process.env.NODE_ENV === 'test',
    ...options,
  });

export const RATE_LIMIT_POLICIES = {
  api: {
    windowMs: 15 * 60 * 1000,
    limit: 300,
  },
  publicWrite: {
    windowMs: 10 * 60 * 1000,
    limit: 20,
  },
  adminLogin: {
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
  },
} as const;

export const apiRateLimiter = createJsonRateLimiter({
  ...RATE_LIMIT_POLICIES.api,
});

export const publicWriteRateLimiter = createJsonRateLimiter({
  ...RATE_LIMIT_POLICIES.publicWrite,
});

export const adminLoginRateLimiter = createJsonRateLimiter({
  ...RATE_LIMIT_POLICIES.adminLogin,
});
