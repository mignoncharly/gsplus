import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { AdminRole, LeadStatus, LeadType } from '../../src/generated/prisma/client.js';

const app = createApp();
const password = 'adm-phase-9-password';

const resetDatabase = async () => {
  await prisma.auditLog.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.adminUser.deleteMany();
};

const seedAdmin = async () => prisma.adminUser.create({
  data: { email: 'adm-phase-9@example.test', name: 'Owner', passwordHash: await bcrypt.hash(password, 4), role: AdminRole.OWNER },
});

const signIn = async () => {
  const agent = request.agent(app);
  await agent.post('/api/admin/login').send({ email: 'adm-phase-9@example.test', password }).expect(200);
  return agent;
};

const seedRequests = async () => {
  await prisma.lead.createMany({
    data: [
      { reference: 'CONTACT-260801-AAAA', type: LeadType.CONTACT, status: LeadStatus.NEW, name: 'Awa Ndiaye',
        email: 'awa@example.test', phone: '+237600000001', subject: 'Question tarifs', message: 'Bonjour, quels sont vos tarifs ?',
        source: 'contact_form', createdAt: new Date('2026-08-01T09:00:00Z'), whatsappConsentAt: new Date('2026-08-01T09:00:00Z') },
      { reference: 'CREA-260802-BBBB', type: LeadType.CREATIVE, status: LeadStatus.NEW, name: 'Bruno Kamga',
        email: 'bruno@example.test', phone: '+237600000002', subject: 'Service créatif : Flyer', message: 'Conception d’un flyer A5.',
        source: 'creative_form', createdAt: new Date('2026-08-02T09:00:00Z') },
      { reference: 'DEVIS-260803-CCCC', type: LeadType.QUOTE, status: LeadStatus.ARCHIVED, name: 'Chantal Mbarga',
        company: 'Studio Mbarga', email: 'chantal@example.test', subject: 'Quote request: Corporate Day', message: 'Séance équipe.',
        source: 'quote_form', createdAt: new Date('2026-08-03T09:00:00Z') },
    ],
  });
};

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('§7 received requests', () => {
  it('separates a creative request from a photography quote at submission', async () => {
    const submissionKey = '11111111-1111-4111-8111-111111111111';
    await request(app).post('/api/creative-requests')
      .send({ submissionKey, name: 'Danielle', phone: '+237600000009', service: 'Conception de flyer',
        message: 'Je voudrais un flyer pour mon commerce.', website: '' })
      .expect(201);

    const lead = await prisma.lead.findFirstOrThrow({ where: { name: 'Danielle' } });
    expect(lead.type).toBe(LeadType.CREATIVE);
    expect(lead.source).toBe('creative_form');
    // Its own reference prefix, so the kind is legible before the record is opened.
    expect(lead.reference.startsWith('CREA-')).toBe(true);
    expect(lead.subject).toBe('Service créatif : Conception de flyer');
  });

  it('finds a request by any business detail, not only its reference', async () => {
    await seedAdmin();
    await seedRequests();
    const agent = await signIn();

    for (const [term, expected] of [
      ['contact-260801-aaaa', 'CONTACT-260801-AAAA'],
      ['Bruno', 'CREA-260802-BBBB'],
      ['chantal@example.test', 'DEVIS-260803-CCCC'],
      ['+237600000002', 'CREA-260802-BBBB'],
      ['Studio Mbarga', 'DEVIS-260803-CCCC'],
      ['flyer', 'CREA-260802-BBBB'],
    ]) {
      const { body } = await agent.get(`/api/admin/leads?q=${encodeURIComponent(term)}`).expect(200);
      expect(body.data.map((item: { reference: string }) => item.reference), `searching ${term}`).toEqual([expected]);
      expect(body.meta.total).toBe(1);
    }
  });

  it('filters by type, status and business day, and reports a real total', async () => {
    await seedAdmin();
    await seedRequests();
    const agent = await signIn();

    const creative = await agent.get('/api/admin/leads?type=CREATIVE').expect(200);
    expect(creative.body.meta.total).toBe(1);

    const open = await agent.get('/api/admin/leads?status=NEW&status=IN_PROGRESS').expect(200);
    expect(open.body.meta.total).toBe(2);

    const day = await agent.get('/api/admin/leads?from=2026-08-02&to=2026-08-02').expect(200);
    expect(day.body.data.map((item: { reference: string }) => item.reference)).toEqual(['CREA-260802-BBBB']);
  });

  it('records who closed a request, and lets it be reopened', async () => {
    const admin = await seedAdmin();
    await seedRequests();
    const agent = await signIn();
    const lead = await prisma.lead.findFirstOrThrow({ where: { reference: 'CONTACT-260801-AAAA' } });

    await agent.patch(`/api/admin/leads/${lead.id}`).send({ status: 'HANDLED' }).expect(200);
    const handled = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(handled.status).toBe(LeadStatus.HANDLED);
    expect(handled.handledById).toBe(admin.id);
    expect(handled.handledAt).not.toBeNull();

    // Reopening clears the closure rather than leaving a stale author on an open request.
    await agent.patch(`/api/admin/leads/${lead.id}`).send({ status: 'IN_PROGRESS' }).expect(200);
    const reopened = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(reopened.handledById).toBeNull();
    expect(reopened.handledAt).toBeNull();
  });

  it('refuses the pipeline statuses the report excludes', async () => {
    await seedAdmin();
    await seedRequests();
    const agent = await signIn();
    const lead = await prisma.lead.findFirstOrThrow({ where: { reference: 'CONTACT-260801-AAAA' } });
    for (const status of ['WON', 'LOST']) {
      const { body } = await agent.patch(`/api/admin/leads/${lead.id}`).send({ status }).expect(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    }
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe(LeadStatus.NEW);
  });

  it('keeps an internal note internal, and separate from the message', async () => {
    await seedAdmin();
    await seedRequests();
    const agent = await signIn();
    const lead = await prisma.lead.findFirstOrThrow({ where: { reference: 'CREA-260802-BBBB' } });

    await agent.patch(`/api/admin/leads/${lead.id}`).send({ internalNote: '  Rappeler après 17 h  ' }).expect(200);
    const noted = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(noted.internalNote).toBe('Rappeler après 17 h');
    // The demander's own words are untouched by a note about them.
    expect(noted.message).toBe('Conception d’un flyer A5.');

    await agent.patch(`/api/admin/leads/${lead.id}`).send({ internalNote: null }).expect(200);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).internalNote).toBeNull();
  });

  it('exports the filtered list, not the whole table, and records the export', async () => {
    await seedAdmin();
    await seedRequests();
    const agent = await signIn();

    const { text } = await agent.get('/api/admin/leads/export.csv?type=CREATIVE').expect(200);
    const lines = text.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('consentement_whatsapp');
    expect(lines[1]).toContain('CREA-260802-BBBB');
    expect(lines[1]).not.toContain('CONTACT-260801-AAAA');

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'lead.export' } });
    expect(log.metadata).toMatchObject({ total: 1 });
  });

  it('quotes a message containing a comma or a newline so the export stays readable', async () => {
    await seedAdmin();
    await prisma.lead.create({
      data: { reference: 'CONTACT-260804-DDDD', type: LeadType.CONTACT, status: LeadStatus.NEW, name: 'Élodie',
        message: 'Bonjour,\nJe cherche un "portrait" pour mon CV.', source: 'contact_form' },
    });
    const agent = await signIn();
    const { text } = await agent.get('/api/admin/leads/export.csv').expect(200);
    expect(text).toContain('"Bonjour,\nJe cherche un ""portrait"" pour mon CV."');
  });
});
