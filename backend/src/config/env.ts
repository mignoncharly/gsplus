import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

const parsePort = (value: string | undefined, fallback: number) => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : fallback;
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes'].includes(value.toLowerCase());
};

const adminSessionSecret =
  process.env.ADMIN_SESSION_SECRET ??
  (process.env.NODE_ENV === 'production' ? undefined : 'dev-admin-session-secret-change-me');

if (!adminSessionSecret) {
  throw new Error('ADMIN_SESSION_SECRET is required in production.');
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  HOST: process.env.HOST ?? (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0'),
  PORT: parsePort(process.env.PORT, 4000),
  TRUST_PROXY: parseBoolean(process.env.TRUST_PROXY, false),
  UPLOAD_DIR: path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), '..', 'uploads')),
  PRIVATE_MEDIA_DIR: path.resolve(process.env.PRIVATE_MEDIA_DIR ?? path.join(process.cwd(), '..', 'private-media')),
  UPLOAD_PUBLIC_PATH: process.env.UPLOAD_PUBLIC_PATH ?? '/uploads',
  ADMIN_SESSION_SECRET: adminSessionSecret,
  ADMIN_SESSION_TTL_SECONDS: parsePort(process.env.ADMIN_SESSION_TTL_SECONDS, 60 * 60 * 8),
  ADMIN_NOTIFICATION_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL ?? 'info@gsplus.vip',
  NOTIFICATION_WORKER_ENABLED: parseBoolean(process.env.NOTIFICATION_WORKER_ENABLED, true),
  NOTIFICATION_WORKER_INTERVAL_MS: parsePort(process.env.NOTIFICATION_WORKER_INTERVAL_MS, 15_000),
  NOTIFICATION_BATCH_SIZE: parsePort(process.env.NOTIFICATION_BATCH_SIZE, 20),
  NOTIFICATION_LOCK_TIMEOUT_SECONDS: parsePort(process.env.NOTIFICATION_LOCK_TIMEOUT_SECONDS, 300),
  EMAIL_DELIVERY_ENABLED: parseBoolean(process.env.EMAIL_DELIVERY_ENABLED, false),
  SMTP_HOST: process.env.SMTP_HOST ?? '',
  SMTP_PORT: parsePort(process.env.SMTP_PORT, 587),
  SMTP_SECURE: parseBoolean(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM ?? 'Golden Studio Plus <info@gsplus.vip>',
  WHATSAPP_DELIVERY_ENABLED: parseBoolean(process.env.WHATSAPP_DELIVERY_ENABLED, false),
  WHATSAPP_GRAPH_API_BASE_URL: process.env.WHATSAPP_GRAPH_API_BASE_URL ?? 'https://graph.facebook.com',
  WHATSAPP_GRAPH_API_VERSION: process.env.WHATSAPP_GRAPH_API_VERSION ?? 'v23.0',
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
  WHATSAPP_TEMPLATE_LANGUAGE: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'fr',
  WHATSAPP_TEMPLATE_BOOKING_RECEIVED: process.env.WHATSAPP_TEMPLATE_BOOKING_RECEIVED ?? '',
  WHATSAPP_TEMPLATE_BOOKING_CONFIRMED: process.env.WHATSAPP_TEMPLATE_BOOKING_CONFIRMED ?? '',
  WHATSAPP_TEMPLATE_BOOKING_RESCHEDULED: process.env.WHATSAPP_TEMPLATE_BOOKING_RESCHEDULED ?? '',
  WHATSAPP_TEMPLATE_BOOKING_REJECTED: process.env.WHATSAPP_TEMPLATE_BOOKING_REJECTED ?? '',
  WHATSAPP_TEMPLATE_PAYMENT_VERIFIED: process.env.WHATSAPP_TEMPLATE_PAYMENT_VERIFIED ?? '',
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  CALCOM_API_BASE_URL: process.env.CALCOM_API_BASE_URL ?? 'https://api.cal.com/v2',
  CALCOM_API_VERSION: process.env.CALCOM_API_VERSION ?? '2024-06-14',
  CALENDAR_LOCK_TIMEOUT_SECONDS: parsePort(process.env.CALENDAR_LOCK_TIMEOUT_SECONDS, 300),
  CALCOM_API_KEY: process.env.CALCOM_API_KEY,
  CALCOM_EVENT_TYPE_ID: process.env.CALCOM_EVENT_TYPE_ID,
  CALCOM_TIME_ZONE: process.env.CALCOM_TIME_ZONE ?? 'Africa/Douala',
  CLIENT_ORIGINS: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
