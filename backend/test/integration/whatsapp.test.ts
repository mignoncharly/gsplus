import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '../../src/config/env.js';
import { prisma } from '../../src/db/prisma.js';
import { NotificationStatus, ReservationStatus } from '../../src/generated/prisma/client.js';
import {
  handleWhatsAppWebhook,
  processNotificationEvent,
  queueReservationCreatedNotifications,
} from '../../src/emails/notifications.js';

const fetchMock = vi.fn();

const resetDatabase = async () => {
  await prisma.dataIntegrityIncident.deleteMany();
  await prisma.calendarSyncLog.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.package.deleteMany();
};

const seedReservation = async (whatsappConsent: boolean) => {
  const pack = await prisma.package.create({
    data: {
      slug: `whatsapp-${whatsappConsent ? 'yes' : 'no'}`,
      name: 'Portrait WhatsApp',
      category: 'Tests',
      price: 25000,
      durationMin: 60,
    },
  });
  const packageVersion = await prisma.packageVersion.create({
    data: {
      packageId: pack.id,
      version: 1,
      name: pack.name,
      category: pack.category,
      description: pack.description,
      price: pack.price,
      currency: pack.currency,
      durationMin: pack.durationMin,
    },
  });
  const customer = await prisma.customer.create({
    data: {
      firstName: 'Aline',
      lastName: 'WhatsApp',
      phone: '+237699333333',
      email: 'aline.whatsapp@example.test',
    },
  });
  const capturedAt = new Date('2026-08-01T16:00:00.000Z');
  return prisma.reservation.create({
    data: {
      reference: `GSPWA${whatsappConsent ? 'YES' : 'NO'}`,
      customerId: customer.id,
      packageId: pack.id,
      packageVersionId: packageVersion.id,
      startAt: new Date('2030-02-04T09:00:00.000Z'),
      endAt: new Date('2030-02-04T10:00:00.000Z'),
      status: ReservationStatus.PENDING_CONFIRMATION,
      acceptedTermsAt: capturedAt,
      whatsappConsentAt: whatsappConsent ? capturedAt : null,
      snapshot: {
        create: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          phoneRaw: '+237 699 33 33 33',
          phoneE164: customer.phone,
          email: customer.email,
          notificationEmail: customer.email,
          notificationPhoneE164: customer.phone,
          packageId: pack.id,
          packageVersionId: packageVersion.id,
          packageVersion: packageVersion.version,
          packageName: packageVersion.name,
          startAt: new Date('2030-02-04T09:00:00.000Z'),
          endAt: new Date('2030-02-04T10:00:00.000Z'),
          durationMin: packageVersion.durationMin,
          amount: packageVersion.price,
          currency: packageVersion.currency,
          termsAccepted: true,
          termsVersion: 'TEST',
          termsAcceptedAt: capturedAt,
          privacyAccepted: true,
          privacyVersion: 'TEST',
          privacyAcceptedAt: capturedAt,
          whatsappConsent,
          whatsappConsentAt: whatsappConsent ? capturedAt : null,
          imageConsent: false,
          imageAuthorizationVersion: 'TEST',
          source: 'TEST',
        },
      },
    },
  });
};

