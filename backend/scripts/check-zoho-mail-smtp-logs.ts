import 'dotenv/config';

import { probeZohoMailSmtpLogs } from '../src/services/zoho-mail-smtp-logs.js';

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`ZOHO_SMTP_LOGS_PROBE_ENV_MISSING:${name}`);
  return value;
};

const resolveMessageId = async () => {
  const configured = process.env.ZOHO_MAIL_SMTP_LOGS_PROBE_MESSAGE_ID?.trim();
  if (configured) return configured;
  const { prisma } = await import('../src/db/prisma.js');
  try {
    const event = await prisma.notificationEvent.findFirst({
      where: { templateCode: 'I-11', providerMessageId: { not: null } },
      orderBy: { sentAt: 'desc' },
      select: { providerMessageId: true },
    });
    if (!event?.providerMessageId) throw new Error('ZOHO_SMTP_LOGS_PROBE_MESSAGE_ID_NOT_FOUND');
    return event.providerMessageId;
  } finally {
    await prisma.$disconnect();
  }
};

try {
  const result = await probeZohoMailSmtpLogs({
    organizationId: required('ZOHO_MAIL_ORG_ID'),
    accessToken: required('ZOHO_MAIL_OAUTH_ACCESS_TOKEN'),
    messageId: await resolveMessageId(),
    apiBaseUrl: process.env.ZOHO_MAIL_API_BASE_URL,
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'ZOHO_SMTP_LOGS_PROBE_UNKNOWN_ERROR');
  process.exitCode = 1;
}
