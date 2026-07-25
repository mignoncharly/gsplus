import type { RequestHandler } from 'express';
import { z, type ZodType } from 'zod';

import { HttpError } from '../errors/http-error.js';

type RequestTarget = 'body' | 'params' | 'query';

const formatIssues = (error: z.ZodError) =>
  error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));

export const validate =
  (target: RequestTarget, schema: ZodType): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      return next(new HttpError(400, 'VALIDATION_ERROR', 'Request validation failed', formatIssues(result.error)));
    }

    res.locals.validated = {
      ...(res.locals.validated ?? {}),
      [target]: result.data,
    };

    if (target !== 'query') {
      req[target] = result.data;
    }

    return next();
  };
