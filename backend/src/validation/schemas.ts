import { z } from 'zod';

import { PUBLIC_MEDIA_CATEGORIES } from '../constants/media.js';

import { PackageBookingMode, PaymentStatus, ReservationStatus } from '../generated/prisma/enums.js';
import { CUSTOMER_REASON_CODES } from '../services/customer-decision-copy.js';
import { paymentReferenceValidationMessage } from '../utils/payment-reference.js';
import {
  isValidCameroonPhone,
  isValidEmailAddress,
  normalizeCameroonPhone,
  normalizeEmailAddress,
} from '../utils/contact-validation.js';

const requiredString = z.string().trim().min(1);
const optionalString = z.string().trim().min(1).optional();
const cuid = z.string().trim().min(1);
const PHONE_INVALID_MESSAGE = 'Saisissez un numéro camerounais valide, par exemple 640 70 32 49.';
const EMAIL_INVALID_MESSAGE = 'Saisissez une adresse e-mail valide.';
const customerCopyFields = {
  internalReason: z.string().trim().min(1).max(1000),
  customerReasonCode: z.enum(CUSTOMER_REASON_CODES).optional(),
  customerReasonText: z.string().trim().max(280).optional().nullable(),
};
const phone = z
  .string()
  .trim()
  .min(1, PHONE_INVALID_MESSAGE)
  .max(32, PHONE_INVALID_MESSAGE)
  .refine(isValidCameroonPhone, PHONE_INVALID_MESSAGE)
  .transform((value) => normalizeCameroonPhone(value)!);
const reservationPhone = z
  .string()
  .trim()
  .min(1, PHONE_INVALID_MESSAGE)
  .max(32, PHONE_INVALID_MESSAGE)
  .refine(isValidCameroonPhone, PHONE_INVALID_MESSAGE);
const emailAddress = z
  .string()
  .trim()
  .min(1, EMAIL_INVALID_MESSAGE)
  .max(254, EMAIL_INVALID_MESSAGE)
  .refine(isValidEmailAddress, EMAIL_INVALID_MESSAGE)
  .transform(normalizeEmailAddress);
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

const queryBoolean = z.preprocess((value) => value === 'true' || value === true ? true : value === 'false' || value === false ? false : value, z.boolean());

/**
 * Plain pagination for the lists that have no filters yet: leads and notifications.
 * It previously declared `status` and `reference`, which no route ever read — the
 * reservation list looked filterable while ignoring both. Those fields now live in
 * `reservationListQuerySchema`, where they are actually applied. Leads and
 * notifications gain their own filters in later phases.
 */
export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const repeatable = (schema: z.ZodTypeAny) =>
  z.preprocess((value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]), z.array(schema).optional());

const businessDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Utilisez le format AAAA-MM-JJ.');

const clockTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Utilisez le format HH:MM.');
const breakList = z.array(z.object({ start: clockTime, end: clockTime })).max(6).optional();

export const adminSavedViewListQuerySchema = z.object({
  scope: z.enum(['reservations']),
});

export const adminSavedViewSchema = z.object({
  scope: z.enum(['reservations']),
  name: z.string().trim().min(1).max(80),
  filters: z.record(z.string(), z.unknown()),
});

export const calendarSyncLogListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: repeatable(z.enum(['PENDING', 'SYNCING', 'RETRYING', 'SYNCED', 'FAILED'])),
});

export const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  channel: z.enum(['email', 'whatsapp']).optional(),
  status: repeatable(z.enum(['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED'])),
  type: z.string().trim().min(1).max(80).optional(),
  from: businessDate.optional(),
  to: businessDate.optional(),
  actionableOnly: queryBoolean.optional(),
  includeDisabledChannels: queryBoolean.optional(),
});

export const messageTemplateDraftSchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
  subject: requiredString.max(300),
  preheader: z.string().trim().max(300).default(''),
  body: z.array(z.string()).min(1).max(60),
  senderName: z.string().trim().max(120).default(''),
  fromAddress: z.string().trim().email().max(254).or(z.literal('')).default(''),
  replyTo: z.string().trim().email().max(254).or(z.literal('')).default(''),
  channel: z.literal('email').default('email'),
  fallbackChannel: z.enum(['whatsapp']).nullable().default(null),
});

