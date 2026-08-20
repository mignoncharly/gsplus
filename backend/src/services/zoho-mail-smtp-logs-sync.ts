import { createHash } from 'node:crypto';

import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import {
  handleEmailDeliveryReport,
  type EmailDeliveryReportInput,
  type EmailDeliveryReportStatus,
} from '../emails/email-delivery-reports.js';
import { validatedZohoMailApiOrigin } from './zoho-mail-smtp-logs.js';

const ZOHO_ACCOUNTS_ORIGINS = new Set([
  'https://accounts.zoho.com',
  'https://accounts.zoho.eu',
  'https://accounts.zoho.in',
  'https://accounts.zoho.com.au',
  'https://accounts.zoho.jp',
  'https://accounts.zohocloud.ca',
  'https://accounts.zoho.com.cn',
  'https://accounts.zoho.ae',
  'https://accounts.zoho.sa',
]);
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const MAX_LOOKBACK_MS = 60 * DAY_MS;
const TOKEN_EXPIRY_MARGIN_MS = 60 * 1000;
const DEFAULT_TOKEN_TTL_MS = 50 * MINUTE_MS;

type FetchLike = typeof fetch;
type JsonObject = Record<string, unknown>;

type ZohoSmtpLogCandidate = {
  providerEventId: string;
  providerMessageId: string;
  recipient: string;
  status: EmailDeliveryReportStatus;
  smtpCode: string | null;
  occurredAt: Date;
};

type ZohoSmtpLogsPage = {
  rows: unknown[];
  hasNext: boolean;
  nextPageKey: string | null;
};

export type ZohoMailSmtpLogsSyncResult = {
  accessRefreshed: boolean;
  organizationValidated: boolean;
  pagesFetched: number;
  recordsSeen: number;
  reportsHandled: number;
  recordsSkipped: number;
};

export type ZohoMailSmtpLogsSyncAdapters = {
  now?: () => Date;
  fetchImpl?: FetchLike;
};

const asObject = (value: unknown): JsonObject | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : null;

const stringValue = (value: unknown, maxLength = 1_000) =>
  typeof value === 'string' && value.trim() && value.length <= maxLength && !/[\r\n]/.test(value)
    ? value.trim()
    : null;

const integerValue = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(numeric) ? numeric : null;
};

const providerStatusCode = (payload: unknown) => {
  const status = asObject(asObject(payload)?.status);
  const code = status?.code;
  return typeof code === 'number' || typeof code === 'string' ? String(code) : null;
};

const safeProviderCode = (value: unknown) => {
  const normalized = typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : '';
  return /^[A-Za-z0-9_.-]{1,80}$/.test(normalized) ? normalized : 'UNKNOWN';
};

const zohoError = (code: string) => new Error(`ZOHO_SMTP_LOGS_${code}`);

const validatedAccountsOrigin = (raw: string) => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw zohoError('ACCOUNTS_BASE_URL_INVALID');
  }
  if (
    !ZOHO_ACCOUNTS_ORIGINS.has(url.origin) ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw zohoError('ACCOUNTS_BASE_URL_NOT_ALLOWED');
  }
  return url.origin;
};

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

const requireConfiguration = () => {
  const organizationId = env.ZOHO_MAIL_ORG_ID?.trim() ?? '';
  const clientId = env.ZOHO_MAIL_CLIENT_ID?.trim() ?? '';
  const clientSecret = env.ZOHO_MAIL_CLIENT_SECRET?.trim() ?? '';
  const refreshToken = env.ZOHO_MAIL_REFRESH_TOKEN?.trim() ?? '';
  if (!/^\d+$/.test(organizationId)) throw zohoError('ORGANIZATION_ID_INVALID');
  if (!clientId || !clientSecret || !refreshToken) throw zohoError('OAUTH_CONFIGURATION_MISSING');
  if (
    env.ZOHO_MAIL_SMTP_LOGS_SYNC_INTERVAL_MS < MINUTE_MS ||
    env.ZOHO_MAIL_SMTP_LOGS_SYNC_INTERVAL_MS > DAY_MS
  ) {
    throw zohoError('INTERVAL_INVALID');
  }
  if (
    env.ZOHO_MAIL_SMTP_LOGS_LOOKBACK_MS < 5 * MINUTE_MS ||
    env.ZOHO_MAIL_SMTP_LOGS_LOOKBACK_MS > MAX_LOOKBACK_MS
  ) {
    throw zohoError('LOOKBACK_INVALID');
  }
  if (env.ZOHO_MAIL_SMTP_LOGS_PAGE_SIZE < 1 || env.ZOHO_MAIL_SMTP_LOGS_PAGE_SIZE > 500) {
    throw zohoError('PAGE_SIZE_INVALID');
  }
  if (env.ZOHO_MAIL_SMTP_LOGS_MAX_PAGES < 1 || env.ZOHO_MAIL_SMTP_LOGS_MAX_PAGES > 100) {
    throw zohoError('MAX_PAGES_INVALID');
  }
  if (env.ZOHO_MAIL_TIMEOUT_MS < 1_000 || env.ZOHO_MAIL_TIMEOUT_MS > 30_000) {
    throw zohoError('TIMEOUT_INVALID');
  }
  return {
    organizationId,
    clientId,
    clientSecret,
    refreshToken,
    accountsBaseUrl: validatedAccountsOrigin(env.ZOHO_MAIL_ACCOUNTS_BASE_URL),
    apiBaseUrl: validatedZohoMailApiOrigin(env.ZOHO_MAIL_API_BASE_URL),
  };
};

