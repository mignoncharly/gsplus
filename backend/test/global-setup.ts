import { execSync } from 'node:child_process';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Client } = pg;

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

const deriveTestDatabaseUrl = () => {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL or TEST_DATABASE_URL is required to run tests.');
  }

  const url = new URL(process.env.DATABASE_URL);
  const databaseName = url.pathname.replace(/^\//, '');
  url.pathname = `/${databaseName.endsWith('_test') ? databaseName : `${databaseName}_test`}`;
  return url.toString();
};

const ensureDatabase = async (databaseUrl: string) => {
  const target = new URL(databaseUrl);
  const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ''));
  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = '/postgres';

  const client = new Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();

  try {
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    }
  } finally {
    await client.end();
  }
};

export default async () => {
  const databaseUrl = deriveTestDatabaseUrl();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = databaseUrl;
  process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ?? 'test-admin-session-secret';
  process.env.SMTP_HOST = '';
  process.env.EMAIL_DELIVERY_WEBHOOK_SECRET = 'test-email-delivery-webhook-secret';
  process.env.TURNSTILE_SECRET_KEY = '';
  process.env.CALCOM_API_BASE_URL = '';
  process.env.CALCOM_API_KEY = '';
  process.env.CALCOM_EVENT_TYPE_ID = '';
  process.env.CALCOM_TIME_ZONE = '';

  await ensureDatabase(databaseUrl);

  execSync('npx prisma migrate deploy', {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32' ? 'cmd.exe' : undefined,
  });
};
