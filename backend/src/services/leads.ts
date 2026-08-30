import { queueLeadCreatedNotification } from '../emails/notifications.js';
import { Prisma } from '../generated/prisma/client.js';
import { LeadType } from '../generated/prisma/enums.js';
import { prisma } from '../db/prisma.js';
import { allocateLeadReference } from '../utils/lead-reference.js';

type LeadSubmission = {
  submissionKey: string;
  type: LeadType;
  source: 'contact_form' | 'b2b_form' | 'quote_form' | 'creative_form';
  locale: 'fr' | 'en';
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  rccm?: string;
  subject?: string;
  message: string;
  whatsappConsent: boolean;
};

export const createLeadSubmission = async (submission: LeadSubmission) => {
  const submissionKey = `${submission.source}:${submission.submissionKey}`;
  const existing = await prisma.lead.findUnique({ where: { submissionKey } });
  if (existing) {
    await queueLeadCreatedNotification(existing.id);
    return existing;
  }
  const reference = await allocateLeadReference(submission.type, async (candidate) => Boolean(await prisma.lead.findUnique({ where: { reference: candidate }, select: { id: true } })));
  const lead = await prisma.lead.upsert({
    where: { submissionKey },
    update: {},
    create: {
      reference,
      submissionKey,
      type: submission.type,
      locale: submission.locale,
      name: submission.name,
      email: submission.email,
      phone: submission.phone,
      whatsappConsentAt: submission.whatsappConsent ? new Date() : null,
      company: submission.company,
      rccm: submission.rccm,
      subject: submission.subject,
      message: submission.message,
      source: submission.source,
    },
  }).catch(async (error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.lead.findUniqueOrThrow({ where: { submissionKey } });
    }
    throw error;
  });

  await queueLeadCreatedNotification(lead.id);
  return lead;
};
