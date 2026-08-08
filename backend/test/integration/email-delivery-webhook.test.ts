import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { prisma } from '../../src/db/prisma.js';
import { NotificationStatus } from '../../src/generated/prisma/client.js';

beforeEach(async () => {
  await prisma.emailDeliveryReport.deleteMany();
  await prisma.notificationEvent.deleteMany();
});
afterAll(() => prisma.$disconnect());

describe('signed e-mail delivery webhook', () => {
  it('rejects an invalid signature and accepts one authenticated provider report once', async () => {
    const event = await prisma.notificationEvent.create({
      data: {
        channel: 'email',
        type: 'test_delivery',
        recipient: 'qa@example.test',
        providerMessageId: 'signed-smtp-message-001',
        providerStatus: 'accepted',
        status: NotificationStatus.SENT,
        attemptCount: 1,
        sentAt: new Date(),
      },
    });
    const body = {
      providerEventId: 'signed-provider-event-001',
      providerMessageId: event.providerMessageId,
      status: 'DELIVERED',
      smtpCode: '250',
      occurredAt: '2026-08-02T10:30:00.000Z',
    };
    await request(createApp())
      .post('/api/webhooks/email-delivery')
      .set('x-gsplus-signature-256', 'sha256=' + '0'.repeat(64))
      .send(body)
      .expect(401);
    expect(await prisma.emailDeliveryReport.count()).toBe(0);

    const raw = JSON.stringify(body);
    const secret = env.EMAIL_DELIVERY_WEBHOOK_SECRET;
    expect(secret).toBeTruthy();
    const signature = createHmac('sha256', secret!).update(raw).digest('hex');
    await request(createApp())
      .post('/api/webhooks/email-delivery')
      .set('Content-Type', 'application/json')
      .set('x-gsplus-signature-256', `sha256=${signature}`)
      .send(raw)
      .expect(200);
    await request(createApp())
      .post('/api/webhooks/email-delivery')
      .set('Content-Type', 'application/json')
      .set('x-gsplus-signature-256', `sha256=${signature}`)
      .send(raw)
      .expect(200);

    expect(await prisma.emailDeliveryReport.count()).toBe(1);
    expect(await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({
      status: NotificationStatus.SENT,
      providerStatus: 'delivered',
      deliveredAt: new Date(body.occurredAt),
    });
  });
});