export const messagePreviewSchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
  subject: z.string().trim().max(300).optional(),
  preheader: z.string().trim().max(300).optional(),
  body: z.array(z.string()).max(60).optional(),
  senderName: z.string().trim().max(120).optional(),
  fromAddress: z.string().trim().email().max(254).or(z.literal('')).optional(),
  replyTo: z.string().trim().email().max(254).or(z.literal('')).optional(),
  channel: z.literal('email').optional(),
  fallbackChannel: z.enum(['whatsapp']).nullable().optional(),
});

export const messageRuleSchema = z.object({
  event: requiredString.max(80),
  delayMinutes: z.coerce.number().int().min(0).max(10080).nullable(),
  groupingWindowMinutes: z.coerce.number().int().min(0).max(1440).nullable(),
  maxAttempts: z.coerce.number().int().min(1).max(20).nullable(),
  fallbackChannel: z.enum(['whatsapp']).nullable().default(null),
  isEnabled: z.boolean().default(true),
});

export const settingGroupUpdateSchema = z.object({
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

export const contentDraftSchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
  body: z.record(z.string(), z.string()),
});

export const businessHourUpdateSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  opensAt: clockTime,
  closesAt: clockTime,
  isClosed: z.boolean(),
  breaks: breakList,
});

export const scheduleExceptionSchema = z.object({
  date: businessDate,
  isClosed: z.boolean(),
  opensAt: clockTime.nullish(),
  closesAt: clockTime.nullish(),
  breaks: breakList,
  reason: requiredString.max(200),
});

export const bookingRuleSchema = z.object({
  packageId: z.string().trim().min(1).nullable(),
  minNoticeMinutes: z.coerce.number().int().min(0).max(60 * 24 * 30).nullable(),
  horizonDays: z.coerce.number().int().min(1).max(1095).nullable(),
  dailyCapacity: z.coerce.number().int().min(1).max(100).nullable(),
  bufferMinutes: z.coerce.number().int().min(0).max(240).nullable(),
});

export const planningWindowQuerySchema = z.object({
  from: businessDate,
  to: businessDate,
});

export const reservationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().trim().min(1).max(120).optional(),
  status: repeatable(z.enum(['PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'COMPLETED', 'NO_SHOW'])),
  payment: repeatable(z.enum(['NONE', 'PENDING', 'PAYMENT_INFO_REQUIRED', 'VERIFICATION_BLOCKED', 'VERIFIED', 'PAID', 'REJECTED', 'REFUND_PENDING', 'REFUNDED', 'FAILED'])),
  rescheduleStatus: repeatable(z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'])),
  packageId: z.string().trim().min(1).optional(),
  from: businessDate.optional(),
  to: businessDate.optional(),
  sort: z.enum(['startAt', 'createdAt', 'reference']).default('startAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
  // Retained so the historical exact-reference lookup keeps working.
  reference: z.string().trim().min(1).max(32).transform((value) => value.toUpperCase()).optional(),
});

export const paymentListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: repeatable(z.enum(['PENDING', 'PAYMENT_INFO_REQUIRED', 'VERIFICATION_BLOCKED', 'VERIFIED', 'REJECTED', 'PAID', 'REFUND_PENDING', 'REFUNDED', 'FAILED'])),
  method: z.enum(['mtn_momo', 'orange_money']).optional(),
  open: queryBoolean.optional(),
  mismatch: queryBoolean.optional(),
  duplicate: queryBoolean.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().min(1).max(120).optional(),
});

export const paymentDeclaredAmountSchema = z.object({
  commandId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  declaredAmount: z.number().int().min(0),
  reason: requiredString.max(500),
});

export const paymentDuplicateSchema = z.object({
  duplicateOfPaymentId: z.string().trim().min(1).nullable(),
  reason: requiredString.max(500),
});

export const financialTaskListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: repeatable(z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'])),
  overdue: queryBoolean.optional(),
  reservationReference: z.string().trim().min(1).max(32).transform((value) => value.toUpperCase()).optional(),
  operatorId: cuid.optional(),
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
  scheduleKind: z.enum(['STANDARD_HOLD', 'CUSTOM_PROPOSAL']).default('STANDARD_HOLD'),
});

