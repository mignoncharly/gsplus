import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '../src/config/env.js';
import { prisma } from '../src/db/prisma.js';
import { NotificationStatus } from '../src/generated/prisma/client.js';
import {
  parseZohoSmtpLogCandidates,
  resetZohoMailSmtpLogsTokenCacheForTests,
  syncZohoMailSmtpLogs,
} from '../src/services/zoho-mail-smtp-logs-sync.js';

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const smtpRow = (input: {
  transactionId: string;
  messageId: string;
  recipient: string;
  deliveryStatus: string;
  timeMillis: number;
  reason?: string;
  mailType?: string;
}) => ({
  mailType: input.mailType ?? 'out',
  TransactionID: input.transactionId,
  from: {
    msgId: input.messageId,
    sentTimeMillis: input.timeMillis - 1_000,
    sender: 'sender@example.test',
    reason: '',
  },
  recipients: [{
    rcpt: input.recipient,
    deliveryStatus: input.deliveryStatus,
    deliveryType: 'MAILBOX DELIVERY',
    timeMillis: input.timeMillis,
    reason: input.reason ?? '',
  }],
});

const configureZohoTestEnvironment = () => {
  env.ZOHO_MAIL_ACCOUNTS_BASE_URL = 'https://accounts.zoho.eu';
  env.ZOHO_MAIL_API_BASE_URL = 'https://mail.zoho.eu';
  env.ZOHO_MAIL_ORG_ID = '123456789';
  env.ZOHO_MAIL_CLIENT_ID = 'test-client-id';
  env.ZOHO_MAIL_CLIENT_SECRET = 'test-client-secret';
  env.ZOHO_MAIL_REFRESH_TOKEN = 'test-refresh-token';
  env.ZOHO_MAIL_SMTP_LOGS_SYNC_INTERVAL_MS = 300_000;
  env.ZOHO_MAIL_SMTP_LOGS_LOOKBACK_MS = 86_400_000;
  env.ZOHO_MAIL_SMTP_LOGS_PAGE_SIZE = 2;
  env.ZOHO_MAIL_SMTP_LOGS_MAX_PAGES = 5;
  env.ZOHO_MAIL_TIMEOUT_MS = 5_000;
};

beforeEach(async () => {
  configureZohoTestEnvironment();
  resetZohoMailSmtpLogsTokenCacheForTests();
  await prisma.emailDeliveryReport.deleteMany();
  await prisma.notificationEvent.deleteMany();
});

afterAll(() => prisma.$disconnect());

