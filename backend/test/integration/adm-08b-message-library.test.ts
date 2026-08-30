import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { AdminRole } from '../../src/generated/prisma/client.js';
import { emailTemplateRegistry, renderEmailTemplate } from '../../src/emails/templates.js';
import { refreshTemplateOverrides, resetTemplateOverrides } from '../../src/services/message-template-overrides.js';
import { sampleVariables } from '../../src/services/message-library.js';

const app = createApp();
const password = 'adm-08b-admin-password';

const resetDatabase = async () => {
  await prisma.auditLog.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.messageRule.deleteMany();
  await prisma.adminUser.deleteMany();
  resetTemplateOverrides();
};

const seed = async () => prisma.adminUser.create({
  data: { email: 'adm-08b-owner@example.test', name: 'Owner', passwordHash: await bcrypt.hash(password, 4), role: AdminRole.OWNER },
});

const signIn = async () => {
  const agent = request.agent(app);
  await agent.post('/api/admin/login').send({ email: 'adm-08b-owner@example.test', password }).expect(200);
  return agent;
};

const renderE01 = () => renderEmailTemplate('E-01', sampleVariables(emailTemplateRegistry['E-01'].requiredVariables), 'fr');

beforeEach(resetDatabase);
afterEach(resetTemplateOverrides);
afterAll(() => prisma.$disconnect());

describe('§8.1 the message library never costs the outbox a template', () => {
  it('renders from code when nothing is overridden', async () => {
    await refreshTemplateOverrides();
    expect(renderE01().subject).toBe(renderEmailTemplate('E-01', sampleVariables(emailTemplateRegistry['E-01'].requiredVariables), 'fr').subject);
    expect(renderE01().text).toContain('réservation');
  });

  it('uses a published override, and returns to the compiled copy when reverted', async () => {
    await seed();
    const agent = await signIn();

    await agent.post('/api/admin/messages/E-01')
      .send({ locale: 'fr', subject: 'Objet remplacé — [reference_courte]', preheader: 'Aperçu remplacé', body: ['Ligne remplacée pour [reference_courte].'] })
      .expect(200);

    // A draft alone changes nothing that is sent.
    await refreshTemplateOverrides();
    expect(renderE01().subject).not.toContain('Objet remplacé');

    await agent.post('/api/admin/messages/E-01/publish').expect(200);
    expect(renderE01().subject).toContain('Objet remplacé');
    expect(renderE01().text).toContain('Ligne remplacée');

    await agent.post('/api/admin/messages/E-01/revert').expect(204);
    expect(renderE01().subject).not.toContain('Objet remplacé');
    // The override is archived, not deleted: the history survives.
    expect(await prisma.messageTemplate.count({ where: { code: 'E-01' } })).toBe(1);
    expect((await prisma.messageTemplate.findFirstOrThrow({ where: { code: 'E-01' } })).status).toBe('ARCHIVED');
  });

  it('records the override version that rendered, not the compiled one', async () => {
    await seed();
    const agent = await signIn();
    const compiledVersion = renderE01().version;

    await agent.post('/api/admin/messages/E-01')
      .send({ locale: 'fr', subject: 'Objet suivi — [reference_courte]', preheader: 'Aperçu suivi', body: ['Ligne suivie pour [reference_courte].'] })
      .expect(200);
    await agent.post('/api/admin/messages/E-01/publish').expect(200);

    // The journal exists to say what went out. Recording the compiled version here
    // would attribute the studio's own text to the code that did not write it.
    const version = renderE01().version;
    expect(version).not.toBe(compiledVersion);
    expect(version).toBe(`${compiledVersion}+override.v1`);

    await agent.post('/api/admin/messages/E-01/revert').expect(204);
    expect(renderE01().version).toBe(compiledVersion);
  });

  it('refuses an override that would blank a message', async () => {
    await seed();
    const agent = await signIn();
    await agent.post('/api/admin/messages/E-01')
      .send({ locale: 'fr', subject: '   ', preheader: '', body: ['Quelque chose'] })
      .expect(400);
    await agent.post('/api/admin/messages/E-01')
      .send({ locale: 'fr', subject: 'Un objet', preheader: '', body: [] })
      .expect(400);
  });

  it('ignores a stored override with an empty body rather than sending a blank e-mail', async () => {
    // A row that slipped past validation must never reach a customer.
    await prisma.messageTemplate.create({
      data: { code: 'E-01', locale: 'fr', version: 1, status: 'PUBLISHED', subject: 'Objet', preheader: '', body: [] },
    });
    await refreshTemplateOverrides();
    expect(renderE01().subject).not.toBe('Objet');
  });

  it('keeps rendering when the override cache was never loaded', () => {
    // Simulates a database that was unreachable at refresh time.
    resetTemplateOverrides();
    expect(() => renderE01()).not.toThrow();
    expect(renderE01().text.length).toBeGreaterThan(0);
  });

  it('previews with sample data and never requires a real reservation', async () => {
    await seed();
    const agent = await signIn();
    const response = await agent.post('/api/admin/messages/E-01/preview').send({ locale: 'fr' }).expect(200);
    expect(response.body.data.subject).toContain('GSP-260830-EXEMPLE');
    expect(response.body.data.text.length).toBeGreaterThan(0);

    // A preview of an unsaved draft shows that draft, not the stored version.
    const draftPreview = await agent.post('/api/admin/messages/E-01/preview')
      .send({ locale: 'fr', subject: 'Brouillon [reference_courte]', preheader: '', body: ['Corps du brouillon'] })
      .expect(200);
    expect(draftPreview.body.data.subject).toContain('Brouillon GSP-260830-EXEMPLE');
  });

  it('sends a test to the studio address, never to a customer', async () => {
    await seed();
    const agent = await signIn();
    const response = await agent.post('/api/admin/messages/E-01/test-send').expect(202);
    expect(response.body.data.recipient).toBe(process.env.ADMIN_NOTIFICATION_EMAIL ?? response.body.data.recipient);

    const queued = await prisma.notificationEvent.findFirst({ where: { type: 'message_template_test_admin' } });
    expect(queued).not.toBeNull();
    expect(queued?.reservationId).toBeNull();
  });

  it('records a send rule without changing anything until it is set', async () => {
    await seed();
    const agent = await signIn();
    expect(await prisma.messageRule.count()).toBe(0);
    await agent.put('/api/admin/message-rules')
      .send({ event: 'booking_received_admin', delayMinutes: 5, groupingWindowMinutes: 5, maxAttempts: 3, fallbackChannel: null, isEnabled: true })
      .expect(200);
    const rule = await prisma.messageRule.findUniqueOrThrow({ where: { event: 'booking_received_admin' } });
    expect(rule.groupingWindowMinutes).toBe(5);
  });
});

