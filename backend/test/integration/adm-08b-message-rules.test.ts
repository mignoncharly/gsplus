import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { AdminRole, NotificationStatus } from '../../src/generated/prisma/client.js';
import { processNotificationEvent } from '../../src/emails/notifications.js';
import { GOVERNED_EVENTS, refreshMessageRules, resetMessageRules } from '../../src/services/message-rules.js';

const app = createApp();
const password = 'adm-08b-rules-password';

const resetDatabase = async () => {
  await prisma.auditLog.deleteMany();
  await prisma.notificationAttempt.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.messageRule.deleteMany();
  await prisma.adminUser.deleteMany();
  resetMessageRules();
};

const seed = async () => prisma.adminUser.create({
  data: { email: 'adm-08b-rules@example.test', name: 'Owner', passwordHash: await bcrypt.hash(password, 4), role: AdminRole.OWNER },
});

const signIn = async () => {
  const agent = request.agent(app);
  await agent.post('/api/admin/login').send({ email: 'adm-08b-rules@example.test', password }).expect(200);
  return agent;
};

const queueInternal = (overrides: Record<string, unknown> = {}) => prisma.notificationEvent.create({
  data: {
    channel: 'email',
    type: 'payment_added_admin',
    recipient: 'studio@example.test',
    idempotencyKey: `rule-test:${Math.random()}`,
    status: NotificationStatus.PENDING,
    templateCode: 'I-05',
    renderedContent: { subject: 'x', text: 'x', html: '<p>x</p>' },
    ...overrides,
  },
});

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('§8.1 sending rules govern the studio’s internal e-mails', () => {
  it('lists every governed event, configured or not', async () => {
    await seed();
    const agent = await signIn();
    const { body } = await agent.get('/api/admin/message-rules').expect(200);
    expect(body.data).toHaveLength(GOVERNED_EVENTS.length);
    // An event with no stored row is running on the application's behaviour, and says so
    // rather than being absent from the list.
    expect(body.data.every((rule: { isConfigured: boolean }) => rule.isConfigured === false)).toBe(true);
    expect(body.data.every((rule: { isEnabled: boolean }) => rule.isEnabled)).toBe(true);
  });

  it('changes nothing while no rule is stored', async () => {
    await refreshMessageRules();
    const event = await queueInternal();
    await processNotificationEvent(event.id, { sendEmail: async () => ({ messageId: 'ok' }) });
    const after = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(after.status).toBe(NotificationStatus.SENT);
  });

  it('stops a disabled message before it is sent, and records why', async () => {
    await seed();
    const agent = await signIn();
    await agent.put('/api/admin/message-rules')
      .send({ event: 'payment_added_admin', delayMinutes: null, groupingWindowMinutes: null, maxAttempts: null, isEnabled: false })
      .expect(200);

    const event = await queueInternal();
    let sent = 0;
    await processNotificationEvent(event.id, { sendEmail: async () => { sent += 1; return { messageId: 'ok' }; } });
    const after = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(sent).toBe(0);
    expect(after.status).toBe(NotificationStatus.CANCELLED);
    expect(after.resolution).toBe('SUPPRESSED');
    expect(after.resolutionNote).toBe('DISABLED_BY_RULE');
  });

  it('refuses to silence an alarm rather than storing a setting it would ignore', async () => {
    await seed();
    const agent = await signIn();
    const { body } = await agent.put('/api/admin/message-rules')
      .send({ event: 'calendar_sync_failed_admin', delayMinutes: null, groupingWindowMinutes: null, maxAttempts: null, isEnabled: false })
      .expect(422);
    expect(body.error.code).toBe('MESSAGE_EVENT_UNSILENCEABLE');
    expect(await prisma.messageRule.count()).toBe(0);

    // Delaying the same alarm is allowed: the signal still arrives.
    await agent.put('/api/admin/message-rules')
      .send({ event: 'calendar_sync_failed_admin', delayMinutes: 10, groupingWindowMinutes: null, maxAttempts: null, isEnabled: true })
      .expect(200);
  });

  it('defers an e-mail until its delay has passed, then sends it', async () => {
    await seed();
    const agent = await signIn();
    await agent.put('/api/admin/message-rules')
      .send({ event: 'payment_added_admin', delayMinutes: 30, groupingWindowMinutes: null, maxAttempts: null, isEnabled: true })
      .expect(200);

    const event = await queueInternal();
    let sent = 0;
    const send = async () => { sent += 1; return { messageId: 'ok' }; };
    await processNotificationEvent(event.id, { sendEmail: send });
    const deferred = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(sent).toBe(0);
    expect(deferred.status).toBe(NotificationStatus.PENDING);
    expect(deferred.nextAttemptAt?.getTime()).toBe(event.createdAt.getTime() + 30 * 60_000);

    // Nothing is lost: once the delay has elapsed the same event goes out.
    const later = new Date(event.createdAt.getTime() + 31 * 60_000);
    await processNotificationEvent(event.id, { sendEmail: send, now: () => later });
    expect((await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } })).status).toBe(NotificationStatus.SENT);
    expect(sent).toBe(1);
  });

  it('groups a repeat into a message the studio has already received', async () => {
    await seed();
    const agent = await signIn();
    await agent.put('/api/admin/message-rules')
      .send({ event: 'payment_added_admin', delayMinutes: null, groupingWindowMinutes: 60, maxAttempts: null, isEnabled: true })
      .expect(200);

    const first = await queueInternal();
    await processNotificationEvent(first.id, { sendEmail: async () => ({ messageId: 'ok' }) });
    expect((await prisma.notificationEvent.findUniqueOrThrow({ where: { id: first.id } })).status).toBe(NotificationStatus.SENT);

    const second = await queueInternal();
    let sent = 0;
    await processNotificationEvent(second.id, { sendEmail: async () => { sent += 1; return { messageId: 'ok' }; } });
    const grouped = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: second.id } });
    expect(sent).toBe(0);
    expect(grouped.status).toBe(NotificationStatus.CANCELLED);
    expect(grouped.resolution).toBe('GROUPED');
    // The journal can point at the message that did arrive.
    expect(grouped.replacementEventId).toBe(first.id);
  });

  it('leaves a rule inert when the cache was never loaded', async () => {
    await prisma.messageRule.create({
      data: { event: 'payment_added_admin', isEnabled: false },
    });
    resetMessageRules();
    const event = await queueInternal();
    // An unread rule table must never stop the outbox; the compiled behaviour stands.
    await processNotificationEvent(event.id, { sendEmail: async () => ({ messageId: 'ok' }) });
    expect((await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } })).status).toBe(NotificationStatus.SENT);
  });
});
