import type { RequestHandler } from 'express';
import { type ZodType } from 'zod';

import { HttpError } from '../errors/http-error.js';
import { formatValidationIssues } from '../utils/validation-localization.js';

type RequestTarget = 'body' | 'params' | 'query';

export const validate =
  (target: RequestTarget, schema: ZodType): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      return next(new HttpError(
        400,
        'VALIDATION_ERROR',
        'Corrigez les champs invalides avant de continuer.',
        formatValidationIssues(result.error.issues),
      ));
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
