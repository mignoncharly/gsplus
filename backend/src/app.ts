import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { Prisma } from './generated/prisma/client.js';

import { env } from './config/env.js';
import { HttpError } from './errors/http-error.js';
import { apiRateLimiter } from './middleware/security.js';
import apiRoutes from './routes/index.js';

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: {
        code: error.code,
        message:
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Uploaded file is too large.'
            : 'The uploaded file could not be accepted.',
      },
    });
  }

  if (error && typeof error === 'object' && 'type' in error) {
    if (error.type === 'entity.too.large') {
      return res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request body is too large.',
        },
      });
    }

    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'Request body contains invalid JSON.',
        },
      });
    }
  }

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return res.status(409).json({
      error: {
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: 'A record with the same unique value already exists.',
      },
    });
  }

  console.error(error);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    },
  });
};

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY ? 'loopback' : false);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.CLIENT_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed.'));
      },
      credentials: true,
    }),
  );
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buffer) => {
        (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
      },
    }),
  );
  app.use(cookieParser());
  app.use(env.UPLOAD_PUBLIC_PATH, express.static(env.UPLOAD_DIR, { fallthrough: false }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'golden-studio-plus-api' });
  });

  app.use('/api', apiRateLimiter, apiRoutes);

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  app.use(errorHandler);

  return app;
};
