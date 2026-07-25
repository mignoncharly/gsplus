import { z } from 'zod';

import { PUBLIC_MEDIA_CATEGORIES } from '../constants/media.js';

import { LeadStatus, PaymentStatus, ReservationStatus } from '../generated/prisma/enums.js';
import { paymentReferenceValidationMessage } from '../utils/payment-reference.js';
import { isE164Phone, normalizeE164Phone } from '../utils/phone.js';

const requiredString = z.string().trim().min(1);
const optionalString = z.string().trim().min(1).optional();
const cuid = z.string().trim().min(1);
const phone = z
  .string()
  .trim()
  .min(6)
  .max(32)
  .transform(normalizeE164Phone)
  .refine(isE164Phone, 'Use a valid international phone number');
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const publicProtectionFields = {
  website: z.string().optional(),
  turnstileToken: z.string().optional(),
};

export const idParamsSchema = z.object({
  id: cuid,
});

export const reservationIdParamsSchema = z.object({
  reservationId: cuid,
});

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().trim().min(1).optional(),
});

export const availabilityQuerySchema = z
  .object({
    from: dateOnly,
    to: dateOnly,
    packageId: requiredString,
  })
  .refine((value) => value.from <= value.to, {
    path: ['to'],
    message: 'to must be greater than or equal to from',
  })
  .refine(
    (value) => {
      const from = Date.parse(`${value.from}T00:00:00.000Z`);
      const to = Date.parse(`${value.to}T00:00:00.000Z`);
      return (to - from) / 86_400_000 <= 60;
    },
    {
      path: ['to'],
      message: 'Availability range cannot exceed 60 days',
    },
  );

export const reservationIntentCreateSchema = z.object({
  ...publicProtectionFields,
  idempotencyKey: z.uuid(),
  packageId: requiredString,
  startAt: z.coerce.date(),
});

export const reservationCreateSchema = z.object({
  ...publicProtectionFields,
  intentId: requiredString,
  idempotencyKey: z.uuid(),
  customer: z.object({
    firstName: requiredString,
    lastName: requiredString,
    phone,
    email: z.email().optional(),
    birthDate: z.coerce.date().optional(),
    gender: optionalString,
    discoveryChannel: optionalString,
  }),
  consentImage: z.boolean().default(false),
  whatsappConsent: z.boolean().default(false),
  acceptedTerms: z.literal(true),
  paymentChoice: z.enum(['base', 'quote']).optional(),
  paymentMethod: z.enum(['mtn_momo', 'orange_money']).optional(),
  paymentPhone: phone.optional(),
  transactionRef: optionalString,
  extraInfo: optionalString,
}).superRefine((value, context) => {
  if (value.paymentChoice !== 'base') return;

  if (!value.paymentMethod) {
    context.addIssue({ code: 'custom', path: ['paymentMethod'], message: 'Payment method is required.' });
  }
  if (!value.paymentPhone) {
    context.addIssue({ code: 'custom', path: ['paymentPhone'], message: 'Payment phone is required.' });
  }

  const referenceIssue = paymentReferenceValidationMessage(value.paymentMethod, value.transactionRef);
  if (referenceIssue) {
    context.addIssue({ code: 'custom', path: ['transactionRef'], message: referenceIssue });
  }
});

export const contactSchema = z
  .object({
    ...publicProtectionFields,
    submissionKey: z.uuid(),
    name: requiredString,
    email: z.email(),
    phone: phone.optional(),
    whatsappConsent: z.boolean().default(false),
    subject: optionalString,
    message: z.string().trim().min(10).max(5000),
  })
  .superRefine((value, context) => {
    if (value.whatsappConsent && !value.phone) {
      context.addIssue({ code: 'custom', path: ['phone'], message: 'A phone number is required for WhatsApp notifications.' });
    }
  });

export const b2bInquirySchema = z.object({
  ...publicProtectionFields,
  submissionKey: z.uuid(),
  company: requiredString,
  rccm: optionalString,
  name: requiredString,
  email: z.email().optional(),
  phone,
  whatsappConsent: z.boolean().default(false),
  subject: optionalString,
  message: z.string().trim().min(10).max(5000),
});

export const quoteRequestSchema = z.object({
  ...publicProtectionFields,
  submissionKey: z.uuid(),
  name: requiredString,
  email: z.email().optional(),
  phone,
  whatsappConsent: z.boolean().default(false),
  packageName: optionalString,
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  message: z.string().trim().min(10).max(5000),
});

export const adminLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(200),
});

const packageSlug = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only');