export const reservationCreateSchema = z.object({
  ...publicProtectionFields,
  intentId: requiredString,
  idempotencyKey: z.uuid(),
  locale: z.enum(['fr', 'en']).default('fr'),
  customer: z
    .object({
      firstName: requiredString,
      lastName: requiredString,
      phone: reservationPhone,
      email: emailAddress,
      birthDate: z.coerce.date().optional(),
      gender: optionalString,
      discoveryChannel: optionalString,
    })
    .transform((value) => ({
      ...value,
      phoneRaw: value.phone,
      phone: normalizeCameroonPhone(value.phone)!,
    })),
  consentImage: z.boolean().default(false),
  whatsappConsent: z.boolean().default(false),
  whatsappMarketingConsent: z.boolean().default(false),
  acceptedTerms: z.literal(true),
  acceptedPrivacy: z.literal(true),
  paymentChoice: z.enum(['base', 'quote']).optional(),
  paymentMethod: z.enum(['mtn_momo', 'orange_money']).optional(),
  paymentPhone: phone.optional(),
  transactionRef: optionalString,
  extraInfo: optionalString,
}).superRefine((value, context) => {
  if (value.paymentChoice !== 'base') return;

  if (!value.paymentMethod) {
    context.addIssue({ code: 'custom', path: ['paymentMethod'], message: 'Choisissez un moyen de paiement.' });
  }
  if (!value.paymentPhone) {
    context.addIssue({ code: 'custom', path: ['paymentPhone'], message: 'Renseignez le téléphone utilisé pour le paiement.' });
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
    locale: z.enum(['fr', 'en']).default('fr'),
    name: requiredString,
    email: emailAddress,
    phone: phone.optional(),
    whatsappConsent: z.boolean().default(false),
    subject: optionalString,
    message: z.string().trim().min(10).max(5000),
  })
  .superRefine((value, context) => {
    if (value.whatsappConsent && !value.phone) {
      context.addIssue({ code: 'custom', path: ['phone'], message: 'Renseignez un téléphone camerounais pour recevoir les informations sur WhatsApp.' });
    }
  });

export const b2bInquirySchema = z.object({
  ...publicProtectionFields,
  submissionKey: z.uuid(),
  locale: z.enum(['fr', 'en']).default('fr'),
  company: requiredString,
  rccm: optionalString,
  name: requiredString,
  email: emailAddress,
  phone,
  whatsappConsent: z.boolean().default(false),
  subject: optionalString,
  message: z.string().trim().min(10).max(5000),
});

export const quoteRequestSchema = z.object({
  ...publicProtectionFields,
  submissionKey: z.uuid(),
  locale: z.enum(['fr', 'en']).default('fr'),
  name: requiredString,
  email: emailAddress.optional(),
  phone,
  whatsappConsent: z.boolean().default(false),
  packageName: optionalString,
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  message: z.string().trim().min(10).max(5000),
});

/**
 * A creative-services request. Same shape as a quote, but `service` names the creative
 * service asked for rather than a photography package — the two were indistinguishable
 * once they both became a QUOTE lead.
 */
export const creativeRequestSchema = z.object({
  ...publicProtectionFields,
  submissionKey: z.uuid(),
  locale: z.enum(['fr', 'en']).default('fr'),
  name: requiredString,
  email: emailAddress.optional(),
  phone,
  whatsappConsent: z.boolean().default(false),
  service: optionalString,
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  message: z.string().trim().min(10).max(5000),
});

export const adminInvitationAcceptSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string().min(12).max(200),
});

export const adminAccountInviteSchema = z.object({
  email: z.email(),
  name: requiredString.max(120),
  role: z.enum(['OWNER', 'STAFF']),
});

export const adminAccountRoleSchema = z.object({ role: z.enum(['OWNER', 'STAFF']) });
export const adminAccountActiveSchema = z.object({ isActive: z.boolean() });
export const adminPermissionGrantSchema = z.object({
  permissions: z.array(z.string().trim().min(1).max(60)).max(40),
});
export const adminTotpConfirmSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });
export const adminSessionRevokeSchema = z.object({ reason: z.string().trim().max(200).optional() });
export const adminSessionListQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25), offset: z.coerce.number().int().min(0).default(0), status: z.enum(['active', 'revoked', 'expired']).optional(), q: z.string().trim().min(1).max(120).optional() });

