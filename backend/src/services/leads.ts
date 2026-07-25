import { queueLeadCreatedNotification } from '../emails/notifications.js';
import { Prisma } from '../generated/prisma/client.js';
import { LeadType } from '../generated/prisma/enums.js';
import { prisma } from '../db/prisma.js';

type LeadSubmission = {
  submissionKey: string;
  type: LeadType;
  source: 'contact_form' | 'b2b_form' | 'quote_form';
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
  const lead = await prisma.lead.upsert({
    where: { submissionKey },
    update: {},
    create: {
      submissionKey,
      type: submission.type,
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