let cachedAccessToken: { value: string; expiresAt: number; organizationId: string } | null = null;

const refreshAccessToken = async (
  config: ReturnType<typeof requireConfiguration>,
  fetchImpl: FetchLike,
  nowMs: number,
) => {
  const response = await fetchImpl(`${config.accountsBaseUrl}/oauth/v2/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
    }),
    signal: AbortSignal.timeout(env.ZOHO_MAIL_TIMEOUT_MS),
  });
  const payload = await parseJsonResponse(response);
  const data = asObject(payload);
  const accessToken = stringValue(data?.access_token, 4_000);
  if (!response.ok || !accessToken) {
    const code = safeProviderCode(data?.error ?? providerStatusCode(payload));
    throw zohoError(`OAUTH_HTTP_${response.status}_PROVIDER_${code}`);
  }
  const expiresInSeconds = integerValue(data?.expires_in);
  const ttlMs = expiresInSeconds && expiresInSeconds > 120
    ? expiresInSeconds * 1000 - TOKEN_EXPIRY_MARGIN_MS
    : DEFAULT_TOKEN_TTL_MS;
  return { accessToken, expiresAt: nowMs + ttlMs };
};

const validateOrganization = async (
  config: ReturnType<typeof requireConfiguration>,
  accessToken: string,
  fetchImpl: FetchLike,
) => {
  const response = await fetchImpl(`${config.apiBaseUrl}/api/organization`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
    signal: AbortSignal.timeout(env.ZOHO_MAIL_TIMEOUT_MS),
  });
  const payload = await parseJsonResponse(response);
  const code = providerStatusCode(payload);
  const data = asObject(asObject(payload)?.data);
  const authenticatedOrganizationId = data?.zoid === undefined ? null : String(data.zoid);
  if (!response.ok || code !== '200' || !authenticatedOrganizationId) {
    throw zohoError(
      `ORGANIZATION_HTTP_${response.status}_PROVIDER_${safeProviderCode(code)}`,
    );
  }
  if (authenticatedOrganizationId !== config.organizationId) {
    throw zohoError('ORGANIZATION_MISMATCH');
  }
};

const getValidatedAccessToken = async (
  config: ReturnType<typeof requireConfiguration>,
  fetchImpl: FetchLike,
  nowMs: number,
) => {
  if (
    cachedAccessToken &&
    cachedAccessToken.organizationId === config.organizationId &&
    cachedAccessToken.expiresAt > nowMs
  ) {
    return { accessToken: cachedAccessToken.value, refreshed: false };
  }
  const refreshed = await refreshAccessToken(config, fetchImpl, nowMs);
  await validateOrganization(config, refreshed.accessToken, fetchImpl);
  cachedAccessToken = {
    value: refreshed.accessToken,
    expiresAt: refreshed.expiresAt,
    organizationId: config.organizationId,
  };
  return { accessToken: refreshed.accessToken, refreshed: true };
};

const fetchSmtpLogsPage = async (
  config: ReturnType<typeof requireConfiguration>,
  accessToken: string,
  fromDateTime: number,
  toDateTime: number,
  pageKey: string,
  isNext: boolean,
  fetchImpl: FetchLike,
): Promise<ZohoSmtpLogsPage> => {
  const response = await fetchImpl(
    `${config.apiBaseUrl}/api/organization/${encodeURIComponent(config.organizationId)}/smtplogs`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
      body: JSON.stringify({
        fromDateTime,
        toDateTime,
        limit: env.ZOHO_MAIL_SMTP_LOGS_PAGE_SIZE,
        isNext,
        pageKey,
        isPrevious: false,
        prevKey: '',
        isReverseSearch: false,
      }),
      signal: AbortSignal.timeout(env.ZOHO_MAIL_TIMEOUT_MS),
    },
  );
  const payload = await parseJsonResponse(response);
  const code = providerStatusCode(payload);
  if (!response.ok || code !== '200') {
    throw zohoError(`HTTP_${response.status}_PROVIDER_${safeProviderCode(code)}`);
  }
  const data = asObject(asObject(payload)?.data);
  const rows = Array.isArray(data?.response) ? data.response : [];
  const hasNext = data?.hnxt === true || data?.hnxt === 'true' ||
    data?.hasNext === true || data?.hasNext === 'true';
  const nextPageKey = stringValue(data?.pagekey ?? data?.pageKey, 2_000);
  if (hasNext && !nextPageKey) throw zohoError('PAGINATION_KEY_MISSING');
  return { rows, hasNext, nextPageKey };
};

const normalizedDeliveryStatus = (value: unknown) =>
  stringValue(value, 200)?.toLocaleLowerCase('en-US').replace(/[\s_-]+/g, ' ') ?? '';

const extractSmtpCode = (...reasons: unknown[]) => {
  for (const reason of reasons) {
    const value = stringValue(reason, 2_000);
    if (!value) continue;
    const match = value.match(/\b([245]\d{2})(?:[.\s-]+(\d{1,3}))?(?:[.\s-]+(\d{1,3}))?\b/);
    if (match) return [match[1], match[2], match[3]].filter(Boolean).join('.');
  }
  return null;
};

const mappedStatus = (
  deliveryStatus: unknown,
  smtpCode: string | null,
): EmailDeliveryReportStatus | null => {
  const normalized = normalizedDeliveryStatus(deliveryStatus);
  if (/^(delivered|mail delivered|success|successful)$/.test(normalized)) return 'DELIVERED';
  if (smtpCode?.startsWith('5')) return 'PERMANENT_FAILURE';
  if (smtpCode?.startsWith('4')) return 'TEMPORARY_FAILURE';
  if (/permanent|bounce|undeliver|delivery failed|rejected|hard fail/.test(normalized)) {
    return 'PERMANENT_FAILURE';
  }
  if (/temporary|retry|queue|defer|in progress|processing|soft fail/.test(normalized)) {
    return 'TEMPORARY_FAILURE';
  }
  return null;
};

const candidateEventId = (
  transactionId: string,
  messageId: string,
  recipient: string,
  status: EmailDeliveryReportStatus,
  occurredAtMs: number,
) => 'zoho:' + createHash('sha256')
  .update([transactionId, messageId, recipient.toLocaleLowerCase('en-US'), status, occurredAtMs].join('\0'))
  .digest('hex');

export const parseZohoSmtpLogCandidates = (rows: unknown[]) => {
  const candidates: ZohoSmtpLogCandidate[] = [];
  for (const row of rows) {
    const record = asObject(row);
    if (!record) continue;
    const mailType = normalizedDeliveryStatus(record.mailType ?? record.mailType_i18n);
    if (mailType && mailType !== 'out' && mailType !== 'outbound') continue;
    const transactionId = stringValue(record.TransactionID, 1_000);
    const sender = asObject(record.from);
    const messageId = stringValue(sender?.msgId ?? record.msgId, 500);
    const sentAtMs = integerValue(sender?.sentTimeMillis);
    if (!transactionId || !messageId) continue;
    const recipients = Array.isArray(record.recipients) ? record.recipients : [];
    for (const item of recipients) {
      const recipient = asObject(item);
      if (!recipient) continue;
      const recipientAddress = stringValue(recipient.rcpt, 500);
      const occurredAtMs = integerValue(recipient.timeMillis) ?? sentAtMs;
      if (!recipientAddress || !occurredAtMs || occurredAtMs < 0) continue;
      const smtpCode = extractSmtpCode(recipient.reason, sender?.reason);
      const status = mappedStatus(recipient.deliveryStatus, smtpCode);
      if (!status) continue;
      candidates.push({
        providerEventId: candidateEventId(
          transactionId,
          messageId,
          recipientAddress,
          status,
          occurredAtMs,
        ),
        providerMessageId: messageId,
        recipient: recipientAddress,
        status,
        smtpCode,
        occurredAt: new Date(occurredAtMs),
      });
    }
  }
  return candidates.sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
};

const normalizedMessageId = (value: string) =>
  value.trim().replace(/^<|>$/g, '').toLocaleLowerCase('en-US');

const matchingEvents = async (candidates: ZohoSmtpLogCandidate[]) => {
  const normalizedIds = new Set(candidates.map((candidate) => normalizedMessageId(candidate.providerMessageId)));
  if (normalizedIds.size === 0) return new Map<string, {
    providerMessageId: string;
    recipient: string;
  }>();
  const variants = [...new Set(candidates.flatMap((candidate) => {
    const raw = candidate.providerMessageId.trim();
    const stripped = raw.replace(/^<|>$/g, '');
    const normalized = normalizedMessageId(raw);
    return [raw, stripped, `<${stripped}>`, normalized, `<${normalized}>`];
  }))];
  const events = await prisma.notificationEvent.findMany({
    where: {
      channel: 'email',
      providerMessageId: { in: variants },
    },
    select: {
      providerMessageId: true,
      recipient: true,
    },
  });
  return new Map(events.flatMap((event) => event.providerMessageId
    ? [[normalizedMessageId(event.providerMessageId), {
      providerMessageId: event.providerMessageId,
      recipient: event.recipient,
    }] as const]
    : []));
};

export const syncZohoMailSmtpLogs = async (
  adapters: ZohoMailSmtpLogsSyncAdapters = {},
): Promise<ZohoMailSmtpLogsSyncResult> => {
  const config = requireConfiguration();
  const fetchImpl = adapters.fetchImpl ?? fetch;
  const now = adapters.now?.() ?? new Date();
  if (!Number.isFinite(now.getTime())) throw zohoError('NOW_INVALID');
  const access = await getValidatedAccessToken(config, fetchImpl, now.getTime());
  const fromDateTime = now.getTime() - env.ZOHO_MAIL_SMTP_LOGS_LOOKBACK_MS;
  const allRows: unknown[] = [];
  const seenPageKeys = new Set<string>();
  let pageKey = '';
  let isNext = false;
  let pagesFetched = 0;

  while (pagesFetched < env.ZOHO_MAIL_SMTP_LOGS_MAX_PAGES) {
    const page = await fetchSmtpLogsPage(
      config,
      access.accessToken,
      fromDateTime,
      now.getTime(),
      pageKey,
      isNext,
      fetchImpl,
    );
    pagesFetched += 1;
    allRows.push(...page.rows);
    if (!page.hasNext) break;
    if (pagesFetched >= env.ZOHO_MAIL_SMTP_LOGS_MAX_PAGES) throw zohoError('PAGE_LIMIT_REACHED');
    if (!page.nextPageKey || seenPageKeys.has(page.nextPageKey)) {
      throw zohoError('PAGINATION_LOOP');
    }
    seenPageKeys.add(page.nextPageKey);
    pageKey = page.nextPageKey;
    isNext = true;
  }
  const candidates = parseZohoSmtpLogCandidates(allRows);
  const events = await matchingEvents(candidates);
  let reportsHandled = 0;
  let recordsSkipped = Math.max(0, allRows.length - candidates.length);
  for (const candidate of candidates) {
    const event = events.get(normalizedMessageId(candidate.providerMessageId));
    if (!event || event.recipient.trim().toLocaleLowerCase('en-US') !==
      candidate.recipient.trim().toLocaleLowerCase('en-US')) {
      recordsSkipped += 1;
      continue;
    }
    const report: EmailDeliveryReportInput = {
      providerEventId: candidate.providerEventId,
      providerMessageId: event.providerMessageId,
      status: candidate.status,
      smtpCode: candidate.smtpCode,
      occurredAt: candidate.occurredAt,
      providerManagesRetry: candidate.status === 'TEMPORARY_FAILURE',
    };
    await handleEmailDeliveryReport(report);
    reportsHandled += 1;
  }
  return {
    accessRefreshed: access.refreshed,
    organizationValidated: true,
    pagesFetched,
    recordsSeen: allRows.length,
    reportsHandled,
    recordsSkipped,
  };
};

const safeSyncError = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  return /^ZOHO_SMTP_LOGS_[A-Z0-9_.-]+$/.test(message)
    ? message
    : 'ZOHO_SMTP_LOGS_SYNC_FAILED';
};

export const startZohoMailSmtpLogsWorker = () => {
  if (!env.ZOHO_MAIL_SMTP_LOGS_SYNC_ENABLED) return () => undefined;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await syncZohoMailSmtpLogs();
    } catch (error) {
      console.error('Zoho SMTP Logs sync cycle failed', safeSyncError(error));
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void run(), env.ZOHO_MAIL_SMTP_LOGS_SYNC_INTERVAL_MS);
  timer.unref();
  void run();
  return () => clearInterval(timer);
};

export const resetZohoMailSmtpLogsTokenCacheForTests = () => {
  cachedAccessToken = null;
};
