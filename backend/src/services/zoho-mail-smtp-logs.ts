const ZOHO_MAIL_API_ORIGINS = new Set([
  'https://mail.zoho.com',
  'https://mail.zoho.eu',
  'https://mail.zoho.in',
  'https://mail.zoho.com.au',
  'https://mail.zoho.jp',
  'https://mail.zohocloud.ca',
  'https://mail.zoho.com.cn',
  'https://mail.zoho.ae',
  'https://mail.zoho.sa',
]);

const DAY_MS = 24 * 60 * 60 * 1000;

type FetchLike = typeof fetch;

export type ZohoMailSmtpLogsProbeInput = {
  organizationId: string;
  accessToken: string;
  messageId: string;
  apiBaseUrl?: string;
  now?: Date;
  lookbackMs?: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
};

export type ZohoMailSmtpLogsProbeResult = {
  accessConfirmed: true;
  httpStatus: number;
  providerStatusCode: number;
  matchingRecords: number;
  hasNext: boolean;
};

const probeError = (code: string) => new Error(`ZOHO_SMTP_LOGS_PROBE_${code}`);

const validatedOrigin = (raw: string) => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw probeError('BASE_URL_INVALID');
  }
  if (
    !ZOHO_MAIL_API_ORIGINS.has(url.origin) ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw probeError('BASE_URL_NOT_ALLOWED');
  }
  return url.origin;
};

const providerStatusCode = (payload: unknown) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const status = (payload as Record<string, unknown>).status;
  if (!status || typeof status !== 'object' || Array.isArray(status)) return null;
  const code = (status as Record<string, unknown>).code;
  return typeof code === 'number' && Number.isInteger(code) ? code : null;
};

const responseSummary = (payload: unknown) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { matchingRecords: 0, hasNext: false };
  }
  const data = (payload as Record<string, unknown>).data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { matchingRecords: 0, hasNext: false };
  }
  const record = data as Record<string, unknown>;
  const rows = Array.isArray(record.response) ? record.response : [];
  return {
    matchingRecords: rows.length,
    hasNext: record.hnxt === true || record.hnxt === 'true' || record.hasNext === true || record.hasNext === 'true',
  };
};

export const probeZohoMailSmtpLogs = async (
  input: ZohoMailSmtpLogsProbeInput,
): Promise<ZohoMailSmtpLogsProbeResult> => {
  const organizationId = input.organizationId.trim();
  const accessToken = input.accessToken.trim();
  const messageId = input.messageId.trim();
  if (!/^\d+$/.test(organizationId)) throw probeError('ORGANIZATION_ID_INVALID');
  if (accessToken.length < 10 || /\s/.test(accessToken)) throw probeError('ACCESS_TOKEN_INVALID');
  if (!messageId || messageId.length > 500 || /[\r\n]/.test(messageId)) throw probeError('MESSAGE_ID_INVALID');

  const apiBaseUrl = validatedOrigin(input.apiBaseUrl ?? 'https://mail.zoho.com');
  const now = input.now ?? new Date();
  const lookbackMs = input.lookbackMs ?? 14 * DAY_MS;
  if (!Number.isFinite(now.getTime())) throw probeError('NOW_INVALID');
  if (!Number.isInteger(lookbackMs) || lookbackMs < DAY_MS || lookbackMs > 60 * DAY_MS) {
    throw probeError('LOOKBACK_INVALID');
  }
  const timeoutMs = input.timeoutMs ?? 10_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) {
    throw probeError('TIMEOUT_INVALID');
  }

  const response = await (input.fetchImpl ?? fetch)(
    `${apiBaseUrl}/api/organization/${encodeURIComponent(organizationId)}/smtplogs`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
      body: JSON.stringify({
        fromDateTime: now.getTime() - lookbackMs,
        toDateTime: now.getTime(),
        searchCriteria: 'messageId',
        searchKey: messageId,
        limit: 1,
        isNext: false,
        pageKey: '',
        isPrevious: false,
        prevKey: '',
        isReverseSearch: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  const payload = await response.json().catch(() => null) as unknown;
  const statusCode = providerStatusCode(payload);
  if (!response.ok || statusCode !== 200) {
    throw probeError(`ACCESS_DENIED_HTTP_${response.status}_PROVIDER_${statusCode ?? 'UNKNOWN'}`);
  }
  return {
    accessConfirmed: true,
    httpStatus: response.status,
    providerStatusCode: statusCode,
    ...responseSummary(payload),
  };
};
