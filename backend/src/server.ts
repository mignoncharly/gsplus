import { createApp } from './app.js';
import { env } from './config/env.js';
import { startNotificationWorker } from './emails/notifications.js';

const app = createApp();
const stopNotificationWorker = startNotificationWorker();

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`Golden Studio Plus API listening on ${env.HOST}:${env.PORT}`);
});

server.on('error', (error) => {
  console.error('Failed to start Golden Studio Plus API', error);
  process.exit(1);
});

process.on('SIGTERM', () => {
  stopNotificationWorker();
  server.close(() => {
    process.exit(0);
  });
});