export const auditListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().trim().min(1).max(120).optional(),
  adminUserId: z.string().trim().min(1).max(60).optional(),
  action: z.string().trim().min(1).max(80).optional(),
  entityType: z.string().trim().min(1).max(60).optional(),
  from: businessDate.optional(),
  to: businessDate.optional(),
});

export const adminLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(200),
  // Six digits for TOTP, or one of the ten-character hexadecimal recovery codes.
  // Optional because the first password-valid request is what tells the client to ask.
  totpCode: z.string().trim().min(6).max(20).optional(),
});

export const adminPasswordChangeSchema = z.object({
  currentPassword: z.string().min(8).max(200),
  newPassword: z.string().min(12).max(200),
});

export const notificationResolutionSchema = z.object({
  resolution: z.enum([
    'OBSOLETE',
    'DUPLICATE',
    'PERMANENTLY_FAILED',
    'ACTIONABLE_REVIEW_REQUIRED',
    'REPLACED',
  ]),
  note: z.string().trim().min(10).max(1000),
  replacementEventId: z.string().trim().min(1).max(100).optional(),
});

export const emailDeliveryReportSchema = z.object({
  providerEventId: z.string().trim().min(1).max(255),
  providerMessageId: z.string().trim().min(1).max(500),
  status: z.enum(['DELIVERED', 'TEMPORARY_FAILURE', 'PERMANENT_FAILURE']),
  smtpCode: z.string().trim().min(3).max(20).optional().nullable(),
  occurredAt: z.coerce.date(),
});

const packageSlug = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Utilisez uniquement des minuscules, chiffres et tirets.');

const packageLocaleSchema = z.object({
  locale: z.enum(['fr', 'en']),
  name: requiredString,
  description: z.string().trim().nullable().optional(),
  content: z.string().trim().min(10),
  inclusions: z.array(z.string().trim().min(1).max(500)).min(1).max(50),
  conditions: z.string().trim().min(10),
  deliveryLabel: requiredString,
  mandatoryWording: z.string().trim().min(10),
  options: z.json().nullable().optional(),
  sourceReference: requiredString,
  approvedAt: z.coerce.date().nullable().optional(),
  isEnabled: z.boolean().optional(),
});

const packageFieldsSchema = z.object({
  slug: packageSlug,
  name: requiredString,
  category: requiredString,
  taxonomyKey: z.enum(['portraits-identite', 'couples-familles-groupes', 'maternite-bebe-enfant', 'anniversaires', 'fiancailles-pre-mariage', 'evenements', 'createurs-entreprises', 'privileges-golden-promotion']),
  englishEnabled: z.boolean(),
  locales: z.array(packageLocaleSchema).min(1).max(2).refine((items) => new Set(items.map((item) => item.locale)).size === items.length, { message: 'Chaque langue doit être unique.' }),
  description: z.string().trim().nullable(),
  content: z.string().trim().min(10).nullable(),
  inclusions: z.array(z.string().trim().min(1).max(500)).min(1).max(50).nullable(),
  conditions: z.string().trim().min(10).nullable(),
  price: z.coerce.number().int().min(0),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  durationMin: z.coerce.number().int().min(15).max(1440).nullable(),
  bookingMode: z.enum(PackageBookingMode),
  deliveryLabel: z.string().trim().nullable(),
  options: z.json().nullable(),
  legalText: z.string().trim().min(10).nullable(),
  legalApprovedAt: z.coerce.date().nullable(),
  effectiveAt: z.coerce.date().nullable(),
  isPromo: z.boolean(),
  isRange: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
});

