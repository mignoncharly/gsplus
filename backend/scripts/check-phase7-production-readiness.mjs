import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

if (!process.argv.includes('--production')) {
  throw new Error('Refusing Phase 7 production readiness check without --production.');
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, '..');
dotenv.config({ path: path.join(backendDir, '.env'), quiet: true });

const [{ prisma }, { env }, { getCalendarSyncHealth }] = await Promise.all([
  import('../dist/db/prisma.js'),
  import('../dist/config/env.js'),
  import('../dist/services/calendar.js'),
]);

const origin = env.CLIENT_ORIGINS.find((value) => value.startsWith('https://')) ?? 'https://gsplus.vip';
const qaZohoConfigured = Boolean(process.env.PHASE7_QA_ZOHO_EMAIL);
const qaGmailConfigured = Boolean(process.env.PHASE7_QA_GMAIL_EMAIL);
const qaPhoneConfigured = Boolean(process.env.PHASE7_QA_PHONE);

const jsonFetch = async (url, init = {}) => {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  return { response, payload };
};

try {
  const [publicHealth, calendarHealth, packagesResponse, database] = await Promise.all([
    jsonFetch(`${origin}/api/health`),
    getCalendarSyncHealth(),
    jsonFetch(`${origin}/api/packages`),
    Promise.all([
      prisma.reservation.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.payment.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.notificationEvent.groupBy({ by: ['channel', 'status'], _count: { _all: true } }),
      prisma.calendarSyncLog.groupBy({ by: ['status'], _count: { _all: true } }),
    ]),
  ]);

  const eventTypeResponse = await jsonFetch(
    `${env.CALCOM_API_BASE_URL.replace(/\/$/, '')}/event-types/${encodeURIComponent(env.CALCOM_EVENT_TYPE_ID ?? '')}`,
    {
      headers: {
        Authorization: `Bearer ${env.CALCOM_API_KEY}`,
        'cal-api-version': env.CALCOM_EVENT_TYPES_API_VERSION,
      },
    },
  );
  const eventType = eventTypeResponse.payload?.data;
  const bookingFields = Array.isArray(eventType?.bookingFields)
    ? eventType.bookingFields.map(({ type, slug, required }) => ({ type, slug, required }))
    : [];
  const titleField = bookingFields.find((field) => field.slug === 'title');
  const notesField = bookingFields.find((field) => field.slug === 'notes');
  const packages = Array.isArray(packagesResponse.payload?.data) ? packagesResponse.payload.data : [];
  const directPackages = packages.filter((item) => item.bookingMode === 'DIRECT');
  const contactPackages = packages.filter((item) => item.bookingMode === 'CONTACT');
  const happyHoursPackages = packages.filter((item) => item.isPromo);
  const [reservationCounts, paymentCounts, notificationCounts, calendarCounts] = database;

  const calComReady = Boolean(
    calendarHealth.ok &&
    eventTypeResponse.response.ok &&
    titleField?.required === true &&
    notesField,
  );
  const emailTransportReady = Boolean(
    env.EMAIL_DELIVERY_ENABLED &&
    env.SMTP_HOST &&
    env.SMTP_USER &&
    env.SMTP_PASS &&
    env.SMTP_FROM.includes('Golden Studio Plus'),
  );
  const isolatedQaDestinationsReady = qaZohoConfigured && qaGmailConfigured && qaPhoneConfigured;
  const whatsappConfigured = Boolean(
    env.WHATSAPP_DELIVERY_ENABLED &&
    env.WHATSAPP_PHONE_NUMBER_ID &&
    env.WHATSAPP_ACCESS_TOKEN &&
    env.WHATSAPP_APP_SECRET &&
    env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  );

  const result = {
    checkedAt: new Date().toISOString(),
    origin,
    application: {
      publicHealth: publicHealth.response.ok && publicHealth.payload?.status === 'ok',
      packageApi: packagesResponse.response.ok,
      packages: packages.length,
      directPackages: directPackages.length,
      contactPackages: contactPackages.length,
      happyHoursPackages: happyHoursPackages.length,
    },
    calCom: {
      ready: calComReady,
      health: calendarHealth,
      eventType: {
        httpStatus: eventTypeResponse.response.status,
        id: eventType?.id ?? env.CALCOM_EVENT_TYPE_ID ?? null,
        title: eventType?.title ?? null,
        customName: eventType?.customName ?? null,
        lengthInMinutes: eventType?.lengthInMinutes ?? null,
        lengthInMinutesOptions: eventType?.lengthInMinutesOptions ?? [],
        interfaceLanguage: eventType?.interfaceLanguage ?? null,
        bookingFields,
        perBookingTopLevelTitleSupported: false,
        supportedPresentation: 'bookingFieldsResponses.title + bookingFieldsResponses.notes + metadata',
      },
    },
    email: {
      transportReady: emailTransportReady,
      fromIdentityIsGoldenStudioPlus: env.SMTP_FROM.includes('Golden Studio Plus'),
      qaZohoConfigured,
      qaGmailConfigured,
      mailboxReceiptAndMobileRenderingRequireHumanInspection: true,
    },
    whatsapp: {
      configured: whatsappConfigured,
      deliveryEnabled: env.WHATSAPP_DELIVERY_ENABLED,
      acceptanceStatus: whatsappConfigured ? 'READY_FOR_SUPERVISED_PROOF' : 'FEATURE_GATED_UNAVAILABLE',
    },
    isolatedProductionMatrix: {
      qaDestinationsReady: isolatedQaDestinationsReady,
      mutationRunExecuted: false,
      requiredEnvironment: ['PHASE7_QA_ZOHO_EMAIL', 'PHASE7_QA_GMAIL_EMAIL', 'PHASE7_QA_PHONE'],
    },
    currentOperationalCounts: {
      reservations: reservationCounts,
      payments: paymentCounts,
      notifications: notificationCounts,
      calendar: calendarCounts,
    },
    gates: [
      ...(calComReady ? [] : ['CALCOM_PRESENTATION_CAPABILITY_NOT_READY']),
      ...(emailTransportReady ? [] : ['ZOHO_SMTP_TRANSPORT_NOT_READY']),
      ...(isolatedQaDestinationsReady ? [] : ['DEDICATED_QA_DESTINATIONS_REQUIRED']),
      ...(whatsappConfigured ? [] : ['WHATSAPP_PROVIDER_CREDENTIALS_REQUIRED']),
      'GMAIL_ZOHO_MOBILE_RECEIPT_REQUIRES_HUMAN_INSPECTION',
    ],
  };

  console.log(JSON.stringify(result, null, 2));
  if (!calComReady || !emailTransportReady || !publicHealth.response.ok || !packagesResponse.response.ok) {
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