describe('ADM-08b the journal is filterable', () => {
  const seedEvents = async () => {
    const base = { recipient: 'x@example.test', attemptCount: 0, maxAttempts: 5 };
    await prisma.notificationEvent.createMany({
      data: [
        { ...base, channel: 'email', type: 'booking_received_customer', status: 'SENT', createdAt: new Date('2026-08-20T09:00:00Z') },
        { ...base, channel: 'email', type: 'payment_verified_customer', status: 'FAILED', createdAt: new Date('2026-08-21T09:00:00Z') },
        { ...base, channel: 'email', type: 'payment_verified_customer', status: 'FAILED', resolvedAt: new Date(), resolution: 'OBSOLETE', createdAt: new Date('2026-08-22T09:00:00Z') },
        { ...base, channel: 'whatsapp', type: 'booking_received_customer', status: 'SENT', createdAt: new Date('2026-08-23T09:00:00Z') },
      ],
    });
  };

  it('hides a channel the studio has not switched on, and can show it on request', async () => {
    await seed();
    await seedEvents();
    const agent = await signIn();

    const hidden = await agent.get('/api/admin/notifications').expect(200);
    expect(hidden.body.data.every((row: { channel: string }) => row.channel !== 'whatsapp')).toBe(true);
    expect(hidden.body.meta.hiddenChannels).toContain('whatsapp');
    expect(hidden.body.meta.total).toBe(3);

    const shown = await agent.get('/api/admin/notifications').query({ includeDisabledChannels: 'true' }).expect(200);
    expect(shown.body.meta.total).toBe(4);
  });

  it('filters by status, type, date and actionability', async () => {
    await seed();
    await seedEvents();
    const agent = await signIn();

    expect((await agent.get('/api/admin/notifications').query({ status: 'FAILED' }).expect(200)).body.meta.total).toBe(2);
    expect((await agent.get('/api/admin/notifications').query({ type: 'payment_verified_customer' }).expect(200)).body.meta.total).toBe(2);
    expect((await agent.get('/api/admin/notifications').query({ from: '2026-08-21', to: '2026-08-21' }).expect(200)).body.meta.total).toBe(1);

    // Actionable means failed and not yet classified: the one an operator can still act on.
    expect((await agent.get('/api/admin/notifications').query({ actionableOnly: 'true' }).expect(200)).body.meta.total).toBe(1);
  });
});
