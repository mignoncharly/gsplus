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
  // Keep database encryption independent from JWT signing so routine session-key
  // rotation does not invalidate enrolled authenticators. The fallback eases rollout;
  // production should set the dedicated value before the first enrolment.
  ADMIN_TOTP_ENCRYPTION_KEY: process.env.ADMIN_TOTP_ENCRYPTION_KEY ?? adminSessionSecret,
  // Temporary, during a controlled TOTP-key rotation only. Successful sign-ins reseal
  // their TOTP secret with the current key; remove this once every active account has.
  ADMIN_TOTP_ENCRYPTION_PREVIOUS_KEY: process.env.ADMIN_TOTP_ENCRYPTION_PREVIOUS_KEY,
  ADMIN_SESSION_TTL_SECONDS: parsePort(process.env.ADMIN_SESSION_TTL_SECONDS, 60 * 60 * 8),
  ADMIN_NOTIFICATION_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL ?? 'info@gsplus.vip',
  QA_NOTIFICATION_OVERRIDE_RESERVATION_IDS: (process.env.QA_NOTIFICATION_OVERRIDE_RESERVATION_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
  NOTIFICATION_WORKER_ENABLED: parseBoolean(process.env.NOTIFICATION_WORKER_ENABLED, true),
  NOTIFICATION_WORKER_INTERVAL_MS: parsePort(process.env.NOTIFICATION_WORKER_INTERVAL_MS, 15_000),
  NOTIFICATION_BATCH_SIZE: parsePort(process.env.NOTIFICATION_BATCH_SIZE, 20),
  NOTIFICATION_LOCK_TIMEOUT_SECONDS: parsePort(process.env.NOTIFICATION_LOCK_TIMEOUT_SECONDS, 300),
  PAYMENT_VERIFIED_NOTICE_DELAY_MS: parsePort(process.env.PAYMENT_VERIFIED_NOTICE_DELAY_MS, 5 * 60 * 1000),
  PAYMENT_DECISION_OVERDUE_DELAY_MS: parsePort(process.env.PAYMENT_DECISION_OVERDUE_DELAY_MS, 30 * 60 * 1000),
  EMAIL_DELIVERY_ENABLED: parseBoolean(process.env.EMAIL_DELIVERY_ENABLED, false),
  SMTP_HOST: process.env.SMTP_HOST ?? '',
  SMTP_PORT: parsePort(process.env.SMTP_PORT, 587),
  SMTP_SECURE: parseBoolean(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM ?? 'Golden Studio Plus <info@gsplus.vip>',
  EMAIL_DELIVERY_WEBHOOK_SECRET: process.env.EMAIL_DELIVERY_WEBHOOK_SECRET,
  ZOHO_MAIL_SMTP_LOGS_SYNC_ENABLED: parseBoolean(process.env.ZOHO_MAIL_SMTP_LOGS_SYNC_ENABLED, false),
  ZOHO_MAIL_ACCOUNTS_BASE_URL: process.env.ZOHO_MAIL_ACCOUNTS_BASE_URL ?? 'https://accounts.zoho.eu',
  ZOHO_MAIL_API_BASE_URL: process.env.ZOHO_MAIL_API_BASE_URL ?? 'https://mail.zoho.eu',
  ZOHO_MAIL_ORG_ID: process.env.ZOHO_MAIL_ORG_ID,
  ZOHO_MAIL_CLIENT_ID: process.env.ZOHO_MAIL_CLIENT_ID,
  ZOHO_MAIL_CLIENT_SECRET: process.env.ZOHO_MAIL_CLIENT_SECRET,
  ZOHO_MAIL_REFRESH_TOKEN: process.env.ZOHO_MAIL_REFRESH_TOKEN,
  ZOHO_MAIL_SMTP_LOGS_SYNC_INTERVAL_MS: parsePort(
    process.env.ZOHO_MAIL_SMTP_LOGS_SYNC_INTERVAL_MS,
    5 * 60 * 1000,
  ),
  ZOHO_MAIL_SMTP_LOGS_LOOKBACK_MS: parsePort(
    process.env.ZOHO_MAIL_SMTP_LOGS_LOOKBACK_MS,
    24 * 60 * 60 * 1000,
  ),
  ZOHO_MAIL_SMTP_LOGS_PAGE_SIZE: parsePort(process.env.ZOHO_MAIL_SMTP_LOGS_PAGE_SIZE, 100),
  ZOHO_MAIL_SMTP_LOGS_MAX_PAGES: parsePort(process.env.ZOHO_MAIL_SMTP_LOGS_MAX_PAGES, 10),
  ZOHO_MAIL_TIMEOUT_MS: parsePort(process.env.ZOHO_MAIL_TIMEOUT_MS, 15_000),
  WHATSAPP_DELIVERY_ENABLED: parseBoolean(process.env.WHATSAPP_DELIVERY_ENABLED, false),
  WHATSAPP_GRAPH_API_BASE_URL: process.env.WHATSAPP_GRAPH_API_BASE_URL ?? 'https://graph.facebook.com',
  WHATSAPP_GRAPH_API_VERSION: process.env.WHATSAPP_GRAPH_API_VERSION ?? 'v23.0',
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
  WHATSAPP_BUSINESS_RECIPIENT: process.env.WHATSAPP_BUSINESS_RECIPIENT ?? '+237673026654',
  WHATSAPP_TIMEOUT_MS: parsePort(process.env.WHATSAPP_TIMEOUT_MS, 10_000),
  WHATSAPP_TEMPLATE_LANGUAGE: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'fr',
  WHATSAPP_TEMPLATE_BOOKING_RECEIVED_ADMIN: process.env.WHATSAPP_TEMPLATE_BOOKING_RECEIVED_ADMIN ?? '',
  WHATSAPP_TEMPLATE_BOOKING_RECEIVED: process.env.WHATSAPP_TEMPLATE_BOOKING_RECEIVED ?? '',
  WHATSAPP_TEMPLATE_BOOKING_CONFIRMED: process.env.WHATSAPP_TEMPLATE_BOOKING_CONFIRMED ?? '',
  WHATSAPP_TEMPLATE_BOOKING_RESCHEDULED: process.env.WHATSAPP_TEMPLATE_BOOKING_RESCHEDULED ?? '',
  WHATSAPP_TEMPLATE_BOOKING_REJECTED: process.env.WHATSAPP_TEMPLATE_BOOKING_REJECTED ?? '',
  WHATSAPP_TEMPLATE_PAYMENT_VERIFIED: process.env.WHATSAPP_TEMPLATE_PAYMENT_VERIFIED ?? '',
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  CALCOM_API_BASE_URL: process.env.CALCOM_API_BASE_URL ?? 'https://api.cal.com/v2',
  CALCOM_API_VERSION: process.env.CALCOM_API_VERSION ?? '2026-02-25',
  CALCOM_EVENT_TYPES_API_VERSION: process.env.CALCOM_EVENT_TYPES_API_VERSION ?? '2024-06-14',
  CALCOM_BOOKINGS_LIST_API_VERSION: process.env.CALCOM_BOOKINGS_LIST_API_VERSION ?? '2026-05-01',
  CALCOM_TIMEOUT_MS: parsePort(process.env.CALCOM_TIMEOUT_MS, 10_000),
  CALENDAR_WORKER_ENABLED: parseBoolean(process.env.CALENDAR_WORKER_ENABLED, true),
  CALENDAR_WORKER_INTERVAL_MS: parsePort(process.env.CALENDAR_WORKER_INTERVAL_MS, 15_000),
  CALENDAR_BATCH_SIZE: parsePort(process.env.CALENDAR_BATCH_SIZE, 20),
  CALENDAR_LOCK_TIMEOUT_SECONDS: parsePort(process.env.CALENDAR_LOCK_TIMEOUT_SECONDS, 300),
  CALCOM_API_KEY: process.env.CALCOM_API_KEY,
  CALCOM_EVENT_TYPE_ID: process.env.CALCOM_EVENT_TYPE_ID,
  CALCOM_TIME_ZONE: process.env.CALCOM_TIME_ZONE ?? 'Africa/Douala',
  CALCOM_SCHEDULE_ID: process.env.CALCOM_SCHEDULE_ID,
  // A custom gateway is optional. When it is absent, the server uses DeepL directly.
  // The legacy token name is retained so existing deployments do not need a secret move.
  CONTENT_TRANSLATION_URL: process.env.CONTENT_TRANSLATION_URL ?? '',
  CONTENT_TRANSLATION_TOKEN: process.env.CONTENT_TRANSLATION_TOKEN ?? '',
  DEEPL_API_KEY: process.env.DEEPL_API_KEY ?? process.env.CONTENT_TRANSLATION_TOKEN ?? '',
  DEEPL_API_URL: process.env.DEEPL_API_URL ?? '',
  CONTENT_TRANSLATION_TIMEOUT_MS: parsePort(process.env.CONTENT_TRANSLATION_TIMEOUT_MS, 15_000),
  CLIENT_ORIGINS: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