describe('Zoho Mail SMTP Logs synchronization', () => {
  it('maps only explicit delivery outcomes and hashes provider event identities', () => {
    const rows = [
      smtpRow({
        transactionId: 'transaction-delivered-sensitive',
        messageId: '<delivered@notifications.gsplus.vip>',
        recipient: 'delivered@example.test',
        deliveryStatus: 'delivered',
        timeMillis: 1_786_259_000_000,
      }),
      smtpRow({
        transactionId: 'transaction-temporary-sensitive',
        messageId: '<temporary@notifications.gsplus.vip>',
        recipient: 'temporary@example.test',
        deliveryStatus: 'Retry queue',
        timeMillis: 1_786_259_001_000,
        reason: '451 4.7.1 temporary policy response',
      }),
      smtpRow({
        transactionId: 'transaction-permanent-sensitive',
        messageId: '<permanent@notifications.gsplus.vip>',
        recipient: 'permanent@example.test',
        deliveryStatus: 'Delivery failed',
        timeMillis: 1_786_259_002_000,
        reason: '550 5.1.1 mailbox unavailable',
      }),
      smtpRow({
        transactionId: 'transaction-unknown-sensitive',
        messageId: '<moderated@notifications.gsplus.vip>',
        recipient: 'moderated@example.test',
        deliveryStatus: 'Mail Moderated',
        timeMillis: 1_786_259_003_000,
      }),
      smtpRow({
        transactionId: 'transaction-inbound-sensitive',
        messageId: '<inbound@notifications.gsplus.vip>',
        recipient: 'inbound@example.test',
        deliveryStatus: 'delivered',
        timeMillis: 1_786_259_004_000,
        mailType: 'in',
      }),
    ];

    const candidates = parseZohoSmtpLogCandidates(rows);

    expect(candidates.map((candidate) => candidate.status)).toEqual([
      'DELIVERED',
      'TEMPORARY_FAILURE',
      'PERMANENT_FAILURE',
    ]);
    expect(candidates.map((candidate) => candidate.smtpCode)).toEqual([
      null,
      '451.4.7',
      '550.5.1',
    ]);
    for (const candidate of candidates) {
      expect(candidate.providerEventId).toMatch(/^zoho:[a-f0-9]{64}$/);
      expect(candidate.providerEventId).not.toContain('transaction-');
      expect(candidate.providerEventId).not.toContain('@');
    }
  });

  it('refreshes and validates once, paginates in milliseconds, matches strictly, and replays idempotently', async () => {
    const now = new Date('2026-08-09T12:00:00.000Z');
    const trackedMessageId = '<Tracked-Message@notifications.gsplus.vip>';
    const temporaryMessageId = '<Temporary-Message@notifications.gsplus.vip>';
    await prisma.notificationEvent.create({
      data: {
        channel: 'email',
        type: 'zoho_sync_test',
        recipient: 'tracked@example.test',
        providerMessageId: trackedMessageId,
        providerStatus: 'accepted',
        status: NotificationStatus.SENT,
        attemptCount: 1,
        sentAt: new Date('2026-08-09T11:00:00.000Z'),
      },
    });
    await prisma.notificationEvent.create({
      data: {
        channel: 'email',
        type: 'zoho_temporary_sync_test',
        recipient: 'temporary@example.test',
        providerMessageId: temporaryMessageId,
        providerStatus: 'accepted',
        status: NotificationStatus.SENT,
        attemptCount: 1,
        sentAt: new Date('2026-08-09T11:00:00.000Z'),
      },
    });

    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url === 'https://accounts.zoho.eu/oauth/v2/token') {
        return jsonResponse({ access_token: '1000.test-access-token', expires_in: 3600 });
      }
      if (url === 'https://mail.zoho.eu/api/organization') {
        return jsonResponse({ status: { code: 200 }, data: { zoid: 123456789 } });
      }
      if (url.endsWith('/smtplogs')) {
        const body = JSON.parse(String(init?.body)) as { isNext: boolean; pageKey: string };
        if (!body.isNext) {
          return jsonResponse({
            status: { code: 200 },
            data: {
              hnxt: 'true',
              pagekey: 'next-page-key',
              response: [
                smtpRow({
                  transactionId: 'provider-transaction-1',
                  messageId: trackedMessageId,
                  recipient: 'tracked@example.test',
                  deliveryStatus: 'delivered',
                  timeMillis: now.getTime() - 10_000,
                }),
                smtpRow({
                  transactionId: 'provider-transaction-temporary',
                  messageId: temporaryMessageId,
                  recipient: 'temporary@example.test',
                  deliveryStatus: 'Retry queue',
                  timeMillis: now.getTime() - 8_000,
                  reason: '451 4.7.1 temporary policy response',
                }),
              ],
            },
          });
        }
        expect(body.pageKey).toBe('next-page-key');
        return jsonResponse({
          status: { code: 200 },
          data: {
            hnxt: 'false',
            response: [smtpRow({
              transactionId: 'provider-transaction-2',
              messageId: trackedMessageId,
              recipient: 'different@example.test',
              deliveryStatus: 'Delivery failed',
              timeMillis: now.getTime() - 5_000,
              reason: '550 5.1.1 mailbox unavailable',
            })],
          },
        });
      }
      throw new Error('UNEXPECTED_TEST_URL');
    }) as unknown as typeof fetch;

    const first = await syncZohoMailSmtpLogs({ fetchImpl, now: () => now });
    const second = await syncZohoMailSmtpLogs({ fetchImpl, now: () => now });

    expect(first).toMatchObject({
      accessRefreshed: true,
      organizationValidated: true,
      pagesFetched: 2,
      recordsSeen: 3,
      reportsHandled: 2,
      recordsSkipped: 1,
    });
    expect(second.accessRefreshed).toBe(false);
    expect(await prisma.emailDeliveryReport.count()).toBe(2);
    const report = await prisma.emailDeliveryReport.findFirstOrThrow({ where: { status: 'DELIVERED' } });
    expect(report.providerEventId).toMatch(/^zoho:[a-f0-9]{64}$/);
    expect(report.providerEventId).not.toContain('provider-transaction-1');
    expect(await prisma.notificationEvent.findFirstOrThrow({
      where: { providerMessageId: trackedMessageId },
    })).toMatchObject({
      providerStatus: 'delivered',
      deliveredAt: new Date(now.getTime() - 10_000),
    });
    expect(await prisma.notificationEvent.findFirstOrThrow({
      where: { providerMessageId: temporaryMessageId },
    })).toMatchObject({
      status: NotificationStatus.SENT,
      providerStatus: 'temporary_failure_provider_retry',
      nextAttemptAt: null,
      error: 'SMTP_451_4_7',
    });

    expect(requests.filter((request) => request.url.includes('/oauth/v2/token'))).toHaveLength(1);
    expect(requests.filter((request) => request.url.endsWith('/api/organization'))).toHaveLength(1);
    expect(requests.filter((request) => request.url.endsWith('/smtplogs'))).toHaveLength(4);
    const initialSmtpRequest = requests.find((request) => request.url.endsWith('/smtplogs'));
    const initialBody = JSON.parse(String(initialSmtpRequest?.init?.body)) as Record<string, unknown>;
    expect(initialBody).toMatchObject({
      fromDateTime: now.getTime() - 86_400_000,
      toDateTime: now.getTime(),
      limit: 2,
      isNext: false,
      isPrevious: false,
    });
  });

  it('fails before SMTP Logs when the authenticated organization does not match', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/oauth/v2/token')) {
        return jsonResponse({ access_token: '1000.test-access-token', expires_in: 3600 });
      }
      if (url.endsWith('/api/organization')) {
        return jsonResponse({ status: { code: 200 }, data: { zoid: 987654321 } });
      }
      throw new Error('SMTP_LOGS_MUST_NOT_BE_CALLED');
    }) as unknown as typeof fetch;

    const error = await syncZohoMailSmtpLogs({
      fetchImpl,
      now: () => new Date('2026-08-09T12:00:00.000Z'),
    }).catch((caught) => caught as Error);

    expect(error.message).toBe('ZOHO_SMTP_LOGS_ORGANIZATION_MISMATCH');
    expect(error.message).not.toContain('1000.test-access-token');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(await prisma.emailDeliveryReport.count()).toBe(0);
  });

  it('sanitizes OAuth failures without returning provider descriptions or secrets', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      error: 'invalid_code',
      error_description: 'test-client-secret tracked@example.test',
    }, 400)) as unknown as typeof fetch;

    const error = await syncZohoMailSmtpLogs({
      fetchImpl,
      now: () => new Date('2026-08-09T12:00:00.000Z'),
    }).catch((caught) => caught as Error);

    expect(error.message).toBe('ZOHO_SMTP_LOGS_OAUTH_HTTP_400_PROVIDER_invalid_code');
    expect(error.message).not.toContain('test-client-secret');
    expect(error.message).not.toContain('@');
  });
});
