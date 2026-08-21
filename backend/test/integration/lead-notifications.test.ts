import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../../src/db/prisma.js';
import { LeadType } from '../../src/generated/prisma/client.js';
import { createLeadSubmission } from '../../src/services/leads.js';

const resetDatabase = async () => {
  await prisma.notificationEvent.deleteMany();
  await prisma.lead.deleteMany();
};

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('NOTIF-01 lead acknowledgements', () => {
  it.each([
    { type: LeadType.CONTACT, source: 'contact_form' as const, code: 'E-22', company: undefined },
    { type: LeadType.B2B, source: 'b2b_form' as const, code: 'E-23', company: 'Atelier Test' },
  ])('queues one frozen $code acknowledgement and one I-12 event idempotently', async ({ type, source, code, company }) => {
    const submission = {
      submissionKey: `${source}-notif-01`,
      type,
      source,
      name: 'Aline Lead',
      email: 'aline.lead@example.test',
      phone: '+237699111222',
      company,
      subject: 'Demande portrait',
      message: 'Je souhaite obtenir des informations complémentaires.',
      whatsappConsent: false,
    };
    const lead = await createLeadSubmission(submission);
    await createLeadSubmission(submission);

    const events = await prisma.notificationEvent.findMany({
      where: { leadId: lead.id, channel: 'email' },
      orderBy: { recipient: 'asc' },
    });
    expect(events).toHaveLength(2);
    expect(events.find((event) => event.recipient === submission.email)).toMatchObject({
      templateCode: code,
      templateVersion: '2026-08-20-phase4',
      renderedContent: { code, audience: 'customer' },
    });
    expect(events.find((event) => event.recipient !== submission.email)).toMatchObject({
      type: 'lead_created_admin',
      templateCode: 'I-12',
      templateVersion: '2026-08-20-phase4',
      renderedContent: { code: 'I-12', audience: 'admin' },
    });
    const customerRender = events.find((event) => event.recipient === submission.email)?.renderedContent as {
      subject: string;
      text: string;
    };
    expect(customerRender.subject).toMatch(/CONTACT-|B2B-/);
    expect(customerRender.text).toContain('Aline Lead');
    expect(customerRender.subject).toContain(lead.reference);
    const adminRender = events.find((event) => event.recipient !== submission.email)?.renderedContent as { text: string };
    expect(adminRender.text).toContain(`/admin/leads/${lead.reference}`);
  });
});