export const packageCreateSchema = packageFieldsSchema.extend({
  taxonomyKey: packageFieldsSchema.shape.taxonomyKey.optional(),
  englishEnabled: packageFieldsSchema.shape.englishEnabled.optional().default(false),
  locales: packageFieldsSchema.shape.locales.optional(),
  description: packageFieldsSchema.shape.description.optional().default(null),
  content: packageFieldsSchema.shape.content.optional().default(null),
  inclusions: packageFieldsSchema.shape.inclusions.optional().default(null),
  conditions: packageFieldsSchema.shape.conditions.optional().default(null),
  currency: packageFieldsSchema.shape.currency.optional().default('XAF'),
  durationMin: packageFieldsSchema.shape.durationMin.optional().default(null),
  bookingMode: packageFieldsSchema.shape.bookingMode.optional().default(PackageBookingMode.DIRECT),
  deliveryLabel: packageFieldsSchema.shape.deliveryLabel.optional().default(null),
  options: packageFieldsSchema.shape.options.optional().default(null),
  legalText: packageFieldsSchema.shape.legalText.optional().default(null),
  legalApprovedAt: packageFieldsSchema.shape.legalApprovedAt.optional().default(null),
  effectiveAt: packageFieldsSchema.shape.effectiveAt.optional().default(null),
  isPromo: packageFieldsSchema.shape.isPromo.optional().default(false),
  isRange: packageFieldsSchema.shape.isRange.optional().default(false),
  sortOrder: packageFieldsSchema.shape.sortOrder.optional().default(0),
}).superRefine((value, context) => {
  if (value.bookingMode === PackageBookingMode.DIRECT && value.durationMin === null) {
    context.addIssue({ code: 'custom', path: ['durationMin'], message: 'La durée est obligatoire pour une réservation directe.' });
  }
  if (value.legalApprovedAt && !value.legalText) {
    context.addIssue({ code: 'custom', path: ['legalApprovedAt'], message: 'Les mentions sont obligatoires avant approbation.' });
  }
  if (value.legalApprovedAt && value.legalApprovedAt > new Date()) {
    context.addIssue({ code: 'custom', path: ['legalApprovedAt'], message: 'La date d’approbation ne peut pas être future.' });
  }
});

export const packageDuplicateSchema = z.object({
  slug: packageSlug.optional(),
  name: requiredString.optional(),
});

export const packageUpdateSchema = packageFieldsSchema
  .omit({ legalApprovedAt: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'Au moins un champ doit être fourni.' });

export const packageValidationSchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
  mentionsApproved: z.literal(true),
});

export const dataRightsListQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  status: repeatable(z.string().trim().min(1).max(40)),
  requestType: repeatable(z.string().trim().min(1).max(40)),
  dueWithinDays: z.coerce.number().int().min(0).max(365).optional(),
  openOnly: queryBoolean.optional(),
});

export const mediaReorderSchema = z.object({
  orderedIds: z.array(z.string().trim().min(1)).min(1).max(500),
});

export const packageReorderSchema = z.object({
  orderedIds: z.array(z.string().trim().min(1)).min(1).max(200),
});

export const packageVersionCommandSchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
});

export const catalogueTaxonomyUpdateSchema = z.object({
  sortOrder: z.coerce.number().int().min(0),
  isActive: z.boolean(),
  labels: z.object({ fr: requiredString, en: requiredString }),
});
const catalogueBenefitLocaleSchema = z.object({
  locale: z.enum(['fr', 'en']), name: requiredString, advantage: requiredString,
  conditions: z.string().trim().min(10), applicationLabel: requiredString,
  mandatoryWording: z.string().trim().min(10), sourceReference: requiredString,
  approvedAt: z.coerce.date().nullable().optional(), isEnabled: z.boolean().optional(),
});
export const catalogueBenefitCreateSchema = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[A-Z0-9_]+$/),
  taxonomyKey: packageFieldsSchema.shape.taxonomyKey,
  applicationMode: z.string().trim().min(2).max(50), sortOrder: z.coerce.number().int().min(0),
  effectiveAt: z.coerce.date().nullable(), locales: z.array(catalogueBenefitLocaleSchema).length(2),
});
export const catalogueBenefitUpdateSchema = catalogueBenefitCreateSchema.omit({ code: true }).extend({ expectedVersion: z.coerce.number().int().positive() });


export const reservationRescheduleSchema = z.object({
  startAt: z.coerce.date(),
  reason: z.string().trim().min(1).max(1000),
});

export const rescheduleRequestCreateSchema = z.object({
  commandId: z.uuid(),
  expectedReservationVersion: z.number().int().positive(),
  requestedStartAt: z.coerce.date(),
  reason: z.string().trim().min(1).max(1000),
});

export const rescheduleRequestDecisionSchema = z.object({
  commandId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  decision: z.enum(['ACCEPTED', 'REJECTED']),
  ...customerCopyFields,
}).superRefine((value, context) => {
  if (value.decision === 'REJECTED' && !value.customerReasonCode) {
    context.addIssue({ code: 'custom', path: ['customerReasonCode'], message: 'Le motif client est obligatoire pour un refus.' });
  }
});

