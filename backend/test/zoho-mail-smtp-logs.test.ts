import { describe, expect, it, vi } from 'vitest';

import { probeZohoMailSmtpLogs } from '../src/services/zoho-mail-smtp-logs.js';

const baseInput = {
  organizationId: '123456789',
  accessToken: '1000.read-only-token',
  messageId: '<digest@example.test>',
  now: new Date('2026-08-09T10:00:00.000Z'),
};

describe('Zoho Mail SMTP Logs read-only probe', () => {
  it('queries one known Message-ID and returns only a redacted access summary', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      status: { code: 200, description: 'success' },
      data: {
        hnxt: 'false',
        response: [{
          recipients: [{ rcpt: 'private@example.test', deliveryStatus: 'Delivered' }],
          from: { subject: 'Private subject', msgId: baseInput.messageId },
        }],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await probeZohoMailSmtpLogs({ ...baseInput, fetchImpl });

    expect(result).toEqual({
      accessConfirmed: true,
      httpStatus: 200,
      providerStatusCode: 200,
      matchingRecords: 1,
      hasNext: false,
    });
    expect(JSON.stringify(result)).not.toContain('private@example.test');
    expect(JSON.stringify(result)).not.toContain('Private subject');
    const [url, request] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://mail.zoho.com/api/organization/123456789/smtplogs');
    expect(request?.method).toBe('POST');
    expect(request?.headers).toMatchObject({ Authorization: 'Zoho-oauthtoken 1000.read-only-token' });
    expect(JSON.parse(String(request?.body))).toMatchObject({
      searchCriteria: 'messageId',
      searchKey: baseInput.messageId,
      limit: 1,
    });
  });

  it('allows only official Zoho Mail regional API origins before sending a token', async () => {
    const fetchImpl = vi.fn();
    await expect(probeZohoMailSmtpLogs({
      ...baseInput,
      apiBaseUrl: 'https://attacker.example/zoho',
      fetchImpl,
    })).rejects.toThrow('ZOHO_SMTP_LOGS_PROBE_BASE_URL_NOT_ALLOWED');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('accepts the documented Canadian Zoho Mail data center', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      status: { code: 200 },
      data: { response: [] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await expect(probeZohoMailSmtpLogs({
      ...baseInput,
      apiBaseUrl: 'https://mail.zohocloud.ca',
      fetchImpl,
    })).resolves.toMatchObject({ accessConfirmed: true, matchingRecords: 0 });
  });

  it('reports access denial without leaking the OAuth token or provider payload', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      status: { code: 401, description: 'Invalid token 1000.read-only-token' },
      data: { moreInfo: 'private@example.test' },
    }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
    const error = await probeZohoMailSmtpLogs({ ...baseInput, fetchImpl }).catch((caught) => caught as Error);
    expect(error.message).toBe('ZOHO_SMTP_LOGS_PROBE_ACCESS_DENIED_HTTP_401_PROVIDER_401');
    expect(error.message).not.toContain(baseInput.accessToken);
    expect(error.message).not.toContain('private@example.test');
  });
});
