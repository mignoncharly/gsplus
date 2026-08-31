import { createApp } from './app.js';
import { env } from './config/env.js';
import { startNotificationWorker } from './emails/notifications.js';
import { startCalendarWorker } from './services/calendar.js';
import { startZohoMailSmtpLogsWorker } from './services/zoho-mail-smtp-logs-sync.js';
import { refreshTemplateOverrides } from './services/message-template-overrides.js';
import { refreshMessageRules } from './services/message-rules.js';
import { refreshAdminPermissionGrants } from './services/admin-permissions.js';

const app = createApp();
// Load published template overrides before the workers start rendering. A failure here
// is not fatal: the cache stays empty and every template renders from code.
void refreshTemplateOverrides();
void refreshMessageRules();
// Per-account grants are fail-closed until this cache has loaded. Refreshing also lets a
// second API process observe changes made by the first without a restart.
void refreshAdminPermissionGrants();
// Re-read periodically so a publish from another process is picked up without a restart.
const templateOverrideTimer = setInterval(() => {
  void refreshTemplateOverrides();
  void refreshMessageRules();
  void refreshAdminPermissionGrants();
}, 60_000);
templateOverrideTimer.unref?.();

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
  clearInterval(templateOverrideTimer);
  stopNotificationWorker();
  stopCalendarWorker();
  stopZohoMailSmtpLogsWorker();
  server.close(() => {
    process.exit(0);
  });
});
