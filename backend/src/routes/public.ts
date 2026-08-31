import { Router } from 'express';

import { PUBLIC_MEDIA_CATEGORIES } from '../constants/media.js';

import { LeadType } from '../generated/prisma/enums.js';
import { getEffectiveSettings } from '../services/studio-settings.js';
import { getPublishedContent } from '../services/site-content.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { publicWriteProtection } from '../middleware/public-write-protection.js';
import { publicWriteRateLimiter } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import { prisma } from '../db/prisma.js';
import { getAvailability } from '../services/availability.js';
import { createLeadSubmission } from '../services/leads.js';
import { createOrRefreshReservationIntent } from '../services/reservation-intents.js';
import { createReservation } from '../services/reservations.js';
import { listPublishedPackages } from '../services/packages.js';
import { listPublicCatalogue } from '../services/catalogue.js';
import { publicMediaRightsWhere } from '../services/media-rights.js';
import {
  availabilityQuerySchema,
  b2bInquirySchema,
  contactSchema,
  creativeRequestSchema,
  quoteRequestSchema,
  reservationCreateSchema,
  reservationIntentCreateSchema,
} from '../validation/schemas.js';

const router = Router();
router.get(
  '/catalogue',
  asyncHandler(async (_req, res) => {
    res.json({ data: await listPublicCatalogue() });
  }),
);

router.get(
  '/packages',
  asyncHandler(async (_req, res) => {
    const packages = await listPublishedPackages();

    res.json({ data: packages });
  }),
);

router.get(
  '/availability',
  validate('query', availabilityQuerySchema),
  asyncHandler(async (_req, res) => {
    const availability = await getAvailability(res.locals.validated.query);
    res.json({ data: availability });
  }),
);

router.post(
  '/reservation-intents',
  publicWriteRateLimiter,
  publicWriteProtection,
  validate('body', reservationIntentCreateSchema),
  asyncHandler(async (req, res) => {
    const intent = await createOrRefreshReservationIntent(req.body);
    res.status(201).json({ data: intent });
  }),
);

router.get(
  '/media',
  asyncHandler(async (_req, res) => {
    const media = await prisma.mediaItem.findMany({
      where: {
        ...publicMediaRightsWhere,
        isPublished: true,
        category: { in: [...PUBLIC_MEDIA_CATEGORIES] },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        altText: true,
        url: true,
        thumbnailUrl: true,
        category: true,
        width: true,
        height: true,
        mimeType: true,
        fileSize: true,
        thumbnailWidth: true,
        thumbnailHeight: true,
        thumbnailFileSize: true,
        objectPosition: true,
        isFeatured: true,
        sortOrder: true,
      },
    });

    res.json({ data: media });
  }),
);

router.post(
  '/reservations',
  publicWriteRateLimiter,
  publicWriteProtection,
  validate('body', reservationCreateSchema),
  asyncHandler(async (req, res) => {
    const reservation = await createReservation(req.body);
    if (!reservation.snapshot) throw new Error('RESERVATION_SNAPSHOT_MISSING');
    const snapshot = reservation.snapshot;
    res.status(201).json({
      data: {
        id: reservation.id,
        reference: reservation.reference,
        status: reservation.status,
        startAt: reservation.startAt,
        endAt: reservation.endAt,
        scheduleKind: reservation.scheduleKind,
        requestedStartAt: reservation.requestedStartAt,
        requestedEndAt: reservation.requestedEndAt,
        requestedTimeZone: reservation.requestedTimeZone,
        scheduleConfirmedAt: reservation.scheduleConfirmedAt,
        paymentChoice: reservation.paymentChoice,
        customer: {
          ...reservation.customer,
          firstName: snapshot.firstName,
          lastName: snapshot.lastName,
          phone: snapshot.phoneE164,
          email: snapshot.email,
        },
        package: {
          ...reservation.package,
          name: snapshot.packageName,
          price: snapshot.amount,
          durationMin: snapshot.durationMin,
        },
        payments: reservation.payments,
      },
    });
  }),
);

router.post(
  '/contact',
  publicWriteRateLimiter,
  publicWriteProtection,
  validate('body', contactSchema),
  asyncHandler(async (req, res) => {
    const lead = await createLeadSubmission({
      submissionKey: req.body.submissionKey,
      type: LeadType.CONTACT,
      source: 'contact_form',
      locale: req.body.locale,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      whatsappConsent: req.body.whatsappConsent,
      subject: req.body.subject,
      message: req.body.message,
    });

    res.status(201).json({ data: lead });
  }),
);

router.post(
  '/b2b-inquiries',
  publicWriteRateLimiter,
  publicWriteProtection,
  validate('body', b2bInquirySchema),
  asyncHandler(async (req, res) => {
    const lead = await createLeadSubmission({
      submissionKey: req.body.submissionKey,
      type: LeadType.B2B,
      source: 'b2b_form',
      locale: req.body.locale,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      whatsappConsent: req.body.whatsappConsent,
      company: req.body.company,
      rccm: req.body.rccm,
      subject: req.body.subject,
      message: req.body.message,
    });

    res.status(201).json({ data: lead });
  }),
);

/**
 * §7: a creative-services request is its own kind.
 *
 * It used to post to /quote-requests, so a request for a flyer and a request for a
 * wedding shoot arrived in the same list under the same label, distinguishable only by
 * a phrase the form happened to write into the subject.
 */
router.post(
  '/creative-requests',
  publicWriteRateLimiter,
  publicWriteProtection,
  validate('body', creativeRequestSchema),
  asyncHandler(async (req, res) => {
    const lead = await createLeadSubmission({
      submissionKey: req.body.submissionKey,
      type: LeadType.CREATIVE,
      source: 'creative_form',
      locale: req.body.locale,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      whatsappConsent: req.body.whatsappConsent,
      subject: req.body.service ? `Service créatif : ${req.body.service}` : 'Service créatif',
      message: [req.body.eventDate ? `Date souhaitée : ${req.body.eventDate}` : null, req.body.message]
        .filter(Boolean)
        .join('\n\n'),
    });

    res.status(201).json({ data: lead });
  }),
);

router.post(
  '/quote-requests',
  publicWriteRateLimiter,
  publicWriteProtection,
  validate('body', quoteRequestSchema),
  asyncHandler(async (req, res) => {
    const lead = await createLeadSubmission({
      submissionKey: req.body.submissionKey,
      type: LeadType.QUOTE,
      source: 'quote_form',
      locale: req.body.locale,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      whatsappConsent: req.body.whatsappConsent,
      subject: req.body.packageName ? `Quote request: ${req.body.packageName}` : 'Quote request',
      message: [req.body.eventDate ? `Event date: ${req.body.eventDate}` : null, req.body.message]
        .filter(Boolean)
        .join('\n\n'),
    });

    res.status(201).json({ data: lead });
  }),
);

// The published projection the public site reads. Cached briefly so a settings change
// reaches visitors within a minute without every page view hitting the database.
router.get(
  '/site-settings',
  asyncHandler(async (req, res) => {
    const locale = req.query.locale === 'en' ? 'en' : 'fr';
    const [settings, content] = await Promise.all([getEffectiveSettings(), getPublishedContent(locale)]);
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ data: { settings, content } });
  }),
);

export default router;