const packageFieldsSchema = z.object({
  slug: packageSlug,
  name: requiredString,
  category: requiredString,
  description: z.string().trim().nullable(),
  price: z.coerce.number().int().min(0),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  durationMin: z.coerce.number().int().min(15).max(1440),
  deliveryLabel: z.string().trim().nullable(),
  options: z.json().nullable(),
  legalText: z.string().trim().min(10).nullable(),
  legalApprovedAt: z.coerce.date().nullable(),
  isPromo: z.boolean(),
  isRange: z.boolean(),
  isActive: z.boolean(),
  isArchived: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
});

export const packageCreateSchema = packageFieldsSchema.extend({
  description: packageFieldsSchema.shape.description.optional().default(null),
  currency: packageFieldsSchema.shape.currency.optional().default('XAF'),
  deliveryLabel: packageFieldsSchema.shape.deliveryLabel.optional().default(null),
  options: packageFieldsSchema.shape.options.optional().default(null),
  legalText: packageFieldsSchema.shape.legalText.optional().default(null),
  legalApprovedAt: packageFieldsSchema.shape.legalApprovedAt.optional().default(null),
  isPromo: packageFieldsSchema.shape.isPromo.optional().default(false),
  isRange: packageFieldsSchema.shape.isRange.optional().default(false),
  isActive: packageFieldsSchema.shape.isActive.optional().default(true),
  isArchived: packageFieldsSchema.shape.isArchived.optional().default(false),
  sortOrder: packageFieldsSchema.shape.sortOrder.optional().default(0),
}).superRefine((value, context) => {
  if (value.legalApprovedAt && !value.legalText) {
    context.addIssue({ code: 'custom', path: ['legalApprovedAt'], message: 'Legal text is required before approval.' });
  }
  if (value.legalApprovedAt && value.legalApprovedAt > new Date()) {
    context.addIssue({ code: 'custom', path: ['legalApprovedAt'], message: 'Legal approval date cannot be in the future.' });
  }
});

export const packageDuplicateSchema = z.object({
  slug: packageSlug.optional(),
  name: requiredString.optional(),
});

export const packageUpdateSchema = packageFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field must be provided' })
  .superRefine((value, context) => {
    if (value.legalApprovedAt && !value.legalText) {
      context.addIssue({ code: 'custom', path: ['legalApprovedAt'], message: 'Legal text must be submitted with legal approval.' });
    }
    if (value.legalApprovedAt && value.legalApprovedAt > new Date()) {
      context.addIssue({ code: 'custom', path: ['legalApprovedAt'], message: 'Legal approval date cannot be in the future.' });
    }
  });

export const reservationRescheduleSchema = z.object({
  startAt: z.coerce.date(),
  reason: z.string().trim().min(1).max(1000),
});

export const reservationStatusUpdateSchema = z
  .object({
    status: z.enum(Object.values(ReservationStatus)),
    reason: z.string().trim().min(1).max(1000).optional().nullable(),
    notes: z.string().trim().optional().nullable(),
  })
  .partial()
  .refine((value) => value.status !== undefined || value.notes !== undefined, {
    message: 'A status or notes field must be provided',
  });

export const leadUpdateSchema = z
  .object({
    status: z.enum(Object.values(LeadStatus)),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field must be provided' });

export const paymentVerificationSchema = z.object({
  status: z.enum([PaymentStatus.VERIFIED, PaymentStatus.REJECTED]),
  transactionRef: optionalString,
  reason: z.string().trim().min(1).max(1000).optional(),
});

export const mediaUploadSchema = z.object({
  title: requiredString,
  altText: requiredString,
  url: requiredString,
  storagePath: optionalString,
  thumbnailUrl: optionalString,
  category: z.enum(PUBLIC_MEDIA_CATEGORIES),
  width: z.coerce.number().int().min(1).optional(),
  height: z.coerce.number().int().min(1).optional(),
  mimeType: optionalString,
  fileSize: z.coerce.number().int().min(1).optional(),
  thumbnailWidth: z.coerce.number().int().min(1).optional(),
  thumbnailHeight: z.coerce.number().int().min(1).optional(),
  thumbnailFileSize: z.coerce.number().int().min(1).optional(),
  objectPosition: optionalString,
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const mediaUploadFieldsSchema = mediaUploadSchema.omit({
  url: true,
  storagePath: true,
  thumbnailUrl: true,
  width: true,
  height: true,
  mimeType: true,
  fileSize: true,
  thumbnailWidth: true,
  thumbnailHeight: true,
  thumbnailFileSize: true,
});

export const mediaUpdateSchema = mediaUploadSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field must be provided' });

export const availabilityBlockCreateSchema = z
  .object({
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    reason: optionalString,
  })
  .refine((value) => value.endAt > value.startAt, {
    path: ['endAt'],
    message: 'endAt must be after startAt',
  });

export const availabilityBlockUpdateSchema = availabilityBlockCreateSchema;
