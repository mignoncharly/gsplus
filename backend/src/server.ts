import { createApp } from './app.js';
import { env } from './config/env.js';
import { startNotificationWorker } from './emails/notifications.js';
import { startCalendarWorker } from './services/calendar.js';
import { startZohoMailSmtpLogsWorker } from './services/zoho-mail-smtp-logs-sync.js';

const app = createApp();
const stopNotificationWorker = startNotificationWorker();
const stopCalendarWorker = startCalendarWorker();
const stopZohoMailSmtpLogsWorker = startZohoMailSmtpLogsWorker();

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`Golden Studio Plus API listening on ${env.HOST}:${env.PORT}`);
});

server.on('error', (error) => {
  console.error('Failed to start Golden Studio Plus API', error);
  process.exit(1);
});

process.on('SIGTERM', () => {
  stopNotificationWorker();
  stopCalendarWorker();
  stopZohoMailSmtpLogsWorker();
  server.close(() => {
    process.exit(0);
  });
});