beforeEach(async () => {
  await resetDatabase();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  Object.assign(env, {
    WHATSAPP_DELIVERY_ENABLED: false,
    WHATSAPP_BUSINESS_RECIPIENT: '+237673026654',
    WHATSAPP_PHONE_NUMBER_ID: undefined,
    WHATSAPP_ACCESS_TOKEN: undefined,
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: undefined,
    WHATSAPP_APP_SECRET: undefined,
    WHATSAPP_TEMPLATE_BOOKING_RECEIVED_ADMIN: '',
    WHATSAPP_TEMPLATE_BOOKING_RECEIVED: '',
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('P1-01 WhatsApp transactional workflow', () => {
  it('always journals one immutable business notification independently of client consent or channel activation', async () => {
    const reservation = await seedReservation(false);

    await queueReservationCreatedNotifications(reservation.id);
    await queueReservationCreatedNotifications(reservation.id);

    const events = await prisma.notificationEvent.findMany({
      where: { reservationId: reservation.id, channel: 'whatsapp' },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'booking_received_admin',
      recipient: '+237673026654',
      status: NotificationStatus.PENDING,
      attemptCount: 0,
      maxAttempts: 3,
      templateCode: 'WA-BUSINESS-BOOKING-CREATED',
      templateVersion: '2026-08-01',
      renderedContent: {
        audience: 'business',
        reference: reservation.reference,
        phone: '+237699333333',
        whatsappConsent: false,
      },
    });
    expect(events[0]?.idempotencyKey).toBe(`reservation:${reservation.id}:created:whatsapp:admin`);
  });

  it('journals a customer notification only with snapshot consent and keeps both audiences idempotent', async () => {
    const denied = await seedReservation(false);
    await queueReservationCreatedNotifications(denied.id);
    expect(await prisma.notificationEvent.count({
      where: { reservationId: denied.id, channel: 'whatsapp', type: 'booking_received_customer' },
    })).toBe(0);

    await resetDatabase();
    const allowed = await seedReservation(true);
    await queueReservationCreatedNotifications(allowed.id);
    await queueReservationCreatedNotifications(allowed.id);

    const events = await prisma.notificationEvent.findMany({
      where: { reservationId: allowed.id, channel: 'whatsapp' },
      orderBy: { type: 'asc' },
    });
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.type).sort()).toEqual([
      'booking_received_admin',
      'booking_received_customer',
    ]);
    const customer = events.find((event) => event.type === 'booking_received_customer');
    expect(customer).toMatchObject({
      recipient: '+237699333333',
      maxAttempts: 3,
      templateCode: 'WA-CUSTOMER-BOOKING-RECEIVED',
      templateVersion: '2026-08-01',
      renderedContent: {
        audience: 'customer',
        firstName: 'Aline',
        reference: allowed.reference,
        whatsappConsent: true,
      },
    });
  });

  it('runs WhatsApp attempts at 0, +2 and +10 minutes and raises one I-08 only after attempt three', async () => {
    const reservation = await seedReservation(true);
    const event = await prisma.notificationEvent.create({
      data: {
        reservationId: reservation.id,
        channel: 'whatsapp',
        type: 'booking_received_customer',
        recipient: '+237699333333',
        idempotencyKey: `p1-01-retry:${reservation.id}`,
        maxAttempts: 3,
      },
    });
    const sendWhatsApp = vi.fn(async () => {
      throw new Error('raw Meta token and response must never persist');
    });

    expect(await processNotificationEvent(event.id, {
      now: () => new Date('2026-08-01T16:00:00.000Z'),
      sendWhatsApp,
    })).toBe('retry_scheduled');
    let stored = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored).toMatchObject({
      status: NotificationStatus.PENDING,
      attemptCount: 1,
      providerStatus: 'retry_scheduled',
      error: 'WHATSAPP_DELIVERY_FAILED',
    });
    expect(stored.nextAttemptAt?.toISOString()).toBe('2026-08-01T16:02:00.000Z');
    expect(await prisma.notificationEvent.count({ where: { type: 'whatsapp_delivery_failed_admin' } })).toBe(0);

    expect(await processNotificationEvent(event.id, {
      now: () => new Date('2026-08-01T16:02:00.000Z'),
      sendWhatsApp,
    })).toBe('retry_scheduled');
    stored = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.nextAttemptAt?.toISOString()).toBe('2026-08-01T16:12:00.000Z');
    expect(await prisma.notificationEvent.count({ where: { type: 'whatsapp_delivery_failed_admin' } })).toBe(0);

    expect(await processNotificationEvent(event.id, {
      now: () => new Date('2026-08-01T16:12:00.000Z'),
      sendWhatsApp,
    })).toBe('failed');
    expect(sendWhatsApp).toHaveBeenCalledTimes(3);
    const attempts = await prisma.notificationAttempt.findMany({
      where: { notificationEventId: event.id },
      orderBy: { attemptNumber: 'asc' },
    });
    expect(attempts).toHaveLength(3);
    expect(attempts.map((attempt) => attempt.status)).toEqual(['RETRYING', 'RETRYING', 'FAILED']);
    expect(attempts.map((attempt) => attempt.startedAt.toISOString())).toEqual([
      '2026-08-01T16:00:00.000Z',
      '2026-08-01T16:02:00.000Z',
      '2026-08-01T16:12:00.000Z',
    ]);
    expect(attempts.every((attempt) => attempt.error === 'WHATSAPP_DELIVERY_FAILED')).toBe(true);
    const alerts = await prisma.notificationEvent.findMany({
      where: { type: 'whatsapp_delivery_failed_admin', reservationId: reservation.id },
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      channel: 'email',
      recipient: env.ADMIN_NOTIFICATION_EMAIL,
      maxAttempts: 5,
      metadata: {
        templateCode: 'I-08',
        failedNotificationId: event.id,
        error: 'WHATSAPP_DELIVERY_FAILED',
      },
    });
    expect(JSON.stringify(alerts[0])).not.toContain('raw Meta token');
  });

  it('records delivered and read webhooks and retries a provider failure instead of failing early', async () => {
    const reservation = await seedReservation(true);
    const event = await prisma.notificationEvent.create({
      data: {
        reservationId: reservation.id,
        channel: 'whatsapp',
        type: 'booking_received_customer',
        recipient: '+237699333333',
        idempotencyKey: `p1-01-webhook:${reservation.id}`,
        providerMessageId: 'wamid-p1-01',
        providerStatus: 'accepted',
        status: NotificationStatus.SENT,
        attemptCount: 1,
        maxAttempts: 3,
      },
    });

    await handleWhatsAppWebhook({
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid-p1-01', status: 'delivered' }] } }] }],
    });
    let stored = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.providerStatus).toBe('delivered');
    expect(stored.deliveredAt).toBeInstanceOf(Date);

    await handleWhatsAppWebhook({
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid-p1-01', status: 'read' }] } }] }],
    });
    stored = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.providerStatus).toBe('read');
    expect((stored as typeof stored & { readAt?: Date | null }).readAt).toBeInstanceOf(Date);

    const failed = await prisma.notificationEvent.create({
      data: {
        reservationId: reservation.id,
        channel: 'whatsapp',
        type: 'booking_received_customer',
        recipient: '+237699333333',
        idempotencyKey: `p1-01-webhook-failed:${reservation.id}`,
        providerMessageId: 'wamid-p1-01-failed',
        providerStatus: 'accepted',
        status: NotificationStatus.SENT,
        attemptCount: 1,
        maxAttempts: 3,
      },
    });
    await handleWhatsAppWebhook({
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid-p1-01-failed', status: 'failed' }] } }] }],
    });
    const retrying = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: failed.id } });
    expect(retrying.status).toBe(NotificationStatus.PENDING);
    expect(retrying.providerStatus).toBe('retry_scheduled');
    expect(retrying.nextAttemptAt).toBeInstanceOf(Date);
    expect(retrying.error).toBe('WHATSAPP_PROVIDER_FAILED');
    expect(await prisma.notificationEvent.count({ where: { type: 'whatsapp_delivery_failed_admin' } })).toBe(0);
  });

  it('delivers the business template without requiring client consent and persists the provider result', async () => {
    Object.assign(env, {
      WHATSAPP_DELIVERY_ENABLED: true,
      WHATSAPP_PHONE_NUMBER_ID: 'phone-number-id',
      WHATSAPP_ACCESS_TOKEN: 'test-access-token',
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'test-verify-token',
      WHATSAPP_APP_SECRET: 'test-app-secret',
      WHATSAPP_TEMPLATE_BOOKING_RECEIVED_ADMIN: 'gsp_booking_received_admin_v1',
      WHATSAPP_TEMPLATE_BOOKING_RECEIVED: 'gsp_booking_received_customer_v1',
    });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: 'wamid-business-1' }] }),
    });
    const reservation = await seedReservation(false);
    await queueReservationCreatedNotifications(reservation.id);
    const business = await prisma.notificationEvent.findFirstOrThrow({
      where: { reservationId: reservation.id, channel: 'whatsapp', type: 'booking_received_admin' },
    });

    expect(await processNotificationEvent(business.id)).toBe('sent');
    const sent = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: business.id } });
    expect(sent).toMatchObject({
      status: NotificationStatus.SENT,
      providerMessageId: 'wamid-business-1',
      providerStatus: 'accepted',
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      messaging_product: 'whatsapp',
      to: '237673026654',
      type: 'template',
      template: { name: 'gsp_booking_received_admin_v1', language: { code: 'fr' } },
    });
    expect(JSON.stringify(body)).not.toContain('test-access-token');
  });
});