export const withdrawalRequestCreateSchema = z.object({
  commandId: z.uuid(),
  expectedReservationVersion: z.number().int().positive(),
  receivedAt: z.coerce.date(),
  requestChannel: z.enum(['EMAIL', 'WHATSAPP', 'PHONE', 'IN_PERSON', 'OTHER']),
  requestText: z.string().trim().min(1).max(4000),
  requestEvidence: z.string().trim().min(1).max(2000),
  serviceStatus: z.enum(['NOT_STARTED', 'STARTED', 'COMPLETED']),
  executionStartedAt: z.coerce.date().nullable().optional(),
}).superRefine((value, context) => {
  if (value.serviceStatus === 'NOT_STARTED' && value.executionStartedAt) {
    context.addIssue({ code: 'custom', path: ['executionStartedAt'], message: 'La date doit rester vide lorsque le service n’a pas commencé.' });
  }
  if (value.serviceStatus !== 'NOT_STARTED' && !value.executionStartedAt) {
    context.addIssue({ code: 'custom', path: ['executionStartedAt'], message: 'La date de début d’exécution est obligatoire.' });
  }
});

export const withdrawalRequestDecisionSchema = z.object({
  commandId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  decision: z.enum(['ACCEPTED', 'REJECTED']),
  internalReason: z.string().trim().min(1).max(4000),
  customerReasonCode: z.enum(CUSTOMER_REASON_CODES).optional(),
  customerReasonText: z.string().trim().max(280).optional().nullable(),
}).superRefine((value, context) => {
  if (value.decision === 'REJECTED' && !value.customerReasonCode) {
    context.addIssue({ code: 'custom', path: ['customerReasonCode'], message: 'Le motif client est obligatoire pour un refus.' });
  }
});

export const imageConsentEventCreateSchema = z.object({
  commandId: z.uuid(),
  expectedPriorEventId: z.string().trim().min(1).max(100).nullable(),
  choice: z.enum(['GRANTED', 'REFUSED', 'WITHDRAWN']),
  receivedAt: z.coerce.date(),
  requestChannel: z.enum(['EMAIL', 'WHATSAPP', 'PHONE', 'IN_PERSON', 'SIGNED_DOCUMENT', 'OTHER']),
  requestEvidence: z.string().trim().min(1).max(2000),
});

const dataRightType = z.enum([
  'ACCESS',
  'RECTIFICATION',
  'RESTRICTION',
  'OBJECTION',
  'PORTABILITY',
  'CONSENT_WITHDRAWAL',
  'ERASURE',
]);
const dataRightsStatus = z.enum([
  'RECEIVED',
  'IDENTITY_CHECK',
  'IN_REVIEW',
  'ACTION_REQUIRED',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'REFUSED',
  'CLOSED',
]);
const identityStatus = z.enum(['UNVERIFIED', 'PENDING', 'VERIFIED', 'NOT_REQUIRED']);
const retentionAction = z.enum([
  'NONE',
  'KEEP_ACTIVE',
  'RESTRICTED_ARCHIVE',
  'ANONYMIZATION_REQUIRED',
  'ERASURE_REQUIRED',
  'LEGAL_HOLD',
]);

export const dataRightsRequestCreateSchema = z.object({
  commandId: z.uuid(),
  requestType: dataRightType,
  requesterName: z.string().trim().min(2).max(200),
  requesterEmail: emailAddress.optional(),
  requesterPhone: phone.optional(),
  reservationReference: z.string().trim().min(3).max(32).transform((value) => value.toUpperCase()).optional(),
  requestChannel: z.enum(['EMAIL', 'WHATSAPP', 'PHONE', 'IN_PERSON', 'MAIL', 'OTHER']),
  requestSummary: z.string().trim().min(10).max(4000),
  identityStatus,
  identityEvidenceReference: z.string().trim().min(3).max(500).optional(),
  receivedAt: z.coerce.date(),
  targetResponseAt: z.coerce.date(),
}).superRefine((value, context) => {
  if (!value.requesterEmail && !value.requesterPhone) {
    context.addIssue({ code: 'custom', path: ['requesterEmail'], message: 'Renseignez au moins un moyen de contact.' });
  }
  if (value.targetResponseAt < value.receivedAt) {
    context.addIssue({ code: 'custom', path: ['targetResponseAt'], message: 'L’échéance interne ne peut pas précéder la demande.' });
  }
  if (value.identityStatus === 'VERIFIED' && !value.identityEvidenceReference) {
    context.addIssue({ code: 'custom', path: ['identityEvidenceReference'], message: 'Référencez la vérification sans joindre de pièce d’identité.' });
  }
});

export const dataRightsRequestUpdateSchema = z.object({
  commandId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  status: dataRightsStatus,
  identityStatus,
  identityEvidenceReference: z.string().trim().min(3).max(500).nullable().optional(),
  processingRestricted: z.boolean(),
  retentionAction,
  reason: z.string().trim().min(10).max(4000),
  responseEvidence: z.string().trim().min(3).max(2000).nullable().optional(),
  legalHoldUntil: z.coerce.date().nullable().optional(),
  effectiveAt: z.coerce.date(),
}).superRefine((value, context) => {
  if (value.identityStatus === 'VERIFIED' && !value.identityEvidenceReference) {
    context.addIssue({ code: 'custom', path: ['identityEvidenceReference'], message: 'Référencez la vérification sans joindre de pièce d’identité.' });
  }
  if (value.retentionAction === 'LEGAL_HOLD' && !value.legalHoldUntil) {
    context.addIssue({ code: 'custom', path: ['legalHoldUntil'], message: 'La fin du gel juridique doit être renseignée.' });
  }
  if (['PARTIALLY_FULFILLED', 'FULFILLED', 'REFUSED', 'CLOSED'].includes(value.status) && !value.responseEvidence) {
    context.addIssue({ code: 'custom', path: ['responseEvidence'], message: 'La preuve de réponse est obligatoire pour cet état.' });
  }
});

export const reservationDeliveryPublishSchema = z.object({
  commandId: z.uuid(),
  expectedReservationVersion: z.number().int().positive(),
  deliveryUrl: z.url().max(2000),
  accessInstruction: z.string().trim().min(1).max(1000),
  expiresAt: z.coerce.date(),
});

export const qaNotificationOverrideSchema = z.object({
  commandId: z.uuid(),
  expectedReservationVersion: z.number().int().positive(),
  expectedOverrideVersion: z.number().int().nonnegative(),
  recipientEmail: emailAddress,
  reason: z.string().trim().min(10).max(1000),
});

export const customerDecisionPreviewSchema = z.object({
  scope: z.enum(['RESERVATION_REJECTION', 'STUDIO_CANCELLATION', 'RESERVATION_EXPIRATION', 'PAYMENT_REJECTION', 'PAYMENT_INFORMATION_REQUEST', 'PAYMENT_VERIFICATION_BLOCKAGE', 'RESCHEDULE_REJECTION']),
  entityId: z.string().trim().min(1),
  internalReason: z.string().trim().min(1).max(1000),
  customerReasonCode: z.enum(CUSTOMER_REASON_CODES),
  customerReasonText: z.string().trim().max(280).optional().nullable(),
});

export const reservationCancellationSchema = z.object({
  commandId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  origin: z.enum(['CUSTOMER', 'STUDIO']),
  ...customerCopyFields,
}).superRefine((value, context) => {
  if (value.origin === 'STUDIO' && !value.customerReasonCode) {
    context.addIssue({ code: 'custom', path: ['customerReasonCode'], message: 'Le motif client est obligatoire pour une annulation Studio.' });
  }
});

export const reservationStatusUpdateSchema = z
  .object({
    status: z.enum(Object.values(ReservationStatus)).optional(),
    reason: z.string().trim().min(1).max(1000).optional().nullable(),
    internalReason: z.string().trim().min(1).max(1000).optional(),
    customerReasonCode: z.enum(CUSTOMER_REASON_CODES).optional(),
    customerReasonText: z.string().trim().max(280).optional().nullable(),
    notes: z.string().trim().optional().nullable(),
    commandId: z.uuid().optional(),
    expectedVersion: z.number().int().positive().optional(),
    temporalOverride: z.boolean().optional(),
    overrideConfirmed: z.boolean().optional(),
  })
  .refine((value) => value.status !== undefined || value.notes !== undefined, {
    message: 'Un statut ou des notes doivent être fournis.',
  })
  .superRefine((value, context) => {
    if (value.status === ReservationStatus.CANCELLED) {
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'Utilisez la commande d’annulation dédiée.',
      });
    }
    const sensitiveDecision =
      value.status === ReservationStatus.CONFIRMED || value.status === ReservationStatus.REJECTED;
    if (sensitiveDecision && !value.commandId) {
      context.addIssue({ code: 'custom', path: ['commandId'], message: 'Identifiant de commande obligatoire.' });
    }
    if (sensitiveDecision && value.expectedVersion === undefined) {
      context.addIssue({ code: 'custom', path: ['expectedVersion'], message: 'Version attendue obligatoire.' });
    }
    const adverse = value.status === ReservationStatus.REJECTED || value.status === ReservationStatus.EXPIRED;
    if (adverse && !value.internalReason) {
      context.addIssue({ code: 'custom', path: ['internalReason'], message: 'Le motif interne est obligatoire.' });
    }
    if (adverse && !value.customerReasonCode) {
      context.addIssue({ code: 'custom', path: ['customerReasonCode'], message: 'Le motif client est obligatoire.' });
    }
  });

export const leadListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().trim().min(1).max(120).optional(),
  type: repeatable(z.enum(['CONTACT', 'B2B', 'QUOTE', 'CREATIVE'])),
  // WON and LOST are deliberately absent: they are the pipeline the report does not want,
  // and nothing writes them any more.
  status: repeatable(z.enum(['NEW', 'IN_PROGRESS', 'HANDLED', 'ARCHIVED'])),
  from: businessDate.optional(),
  to: businessDate.optional(),
});

export const leadUpdateSchema = z
  .object({
    status: z.enum(['NEW', 'IN_PROGRESS', 'HANDLED', 'ARCHIVED']),
    internalNote: z.string().trim().max(4000).nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field must be provided' });

export const paymentVerificationSchema = z.object({
  commandId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  status: z.enum([
    PaymentStatus.PENDING,
    PaymentStatus.PAYMENT_INFO_REQUIRED,
    PaymentStatus.VERIFICATION_BLOCKED,
    PaymentStatus.VERIFIED,
    PaymentStatus.REJECTED,
  ]),
  transactionRef: optionalString,
  reason: z.string().trim().min(1).max(1000).optional(),
  internalReason: z.string().trim().min(1).max(1000).optional(),
  customerReasonCode: z.enum(CUSTOMER_REASON_CODES).optional(),
  customerReasonText: z.string().trim().max(280).optional().nullable(),
}).superRefine((value, context) => {
  const adverse = new Set<PaymentStatus>([PaymentStatus.REJECTED, PaymentStatus.PAYMENT_INFO_REQUIRED, PaymentStatus.VERIFICATION_BLOCKED]).has(value.status);
  if (adverse && !value.internalReason) context.addIssue({ code: 'custom', path: ['internalReason'], message: 'Le motif interne est obligatoire.' });
  if (adverse && !value.customerReasonCode) context.addIssue({ code: 'custom', path: ['customerReasonCode'], message: 'Le motif client est obligatoire.' });
});

export const paymentAddSchema = z.object({
  commandId: z.uuid(),
  expectedReservationVersion: z.number().int().positive(),
  method: z.enum(['mtn_momo', 'orange_money']),
  paymentPhone: phone,
  transactionRef: requiredString.max(32),
}).superRefine((value, context) => {
  const referenceIssue = paymentReferenceValidationMessage(value.method, value.transactionRef);
  if (referenceIssue) {
    context.addIssue({ code: 'custom', path: ['transactionRef'], message: referenceIssue });
  }
});

export const refundDecisionSchema = z.object({
  commandId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  status: z.enum([PaymentStatus.REFUND_PENDING, PaymentStatus.REFUNDED]),
  refundAmount: z.number().int().positive(),
  channel: z.string().trim().min(1).max(100),
  providerReference: z.string().trim().min(1).max(255),
  reason: z.string().trim().min(1).max(1000),
});

export const verifyAndConfirmSchema = z.object({
  commandId: z.uuid(),
  paymentId: z.string().trim().min(1),
  expectedPaymentVersion: z.number().int().positive(),
  expectedReservationVersion: z.number().int().positive(),
  transactionRef: optionalString,
  reason: z.string().trim().min(1).max(1000).optional(),
});

export const mediaUploadSchema = z.object({
  reservationReference: z.string().trim().min(1).max(40),
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
  .omit({ reservationReference: true })
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
