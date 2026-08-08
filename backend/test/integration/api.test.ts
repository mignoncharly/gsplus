import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createHmac, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { AdminRole, NotificationStatus, PaymentStatus, ReservationStatus } from '../../src/generated/prisma/client.js';
import {
  handleWhatsAppWebhook,
  isValidWhatsAppSignature,
  processNotificationEvent,
  queueReservationCreatedNotifications,
  queueReservationStatusNotification,
} from '../../src/emails/notifications.js';
import { env } from '../../src/config/env.js';
import { RATE_LIMIT_POLICIES } from '../../src/middleware/security.js';
import { MAX_MEDIA_UPLOAD_BYTES } from '../../src/middleware/media-upload.js';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_PRODUCTION,
} from '../../src/services/admin-auth.js';
import { updatePackageWithVersion } from '../../src/services/packages.js';
import { transitionReservationStatus } from '../../src/services/status-transitions.js';
import { packageCreateSchema, packageUpdateSchema } from '../../src/validation/schemas.js';

import { addBusinessDays, businessDateKey, businessLocalToInstant } from '../../src/utils/business-time.js';
const app = createApp();

const adminPassword = 'test-admin-password';

const futureDateAt = (hour = 10, minute = 0, dayOffset = 10) => {
  const date = addBusinessDays(businessDateKey(new Date()), dayOffset);
  return businessLocalToInstant(
    date,
    `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
  );
};

const resetDatabase = async () => {
  await prisma.dataRightsRequest.deleteMany();
  await prisma.dataIntegrityIncident.deleteMany();
  await prisma.calendarSyncLog.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.financialTask.deleteMany();
  await prisma.adminCommand.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.reservationIntent.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.availabilityBlock.deleteMany();
  await prisma.mediaItem.deleteMany();
  await prisma.businessHour.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.package.deleteMany();
  await prisma.adminUser.deleteMany();
};

const seedBaseData = async () => {
  const passwordHash = await bcrypt.hash(adminPassword, 4);
  const pack = await prisma.package.create({
    data: {
      slug: 'test-portrait',
      name: 'Test Portrait',
      category: 'Tests',
      price: 15000,
      durationMin: 60,
      isActive: true,
    },
  });

  await prisma.businessHour.createMany({
    data: Array.from({ length: 7 }, (_item, dayOfWeek) => ({
      dayOfWeek,
      opensAt: '09:00',
      closesAt: '18:00',
      isClosed: false,
    })),
  });

  await prisma.adminUser.create({
    data: {
      email: 'admin@goldenstudioplus.test',
      name: 'Test Admin',
      passwordHash,
      role: AdminRole.OWNER,
    },
  });

  return { pack };
};

const reservationPayload = async (packageId: string, startAt = futureDateAt()) => {
  const idempotencyKey = randomUUID();
  const intentResponse = await request(app)
    .post('/api/reservation-intents')
    .send({ packageId, startAt: startAt.toISOString(), idempotencyKey })
    .expect(201);

  return {
    intentId: intentResponse.body.data.id,
    idempotencyKey,
    expectedReference: intentResponse.body.data.reference,
    customer: {
      firstName: 'Alice',
      lastName: 'Test',
      phone: `+237699${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
      email: `alice-${Date.now()}@example.test`,
    },
    consentImage: true,
    whatsappConsent: false,
    acceptedTerms: true,
    acceptedPrivacy: true,
    paymentChoice: 'base',
    paymentMethod: 'mtn_momo',
    paymentPhone: '+237699000000',
    transactionRef: `MTN${Date.now()}${Math.floor(Math.random() * 1000)}`,
  };
};

const loginAdmin = async () => {
  const agent = request.agent(app);
  await agent
    .post('/api/admin/login')
    .send({ email: 'admin@goldenstudioplus.test', password: adminPassword })
    .expect(200);
  return agent;
};

beforeEach(async () => {
  await resetDatabase();
  await seedBaseData();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('booking flow', () => {
  it('keeps six identities and immutable evidence independent when one phone is shared', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const sharedPhone = '+237640703249';
    const sharedPhoneRaw = '+237 640 70 32 49';
    const identities = Array.from({ length: 6 }, (_item, index) => ({
      firstName: `Identite${index + 1}`,
      lastName: `Audit${index + 1}`,
      email: `identite-${index + 1}@example.test`,
    }));
    const reservationIds: string[] = [];

    for (const [index, identity] of identities.entries()) {
      const payload = await reservationPayload(pack.id, futureDateAt(9 + index, 0, 15));
      payload.customer = { ...identity, phone: index === 0 ? sharedPhoneRaw : sharedPhone };
      payload.whatsappConsent = index === 0;
      payload.transactionRef = `MTN-P0-01-${index + 1}`;
      const created = await request(app).post('/api/reservations').send(payload).expect(201);
      reservationIds.push(created.body.data.id);
    }

    const stored = await prisma.reservation.findMany({
      where: { id: { in: reservationIds } },
      orderBy: { startAt: 'asc' },
      include: { customer: true, snapshot: true },
    });
    expect(stored.map((reservation) => reservation.customer.firstName)).toEqual(
      identities.map((identity) => identity.firstName),
    );
    expect(stored.map((reservation) => reservation.snapshot?.firstName)).toEqual(
      identities.map((identity) => identity.firstName),
    );
    expect(stored.map((reservation) => reservation.snapshot?.email)).toEqual(
      identities.map((identity) => identity.email),
    );
    expect(stored.every((reservation) => reservation.snapshot?.phoneE164 === sharedPhone)).toBe(true);
    expect(stored.map((reservation) => reservation.snapshot?.whatsappConsent)).toEqual([true, false, false, false, false, false]);
    expect(stored[0].snapshot?.phoneRaw).toBe(sharedPhoneRaw);
    expect(stored[0].snapshot).toMatchObject({
      termsAccepted: true,
      termsVersion: '2026-07-31',
      privacyAccepted: true,
      privacyVersion: '2026-07-31',
      whatsappConsent: true,
      imageConsent: true,
      imageAuthorizationVersion: '2026-07-31',
      source: 'PUBLIC_BOOKING',
    });
    expect(stored[0].snapshot?.termsAcceptedAt).toBeInstanceOf(Date);
    expect(stored[0].snapshot?.privacyAcceptedAt).toBeInstanceOf(Date);
    expect(stored[0].snapshot?.whatsappConsentAt).toBeInstanceOf(Date);
    expect(stored[0].snapshot?.imageConsentAt).toBeInstanceOf(Date);

    const initialRecipients = await prisma.notificationEvent.findMany({
      where: { reservationId: { in: reservationIds }, type: 'booking_received_customer', channel: 'email' },
      select: { recipient: true },
    });
    expect(new Set(initialRecipients.map((event) => event.recipient))).toEqual(
      new Set(identities.map((identity) => identity.email)),
    );

    await expect(
      prisma.reservationSnapshot.update({
        where: { reservationId: reservationIds[0] },
        data: { firstName: 'TentativeAlteration' },
      }),
    ).rejects.toThrow(/RESERVATION_SNAPSHOT_IMMUTABLE/);
    await expect(
      prisma.reservationSnapshot.delete({ where: { reservationId: reservationIds[0] } }),
    ).rejects.toThrow(/RESERVATION_SNAPSHOT_IMMUTABLE/);

    await prisma.customer.update({
      where: { id: stored[0].customerId },
      data: { firstName: 'ProfilModifie', email: 'fuite-potentielle@example.test' },
    });

    await queueReservationStatusNotification(reservationIds[0], ReservationStatus.CONFIRMED);
    const lateNotification = await prisma.notificationEvent.findFirstOrThrow({
      where: { reservationId: reservationIds[0], type: 'booking_confirmed_customer', channel: 'email' },
    });
    expect(lateNotification.recipient).toBe(identities[0].email);

    let renderedText = '';
    await processNotificationEvent(lateNotification.id, {
      sendEmail: async (_event, message) => {
        renderedText = message.text;
        return { providerMessageId: 'p0-01-test-message', providerStatus: 'accepted' };
      },
    });
    expect(renderedText).toContain(identities[0].firstName);
    expect(renderedText).not.toContain('ProfilModifie');
    expect(renderedText).not.toContain('fuite-potentielle@example.test');
  });
});

describe('lead capture', () => {
  it('deduplicates concurrent contact submissions and queues one notification per audience', async () => {
    const submissionKey = randomUUID();
    const payload = {
      submissionKey,
      name: 'Contact Retry Test',
      email: 'contact-retry@example.test',
      message: 'Please send more information about portrait sessions.',
    };
    const [first, second] = await Promise.all([
      request(app).post('/api/contact').send(payload),
      request(app).post('/api/contact').send(payload),
    ]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.id).toBe(second.body.data.id);
    expect(await prisma.lead.count({ where: { submissionKey: `contact_form:${submissionKey}` } })).toBe(1);
    expect(await prisma.notificationEvent.count({ where: { leadId: first.body.data.id } })).toBe(2);
  });

  it('deduplicates concurrent B2B submissions and queues one notification per audience', async () => {
    const submissionKey = randomUUID();
    const payload = {
      submissionKey,
      company: 'Double Click SARL',
      name: 'B2B Retry Test',
      email: 'b2b-retry@example.test',
      phone: '+237699333333',
      message: 'We need a corporate portrait proposal for our team.',
    };

    const [first, second] = await Promise.all([
      request(app).post('/api/b2b-inquiries').send(payload),
      request(app).post('/api/b2b-inquiries').send(payload),
    ]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.id).toBe(second.body.data.id);
    expect(await prisma.lead.count({ where: { submissionKey: `b2b_form:${submissionKey}` } })).toBe(1);
    expect(await prisma.notificationEvent.count({ where: { leadId: first.body.data.id } })).toBe(2);
  });
});

describe('admin flow', () => {
  it('logs in admins and rejects unauthenticated protected routes', async () => {
    await request(app).get('/api/admin/reservations').expect(401);

    const agent = await loginAdmin();
    const response = await agent.get('/api/admin/reservations').expect(200);
    expect(response.body.data).toEqual([]);
  });

  it('verifies payment without confirming the reservation and records transition history', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app).post('/api/reservations').send(await reservationPayload(pack.id)).expect(201);
    const paymentId = created.body.data.payments[0].id;
    const initialPayment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const agent = await loginAdmin();

    const response = await agent
      .patch(`/api/admin/payments/${paymentId}/verify`)
      .send({
        status: PaymentStatus.VERIFIED,
        commandId: randomUUID(),
        expectedVersion: initialPayment.version,
        transactionRef: 'VERIFIED-TX-001',
      })
      .expect(200);

    expect(response.body.data.status).toBe(PaymentStatus.VERIFIED);
    expect(response.body.data.reservation.status).toBe(ReservationStatus.PENDING_CONFIRMATION);
    expect(response.body.data.calendarSync).toBeNull();

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { transitions: true },
    });
    expect(payment.verifiedById).not.toBeNull();
    expect(payment.transactionRefNormalized).toBe('VERIFIED-TX-001');
    expect(payment.transitions.map((transition) => transition.toStatus)).toEqual([
      PaymentStatus.PENDING,
      PaymentStatus.VERIFIED,
    ]);
  });

  it('requires a reason when rejecting a payment', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app).post('/api/reservations').send(await reservationPayload(pack.id)).expect(201);
    const paymentId = created.body.data.payments[0].id;
    const initialPayment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const agent = await loginAdmin();

    const missingReason = await agent
      .patch(`/api/admin/payments/${paymentId}/verify`)
      .send({
        status: PaymentStatus.REJECTED,
        commandId: randomUUID(),
        expectedVersion: initialPayment.version,
      })
      .expect(400);
    expect(missingReason.body.error.code).toBe('PAYMENT_REASON_REQUIRED');

    const rejected = await agent
      .patch(`/api/admin/payments/${paymentId}/verify`)
      .send({
        status: PaymentStatus.REJECTED,
        commandId: randomUUID(),
        expectedVersion: initialPayment.version,
        reason: 'Reference introuvable chez l operateur',
      })
      .expect(200);
    expect(rejected.body.data.status).toBe(PaymentStatus.REJECTED);
    expect(rejected.body.data.reservation.status).toBe(ReservationStatus.PENDING_CONFIRMATION);
  });

  it('reschedules an active reservation with immutable duration, history, audit and notification', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, futureDateAt(10, 0, 10)))
      .expect(201);
    const reservationId = created.body.data.id;
    const publicReference = created.body.data.reference;
    const previousStartAt = created.body.data.startAt;
    const newStartAt = futureDateAt(14, 30, 11);
    const agent = await loginAdmin();

    const requestResponse = await agent
      .post(`/api/admin/reservations/${reservationId}/reschedule-requests`)
      .send({
        commandId: randomUUID(),
        expectedReservationVersion: 1,
        requestedStartAt: newStartAt.toISOString(),
        reason: 'Client disponible uniquement l’après-midi',
      })
      .expect(201);
    expect(requestResponse.body.data.reservation.startAt).toBe(previousStartAt);
    expect(requestResponse.body.data.request).toMatchObject({ status: 'PENDING', version: 1 });

    const response = await agent
      .patch(`/api/admin/reschedule-requests/${requestResponse.body.data.request.id}/decision`)
      .send({
        commandId: randomUUID(),
        expectedVersion: 1,
        decision: 'ACCEPTED',
        reason: 'Disponibilité confirmée',
      })
      .expect(200);

    expect(response.body.data.reservation).toMatchObject({
      id: reservationId,
      reference: publicReference,
      status: ReservationStatus.PENDING_CONFIRMATION,
      startAt: newStartAt.toISOString(),
    });
    expect(response.body.data.calendarSync).toBeNull();
    expect(new Date(response.body.data.reservation.endAt).getTime() -
      new Date(response.body.data.reservation.startAt).getTime()).toBe(60 * 60_000);

    const stored = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      include: { transitions: { orderBy: { createdAt: 'desc' } }, notifications: true },
    });
    expect(stored.version).toBe(2);
    expect(stored.reference).toBe(publicReference);
    expect(stored.transitions[0]).toMatchObject({
      fromStatus: ReservationStatus.PENDING_CONFIRMATION,
      toStatus: ReservationStatus.PENDING_CONFIRMATION,
      reason: 'Disponibilité confirmée',
      actorType: 'ADMIN',
    });
    expect(stored.transitions[0].oldStartAt?.toISOString()).toBe(previousStartAt);
    expect(stored.transitions[0].newStartAt?.toISOString()).toBe(newStartAt.toISOString());
    expect(stored.transitions[0].metadata).toMatchObject({ kind: 'RESCHEDULE' });
    expect(stored.notifications.map((event) => event.templateCode)).toEqual(expect.arrayContaining([
      'E-01', 'E-08', 'E-09', 'I-01', 'I-04',
    ]));

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'reservation.reschedule_request.accept', entityId: requestResponse.body.data.request.id },
    });
    expect(audit.metadata).toMatchObject({ reason: 'Disponibilité confirmée', decision: 'ACCEPTED' });
  });

  it('rejects a reschedule collision without changing the original schedule', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const first = await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, futureDateAt(10, 0, 13)))
      .expect(201);
    const occupiedStart = futureDateAt(12, 0, 13);
    await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, occupiedStart))
      .expect(201);
    const agent = await loginAdmin();

    const pending = await agent
      .post(`/api/admin/reservations/${first.body.data.id}/reschedule-requests`)
      .send({
        commandId: randomUUID(),
        expectedReservationVersion: 1,
        requestedStartAt: occupiedStart.toISOString(),
        reason: 'Tentative de collision',
      })
      .expect(201);
    const response = await agent
      .patch(`/api/admin/reschedule-requests/${pending.body.data.request.id}/decision`)
      .send({
        commandId: randomUUID(),
        expectedVersion: 1,
        decision: 'ACCEPTED',
        reason: 'Tentative de validation',
      })
      .expect(409);

    expect(response.body.error.code).toBe('SLOT_ALREADY_RESERVED');
    const unchanged = await prisma.reservation.findUniqueOrThrow({ where: { id: first.body.data.id } });
    expect(unchanged.startAt.toISOString()).toBe(first.body.data.startAt);
    expect(unchanged.version).toBe(1);
  });

  it('rejects rescheduling a terminal reservation', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app).post('/api/reservations').send(await reservationPayload(pack.id)).expect(201);
    await prisma.reservation.update({
      where: { id: created.body.data.id },
      data: { status: ReservationStatus.COMPLETED },
    });
    const agent = await loginAdmin();

    const response = await agent
      .post(`/api/admin/reservations/${created.body.data.id}/reschedule-requests`)
      .send({
        commandId: randomUUID(),
        expectedReservationVersion: 1,
        requestedStartAt: futureDateAt(15, 0, 12).toISOString(),
        reason: 'Ne doit pas être accepté',
      })
      .expect(409);
    expect(response.body.error.code).toBe('RESERVATION_NOT_RESCHEDULABLE');
  });

  it('rejects an invalid reservation state transition', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app).post('/api/reservations').send(await reservationPayload(pack.id)).expect(201);
    const agent = await loginAdmin();

    const response = await agent
      .patch(`/api/admin/reservations/${created.body.data.id}`)
      .send({ status: ReservationStatus.COMPLETED })
      .expect(409);

    expect(response.body.error.code).toBe('INVALID_RESERVATION_TRANSITION');
  });

  it('creates a new tariff version without changing the reservation snapshot', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app).post('/api/reservations').send(await reservationPayload(pack.id)).expect(201);
    const original = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.body.data.id },
      include: { packageVersion: true },
    });
    const agent = await loginAdmin();

    const response = await agent
      .patch(`/api/admin/packages/${pack.id}`)
      .send({
        price: 17000,
        content: 'Nouveau contenu publié pour cette formule.',
        inclusions: ['Séance', 'Retouches'],
        conditions: 'Nouvelles conditions applicables à cette version.',
        legalText: 'Nouvelles mentions tarifaires obligatoires.',
        effectiveAt: new Date(Date.now() - 60_000).toISOString(),
      })
      .expect(200);
    expect(response.body.data.version).toBe(2);
    expect(response.body.data.price).toBe(17000);

    await agent
      .post(`/api/admin/packages/${pack.id}/validate`)
      .send({ expectedVersion: 2, mentionsApproved: true })
      .expect(200);
    await agent
      .post(`/api/admin/packages/${pack.id}/publish`)
      .send({ expectedVersion: 2 })
      .expect(200);

    const versions = await prisma.packageVersion.findMany({
      where: { packageId: pack.id },
      orderBy: { version: 'asc' },
    });
    const unchangedReservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.body.data.id },
      include: { packageVersion: true, snapshot: true },
    });

    expect(versions.map((version) => version.price)).toEqual([15000, 17000]);
    expect(unchangedReservation.packageVersionId).toBe(original.packageVersionId);
    expect(unchangedReservation.packageVersion.price).toBe(15000);
    expect(unchangedReservation.snapshot).toMatchObject({
      amount: 15000,
      packageContent: 'Test Portrait',
      packageConditions: 'Test Portrait',
    });
  });



  it('creates tariffs as drafts and refuses publication without approved mandatory mentions', async () => {
    const agent = await loginAdmin();
    const created = await agent
      .post('/api/admin/packages')
      .send({
        slug: 'p1-04-brouillon',
        name: 'Formule P1-04',
        category: 'Tests',
        price: 32000,
        currency: 'XAF',
        durationMin: 90,
        content: 'Séance photo complète avec préparation.',
        inclusions: ['Prise de vue', 'Retouches'],
        conditions: 'Réservation soumise aux conditions publiées.',
        legalText: 'Mentions tarifaires obligatoires à valider.',
        effectiveAt: new Date(Date.now() - 60_000).toISOString(),
      })
      .expect(201);

    expect(created.body.data.publicationStatus).toBe('DRAFT');
    expect(created.body.data.isActive).toBe(false);

    const rejected = await agent
      .post(`/api/admin/packages/${created.body.data.id}/publish`)
      .send({ expectedVersion: 1 })
      .expect(409);
    expect(rejected.body.error.code).toBe('PACKAGE_NOT_VALIDATED');
  });

  it('validates, publishes and audits a complete tariff version', async () => {
    const agent = await loginAdmin();
    const effectiveAt = new Date(Date.now() - 60_000).toISOString();
    const created = await agent
      .post('/api/admin/packages')
      .send({
        slug: 'p1-04-publication',
        name: 'Formule publication',
        category: 'Tests',
        price: 45000,
        currency: 'XAF',
        durationMin: 120,
        content: 'Séance éditoriale avec accompagnement.',
        inclusions: ['Direction artistique', 'Dix fichiers retouchés'],
        conditions: 'Acompte requis et report selon les CGV.',
        legalText: 'Prix TTC, modalités de paiement et conditions de report.',
        effectiveAt,
      })
      .expect(201);

    const validated = await agent
      .post(`/api/admin/packages/${created.body.data.id}/validate`)
      .send({ expectedVersion: 1, mentionsApproved: true })
      .expect(200);
    expect(validated.body.data.publicationStatus).toBe('VALIDATED');

    const published = await agent
      .post(`/api/admin/packages/${created.body.data.id}/publish`)
      .send({ expectedVersion: 1 })
      .expect(200);
    expect(published.body.data).toMatchObject({
      publicationStatus: 'PUBLISHED',
      isActive: true,
      publishedVersion: 1,
      content: 'Séance éditoriale avec accompagnement.',
    });
    expect(published.body.data.publishedAt).toBeTruthy();
    expect(published.body.data.publishedBy).toMatchObject({ name: 'Test Admin' });

    const publicPackages = await request(app).get('/api/packages').expect(200);
    expect(publicPackages.body.data.some((pack: { id: string }) => pack.id === created.body.data.id)).toBe(true);

    const audits = await prisma.auditLog.findMany({
      where: { entityId: created.body.data.id, action: { in: ['package.validate', 'package.publish'] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(audits.map((audit) => audit.action)).toEqual(['package.validate', 'package.publish']);
  });

  it('manages the complete package lifecycle and protects referenced packages', async () => {
    const agent = await loginAdmin();

    const created = await agent
      .post('/api/admin/packages')
      .send({
        slug: 'phase-3-formule',
        name: 'Formule Phase 3',
        category: 'Tests',
        price: 25000,
        durationMin: 90,
        sortOrder: 4,
      })
      .expect(201);
    expect(created.body.data.version).toBe(1);

    const duplicated = await agent.post(`/api/admin/packages/${created.body.data.id}/duplicate`).send({}).expect(201);
    expect(duplicated.body.data.isActive).toBe(false);
    expect(duplicated.body.data.version).toBe(1);

    const updated = await agent
      .patch(`/api/admin/packages/${created.body.data.id}`)
      .send({ price: 27000, legalText: 'Texte de test', sortOrder: 2 })
      .expect(200);
    expect(updated.body.data.version).toBe(1);
    expect(updated.body.data.publicationStatus).toBe('DRAFT');
    expect(updated.body.data.legalText).toBe('Texte de test');

    await agent.delete(`/api/admin/packages/${duplicated.body.data.id}`).expect(204);

    const source = await prisma.package.findFirstOrThrow({ where: { slug: 'test-portrait' } });
    const reservation = await reservationPayload(source.id, futureDateAt(14));
    await request(app).post('/api/reservations').send(reservation).expect(201);

    const protectedDelete = await agent.delete(`/api/admin/packages/${source.id}`).expect(409);
    expect(protectedDelete.body.error.code).toBe('PACKAGE_IN_USE');

    const publishedSource = await prisma.package.findUniqueOrThrow({ where: { id: source.id } });
    const archived = await agent
      .post(`/api/admin/packages/${source.id}/archive`)
      .send({ expectedVersion: publishedSource.publishedVersion })
      .expect(200);
    expect(archived.body.data.isActive).toBe(false);
    expect(archived.body.data.isArchived).toBe(true);
  });

  it('returns actor, old state, new state and reason in reservation history', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app).post('/api/reservations').send(await reservationPayload(pack.id)).expect(201);
    const agent = await loginAdmin();

    const stored = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.body.data.id },
      include: { payments: true },
    });
    const confirmed = await agent
      .post(`/api/admin/reservations/${stored.id}/verify-and-confirm`)
      .send({
        commandId: randomUUID(),
        paymentId: stored.payments[0].id,
        expectedPaymentVersion: stored.payments[0].version,
        expectedReservationVersion: stored.version,
        transactionRef: 'HISTORY-P0-04-001',
      })
      .expect(200);
    await agent
      .post(`/api/admin/reservations/${created.body.data.id}/cancel`)
      .send({
        commandId: randomUUID(),
        expectedVersion: confirmed.body.data.reservation.version,
        origin: 'CUSTOMER',
        reason: 'Demande confirmée par téléphone',
      })
      .expect(200);

    const detail = await agent.get(`/api/admin/reservations/${created.body.data.id}`).expect(200);
    expect(detail.body.data.transitions.length).toBeGreaterThanOrEqual(3);
    const latest = detail.body.data.transitions[0];
    expect(latest).toMatchObject({
      fromStatus: ReservationStatus.CONFIRMED,
      toStatus: ReservationStatus.CANCELLED,
      reason: 'Demande confirmée par téléphone',
      actorType: 'ADMIN',
    });
    expect(latest.adminUser.name).toBe('Test Admin');
  });

  it('rejects an invalid admin payment reference without changing payment state', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app).post('/api/reservations').send(await reservationPayload(pack.id)).expect(201);
    const paymentId = created.body.data.payments[0].id;
    const initialPayment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const agent = await loginAdmin();

    const response = await agent
      .patch(`/api/admin/payments/${paymentId}/verify`)
      .send({
        status: PaymentStatus.VERIFIED,
        commandId: randomUUID(),
        expectedVersion: initialPayment.version,
        transactionRef: 'lalala',
      })
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_PAYMENT_REFERENCE');
    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(stored.status).toBe(PaymentStatus.PENDING);
  });
  it('applies availability block create, edit and delete immediately to public slots', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const date = addBusinessDays(businessDateKey(new Date()), 12);
    const agent = await loginAdmin();
    const slotAt = async (time: string) => {
      const response = await request(app)
        .get('/api/availability')
        .query({ from: date, to: date, packageId: pack.id })
        .expect(200);
      return response.body.data.days[0].slots.find((slot: { time: string }) => slot.time === time);
    };

    expect((await slotAt('11:00')).available).toBe(true);

    const created = await agent
      .post('/api/admin/availability-blocks')
      .send({
        startAt: businessLocalToInstant(date, '11:00').toISOString(),
        endAt: businessLocalToInstant(date, '12:00').toISOString(),
        reason: 'Maintenance',
      })
      .expect(201);
    expect(await slotAt('11:00')).toMatchObject({ available: false, reason: 'availability_block' });

    await agent
      .patch(`/api/admin/availability-blocks/${created.body.data.id}`)
      .send({
        startAt: businessLocalToInstant(date, '13:00').toISOString(),
        endAt: businessLocalToInstant(date, '14:00').toISOString(),
        reason: 'Pause',
      })
      .expect(200);
    expect((await slotAt('11:00')).available).toBe(true);
    expect(await slotAt('13:00')).toMatchObject({ available: false, reason: 'availability_block' });

    await agent.delete(`/api/admin/availability-blocks/${created.body.data.id}`).expect(204);
    expect((await slotAt('13:00')).available).toBe(true);
  });
});

describe('phase 4 notification outbox', () => {
  it('queues booking notifications idempotently and atomically delivers at most once', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app).post('/api/reservations').send(await reservationPayload(pack.id)).expect(201);

    await Promise.all([
      queueReservationCreatedNotifications(created.body.data.id),
      queueReservationCreatedNotifications(created.body.data.id),
    ]);
    expect(await prisma.notificationEvent.count({ where: { reservationId: created.body.data.id } })).toBe(3);

    const event = await prisma.notificationEvent.findFirstOrThrow({
      where: { reservationId: created.body.data.id, type: 'booking_received_customer' },
    });
    const sendEmail = vi.fn(async () => ({ providerMessageId: 'provider-message-1', providerStatus: 'accepted' }));
    const results = await Promise.all([
      processNotificationEvent(event.id, { sendEmail }),
      processNotificationEvent(event.id, { sendEmail }),
    ]);

    expect(results.sort()).toEqual(['sent', 'skipped']);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const delivered = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(delivered.status).toBe(NotificationStatus.SENT);
    expect(delivered.attemptCount).toBe(1);
    expect(delivered.providerMessageId).toBe('provider-message-1');
  });

  it('schedules exponential retry with a privacy-safe error and later succeeds', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app).post('/api/reservations').send(await reservationPayload(pack.id)).expect(201);
    const event = await prisma.notificationEvent.findFirstOrThrow({
      where: { reservationId: created.body.data.id, type: 'booking_received_customer' },
    });
    const firstAttemptAt = new Date('2030-01-01T00:00:00.000Z');

    await expect(
      processNotificationEvent(event.id, {
        now: () => firstAttemptAt,
        sendEmail: async () => {
          throw new Error('SMTP password secret-provider-detail');
        },
      }),
    ).resolves.toBe('retry_scheduled');

    const scheduled = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(scheduled.status).toBe(NotificationStatus.PENDING);
    expect(scheduled.error).toBe('EMAIL_DELIVERY_FAILED');
    expect(scheduled.error).not.toContain('secret-provider-detail');
    expect(scheduled.nextAttemptAt?.toISOString()).toBe('2030-01-01T00:01:00.000Z');

    const sendEmail = vi.fn(async () => ({ providerMessageId: 'provider-message-2', providerStatus: 'accepted' }));
    await expect(
      processNotificationEvent(event.id, {
        now: () => new Date('2030-01-01T00:01:00.000Z'),
        sendEmail,
      }),
    ).resolves.toBe('sent');
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('stores explicit WhatsApp consent and normalizes local Cameroon numbers', async () => {
    await request(app)
      .post('/api/contact')
      .send({
        submissionKey: randomUUID(),
        name: 'Consent Test',
        email: 'consent@example.test',
        phone: '699 111 111',
        whatsappConsent: true,
        message: 'Please contact me about a portrait session.',
      })
      .expect(201);

    const lead = await prisma.lead.findFirstOrThrow({ where: { email: 'consent@example.test' } });
    expect(lead.phone).toBe('+237699111111');
    expect(lead.whatsappConsentAt).toBeInstanceOf(Date);
  });
});


describe('P0-04 payment and reservation decisions', () => {
  const createReservationForDecision = async (startAt = futureDateAt()) => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, startAt))
      .expect(201);
    const stored = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.body.data.id },
      include: { payments: true },
    });
    return {
      reservation: stored,
      payment: stored.payments[0],
    };
  };

  it('P0-04 blocks direct confirmation while payment is pending', async () => {
    const { reservation, payment } = await createReservationForDecision();
    const agent = await loginAdmin();

    const response = await agent
      .patch(`/api/admin/reservations/${reservation.id}`)
      .send({
        status: ReservationStatus.CONFIRMED,
        commandId: randomUUID(),
        expectedVersion: reservation.version,
      })
      .expect(409);

    expect(response.body.error.code).toBe('PAYMENT_NOT_VERIFIED');
    const storedReservation = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    const storedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(storedReservation.status).toBe(ReservationStatus.PENDING_CONFIRMATION);
    expect(storedPayment.status).toBe(PaymentStatus.PENDING);
  });

  it('P0-04 verifies payment without confirmation and replays one command idempotently', async () => {
    const { reservation, payment } = await createReservationForDecision();
    const agent = await loginAdmin();
    const commandId = randomUUID();
    const body = {
      status: PaymentStatus.VERIFIED,
      commandId,
      expectedVersion: payment.version,
      transactionRef: 'VERIFIED-P0-04-001',
    };

    const first = await agent.patch(`/api/admin/payments/${payment.id}/verify`).send(body).expect(200);
    const replay = await agent.patch(`/api/admin/payments/${payment.id}/verify`).send(body).expect(200);

    expect(first.body.data).toMatchObject({ commandId, replayed: false, status: PaymentStatus.VERIFIED });
    expect(replay.body.data).toMatchObject({ commandId, replayed: true, status: PaymentStatus.VERIFIED });
    expect(first.body.data.reservation.status).toBe(ReservationStatus.PENDING_CONFIRMATION);
    expect(replay.body.data.reservation.status).toBe(ReservationStatus.PENDING_CONFIRMATION);
    expect(
      await prisma.paymentTransition.count({ where: { paymentId: payment.id, toStatus: PaymentStatus.VERIFIED } }),
    ).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'payment.verify', entityId: payment.id } })).toBe(1);
  });

  it('P0-04 verifies and confirms atomically without a separate payment-only notification', async () => {
    const { reservation, payment } = await createReservationForDecision();
    const agent = await loginAdmin();
    const commandId = randomUUID();

    const response = await agent
      .post(`/api/admin/reservations/${reservation.id}/verify-and-confirm`)
      .send({
        commandId,
        paymentId: payment.id,
        expectedPaymentVersion: payment.version,
        expectedReservationVersion: reservation.version,
        transactionRef: 'COMBINED-P0-04-001',
      })
      .expect(200);

    expect(response.body.data).toMatchObject({ commandId, replayed: false });
    expect(response.body.data.payment.status).toBe(PaymentStatus.VERIFIED);
    expect(response.body.data.reservation.status).toBe(ReservationStatus.CONFIRMED);
    expect(
      await prisma.notificationEvent.count({
        where: { reservationId: reservation.id, type: 'payment_verified_customer' },
      }),
    ).toBe(0);
    expect(
      await prisma.notificationEvent.count({
        where: { reservationId: reservation.id, type: 'booking_confirmed_customer' },
      }),
    ).toBe(1);
  });

  it('P0-04 supports information-required and verification-blocked as distinct reasoned states', async () => {
    const first = await createReservationForDecision();
    const second = await createReservationForDecision(futureDateAt(12, 0, 11));
    const agent = await loginAdmin();

    const missingReason = await agent
      .patch(`/api/admin/payments/${first.payment.id}/verify`)
      .send({
        status: 'PAYMENT_INFO_REQUIRED',
        commandId: randomUUID(),
        expectedVersion: first.payment.version,
      })
      .expect(400);
    expect(missingReason.body.error.code).toBe('PAYMENT_REASON_REQUIRED');

    const information = await agent
      .patch(`/api/admin/payments/${first.payment.id}/verify`)
      .send({
        status: 'PAYMENT_INFO_REQUIRED',
        commandId: randomUUID(),
        expectedVersion: first.payment.version,
        reason: 'Référence opérateur incomplète',
      })
      .expect(200);
    expect(information.body.data.status).toBe('PAYMENT_INFO_REQUIRED');

    const blocked = await agent
      .patch(`/api/admin/payments/${second.payment.id}/verify`)
      .send({
        status: 'VERIFICATION_BLOCKED',
        commandId: randomUUID(),
        expectedVersion: second.payment.version,
        reason: 'Service opérateur temporairement indisponible',
      })
      .expect(200);
    expect(blocked.body.data.status).toBe('VERIFICATION_BLOCKED');
  });

  it('P0-04 rolls back payment verification when combined confirmation conflicts', async () => {
    const { reservation, payment } = await createReservationForDecision();
    const agent = await loginAdmin();

    const response = await agent
      .post(`/api/admin/reservations/${reservation.id}/verify-and-confirm`)
      .send({
        commandId: randomUUID(),
        paymentId: payment.id,
        expectedPaymentVersion: payment.version,
        expectedReservationVersion: reservation.version + 1,
        transactionRef: 'ROLLBACK-P0-04-001',
      })
      .expect(409);
    expect(response.body.error.code).toBe('RESERVATION_VERSION_CONFLICT');

    const storedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const storedReservation = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(storedPayment.status).toBe(PaymentStatus.PENDING);
    expect(storedReservation.status).toBe(ReservationStatus.PENDING_CONFIRMATION);
    expect(
      await prisma.paymentTransition.count({ where: { paymentId: payment.id, toStatus: PaymentStatus.VERIFIED } }),
    ).toBe(0);
  });

  it('P0-04 permits only one of two concurrent decisions for the same expected payment version', async () => {
    const { payment } = await createReservationForDecision();
    const agent = await loginAdmin();
    const makeRequest = (commandId: string) =>
      agent.patch(`/api/admin/payments/${payment.id}/verify`).send({
        status: PaymentStatus.VERIFIED,
        commandId,
        expectedVersion: payment.version,
        transactionRef: 'CONCURRENT-P0-04-001',
      });

    const responses = await Promise.all([makeRequest(randomUUID()), makeRequest(randomUUID())]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(
      await prisma.paymentTransition.count({ where: { paymentId: payment.id, toStatus: PaymentStatus.VERIFIED } }),
    ).toBe(1);
  });


  it('P0-04 accepts PAID as an authorized payment without changing its state', async () => {
    const { reservation, payment } = await createReservationForDecision();
    await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.PAID } });
    const agent = await loginAdmin();

    const response = await agent
      .patch(`/api/admin/reservations/${reservation.id}`)
      .send({
        status: ReservationStatus.CONFIRMED,
        commandId: randomUUID(),
        expectedVersion: reservation.version,
      })
      .expect(200);

    expect(response.body.data.status).toBe(ReservationStatus.CONFIRMED);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(PaymentStatus.PAID);
  });

  it('P0-04 requires a reason for refusal and audits the correlated decision', async () => {
    const { reservation } = await createReservationForDecision();
    const agent = await loginAdmin();

    const missingReason = await agent
      .patch(`/api/admin/reservations/${reservation.id}`)
      .send({
        status: ReservationStatus.REJECTED,
        commandId: randomUUID(),
        expectedVersion: reservation.version,
      })
      .expect(400);
    expect(missingReason.body.error.code).toBe('RESERVATION_REASON_REQUIRED');

    const commandId = randomUUID();
    const reason = 'Créneau refusé après contrôle administratif';
    const rejected = await agent
      .patch(`/api/admin/reservations/${reservation.id}`)
      .send({
        status: ReservationStatus.REJECTED,
        reason,
        commandId,
        expectedVersion: reservation.version,
      })
      .expect(200);
    expect(rejected.body.data).toMatchObject({
      status: ReservationStatus.REJECTED,
      commandId,
      replayed: false,
    });

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'reservation.reject', entityId: reservation.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.metadata).toMatchObject({
      commandId,
      oldReservationStatus: ReservationStatus.PENDING_CONFIRMATION,
      newReservationStatus: ReservationStatus.REJECTED,
      reason,
      result: 'SUCCESS',
    });
  });
  it('P0-04 rejects every sensitive decision from a staff session', async () => {
    const { reservation, payment } = await createReservationForDecision();
    const passwordHash = await bcrypt.hash('staff-password', 4);
    await prisma.adminUser.create({
      data: {
        email: 'staff@goldenstudioplus.test',
        name: 'Test Staff',
        passwordHash,
        role: AdminRole.STAFF,
      },
    });
    const staff = request.agent(app);
    await staff
      .post('/api/admin/login')
      .send({ email: 'staff@goldenstudioplus.test', password: 'staff-password' })
      .expect(200);

    const paymentResponse = await staff
      .patch(`/api/admin/payments/${payment.id}/verify`)
      .send({
        status: PaymentStatus.VERIFIED,
        commandId: randomUUID(),
        expectedVersion: payment.version,
        transactionRef: 'STAFF-P0-04-001',
      })
      .expect(403);
    const confirmResponse = await staff
      .patch(`/api/admin/reservations/${reservation.id}`)
      .send({
        status: ReservationStatus.CONFIRMED,
        commandId: randomUUID(),
        expectedVersion: reservation.version,
      })
      .expect(403);
    const rejectResponse = await staff
      .patch(`/api/admin/reservations/${reservation.id}`)
      .send({
        status: ReservationStatus.REJECTED,
        reason: 'Décision réservée au propriétaire',
        commandId: randomUUID(),
        expectedVersion: reservation.version,
      })
      .expect(403);
    const combinedResponse = await staff
      .post(`/api/admin/reservations/${reservation.id}/verify-and-confirm`)
      .send({
        commandId: randomUUID(),
        paymentId: payment.id,
        expectedPaymentVersion: payment.version,
        expectedReservationVersion: reservation.version,
        transactionRef: 'STAFF-P0-04-002',
      })
      .expect(403);
    const addPaymentResponse = await staff
      .post(`/api/admin/reservations/${reservation.id}/payments`)
      .send({
        commandId: randomUUID(),
        expectedReservationVersion: reservation.version,
        method: 'mtn_momo',
        paymentPhone: '+237699000002',
        transactionRef: 'STAFF-PAYMENT-ADD-003',
      })
      .expect(403);

    for (const response of [paymentResponse, confirmResponse, rejectResponse, combinedResponse, addPaymentResponse]) {
      expect(response.body.error.code).toBe('ADMIN_PERMISSION_REQUIRED');
    }
  });

  it('P0-04 delays E-03, cancels it on confirmation, and queues E-05 once', async () => {
    const { reservation, payment } = await createReservationForDecision();
    const agent = await loginAdmin();
    const verifyCommandId = randomUUID();
    const beforeVerification = Date.now();

    await agent
      .patch(`/api/admin/payments/${payment.id}/verify`)
      .send({
        status: PaymentStatus.VERIFIED,
        commandId: verifyCommandId,
        expectedVersion: payment.version,
        transactionRef: 'DELAYED-P0-04-001',
      })
      .expect(200);

    const paymentNotice = await prisma.notificationEvent.findFirstOrThrow({
      where: { reservationId: reservation.id, type: 'payment_verified_customer', channel: 'email' },
    });
    expect(paymentNotice.status).toBe(NotificationStatus.PENDING);
    expect(paymentNotice.nextAttemptAt?.getTime()).toBeGreaterThanOrEqual(beforeVerification + 299_000);
    expect(paymentNotice.nextAttemptAt?.getTime()).toBeLessThanOrEqual(Date.now() + 301_000);
    expect(paymentNotice.metadata).toMatchObject({ templateCode: 'E-03', commandId: verifyCommandId });

    const sendEmail = vi.fn(async () => ({ providerMessageId: 'too-early', providerStatus: 'accepted' }));
    await expect(
      processNotificationEvent(paymentNotice.id, {
        now: () => new Date(paymentNotice.nextAttemptAt!.getTime() - 1),
        sendEmail,
      }),
    ).resolves.toBe('skipped');
    expect(sendEmail).not.toHaveBeenCalled();

    const confirmCommandId = randomUUID();
    const confirmBody = {
      status: ReservationStatus.CONFIRMED,
      commandId: confirmCommandId,
      expectedVersion: reservation.version,
    };
    await agent.patch(`/api/admin/reservations/${reservation.id}`).send(confirmBody).expect(200);
    const replay = await agent.patch(`/api/admin/reservations/${reservation.id}`).send(confirmBody).expect(200);
    expect(replay.body.data).toMatchObject({ commandId: confirmCommandId, replayed: true });

    const cancelledNotice = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: paymentNotice.id } });
    expect(cancelledNotice).toMatchObject({
      status: NotificationStatus.CANCELLED,
      providerStatus: 'cancelled_by_confirmation',
      resolution: 'OBSOLETE',
    });
    expect(cancelledNotice.nextAttemptAt).toBeNull();
    expect(
      await prisma.notificationEvent.count({
        where: { reservationId: reservation.id, type: 'booking_confirmed_customer', channel: 'email' },
      }),
    ).toBe(1);
  });

  it('NOTIF-01 exposes an owner-only, idempotent refund workflow with proved notifications', async () => {
    const { reservation, payment } = await createReservationForDecision();
    const agent = await loginAdmin();
    const verified = await agent
      .patch(`/api/admin/payments/${payment.id}/verify`)
      .send({
        status: PaymentStatus.VERIFIED,
        commandId: randomUUID(),
        expectedVersion: payment.version,
        transactionRef: 'REFUND-API-VERIFY-001',
      })
      .expect(200);
    await agent
      .patch(`/api/admin/reservations/${reservation.id}`)
      .send({
        status: ReservationStatus.REJECTED,
        reason: 'Créneau retiré après vérification du paiement',
        commandId: randomUUID(),
        expectedVersion: reservation.version,
      })
      .expect(200);

    const engageCommandId = randomUUID();
    const engageBody = {
      commandId: engageCommandId,
      expectedVersion: verified.body.data.version,
      status: PaymentStatus.REFUND_PENDING,
      refundAmount: payment.amount,
      channel: 'MTN Mobile Money',
      providerReference: 'API-REFUND-ENGAGED-7294',
      reason: 'Remboursement intégral engagé',
    };
    const engaged = await agent
      .patch(`/api/admin/payments/${payment.id}/refund`)
      .send(engageBody)
      .expect(200);
    expect(engaged.body.data).toMatchObject({
      status: PaymentStatus.REFUND_PENDING,
      commandId: engageCommandId,
      replayed: false,
      financialTask: { status: 'IN_PROGRESS' },
    });
    const replay = await agent
      .patch(`/api/admin/payments/${payment.id}/refund`)
      .send(engageBody)
      .expect(200);
    expect(replay.body.data).toMatchObject({ commandId: engageCommandId, replayed: true });

    const completed = await agent
      .patch(`/api/admin/payments/${payment.id}/refund`)
      .send({
        commandId: randomUUID(),
        expectedVersion: engaged.body.data.version,
        status: PaymentStatus.REFUNDED,
        refundAmount: payment.amount,
        channel: 'MTN Mobile Money',
        providerReference: 'API-REFUND-FINAL-7294',
        reason: 'Preuve opérateur confirmée',
      })
      .expect(200);
    expect(completed.body.data).toMatchObject({
      status: PaymentStatus.REFUNDED,
      replayed: false,
      financialTask: {
        status: 'COMPLETED',
        providerReference: 'API-REFUND-FINAL-7294',
      },
    });
    expect(
      await prisma.notificationEvent.count({
        where: { reservationId: reservation.id, templateCode: { in: ['E-07', 'I-06', 'E-20', 'E-21'] } },
      }),
    ).toBe(4);
  });

  it('NOTIF-01 adds one late payment idempotently and keeps I-01/I-02 triggers exclusive', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const initialPayload = await reservationPayload(pack.id);
    const {
      paymentMethod: _paymentMethod,
      paymentPhone: _paymentPhone,
      transactionRef: _transactionRef,
      ...quotePayload
    } = initialPayload;
    quotePayload.paymentChoice = 'quote';
    const created = await request(app).post('/api/reservations').send(quotePayload).expect(201);
    expect(created.body.data.payments).toEqual([]);
    expect(await prisma.notificationEvent.count({
      where: { reservationId: created.body.data.id, templateCode: { in: ['E-02', 'I-02'] } },
    })).toBe(0);

    const agent = await loginAdmin();
    const commandId = randomUUID();
    const body = {
      commandId,
      expectedReservationVersion: 1,
      method: 'mtn_momo',
      paymentPhone: '+237699000001',
      transactionRef: 'LATE-PAYMENT-NOTIF-001',
    };
    const added = await agent
      .post(`/api/admin/reservations/${created.body.data.id}/payments`)
      .send(body)
      .expect(201);
    expect(added.body.data).toMatchObject({
      commandId,
      replayed: false,
      payment: {
        amount: 15000,
        method: 'mtn_momo',
        status: PaymentStatus.PENDING,
      },
      reservation: { version: 2 },
    });
    const replay = await agent
      .post(`/api/admin/reservations/${created.body.data.id}/payments`)
      .send(body)
      .expect(200);
    expect(replay.body.data).toMatchObject({ commandId, replayed: true });

    const duplicate = await agent
      .post(`/api/admin/reservations/${created.body.data.id}/payments`)
      .send({
        ...body,
        commandId: randomUUID(),
        expectedReservationVersion: 2,
        transactionRef: 'LATE-PAYMENT-NOTIF-002',
      })
      .expect(409);
    expect(duplicate.body.error.code).toBe('ACTIVE_PAYMENT_EXISTS');

    const codes = await prisma.notificationEvent.findMany({
      where: { reservationId: created.body.data.id, templateCode: { in: ['E-01', 'E-02', 'I-01', 'I-02'] } },
      select: { templateCode: true },
    });
    expect(codes.map((event) => event.templateCode).sort()).toEqual(['E-01', 'E-02', 'I-01', 'I-02']);
    expect(await prisma.payment.count({ where: { reservationId: created.body.data.id } })).toBe(1);
  });
});

describe('phase 4 package legal integrity', () => {
  it('rejects approval without legal text and future approval dates', () => {
    const base = {
      slug: 'legal-test',
      name: 'Legal Test',
      category: 'Tests',
      price: 10000,
      durationMin: 60,
    };
    expect(packageCreateSchema.safeParse({ ...base, legalApprovedAt: new Date() }).success).toBe(false);
    expect(
      packageUpdateSchema.safeParse({
        legalText: 'Conditions contractuelles valides.',
        legalApprovedAt: new Date(Date.now() + 86_400_000),
      }).success,
    ).toBe(false);
  });

  it('clears a previous legal approval whenever the approved text changes', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const admin = await prisma.adminUser.findFirstOrThrow();
    await prisma.package.update({
      where: { id: pack.id },
      data: { legalText: 'Anciennes conditions contractuelles.', legalApprovedAt: new Date('2026-01-01T00:00:00.000Z') },
    });

    const updated = await updatePackageWithVersion(
      pack.id,
      { legalText: 'Nouvelles conditions contractuelles à approuver.' },
      admin.id,
    );
    expect(updated.legalApprovedAt).toBeNull();
  });
});

describe('phase 4 notification administration and webhooks', () => {
  it('allows an authenticated retry only when the delivery channel is enabled', async () => {
    await request(app)
      .post('/api/contact')
      .send({ submissionKey: randomUUID(), name: 'Retry Test', email: 'retry@example.test', message: 'Please send information about the studio.' })
      .expect(201);
    const event = await prisma.notificationEvent.findFirstOrThrow({ where: { type: 'lead_created_admin' } });
    await prisma.notificationEvent.update({
      where: { id: event.id },
      data: { status: NotificationStatus.FAILED, error: 'EMAIL_DELIVERY_FAILED' },
    });
    const agent = await loginAdmin();
    const previous = env.EMAIL_DELIVERY_ENABLED;

    env.EMAIL_DELIVERY_ENABLED = false;
    try {
      await agent.post(`/api/admin/notifications/${event.id}/retry`).expect(409);
      env.EMAIL_DELIVERY_ENABLED = true;
      await agent.post(`/api/admin/notifications/${event.id}/retry`).expect(202);
      const retried = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
      expect(retried.status).toBe(NotificationStatus.PENDING);
      expect(retried.attemptCount).toBe(0);
      expect(await prisma.auditLog.count({ where: { action: 'notification.retry', entityId: event.id } })).toBe(1);
    } finally {
      env.EMAIL_DELIVERY_ENABLED = previous;
    }
  });

  it('records explicit dead-letter dispositions and blocks unsafe retries', async () => {
    const agent = await loginAdmin();
    const obsolete = await prisma.notificationEvent.create({
      data: {
        channel: 'email',
        type: 'lead_created_admin',
        recipient: 'dead-letter@example.test',
        idempotencyKey: `dead-letter:${randomUUID()}`,
        status: NotificationStatus.FAILED,
        error: 'EMAIL_DELIVERY_FAILED',
      },
    });

    const classified = await agent
      .patch(`/api/admin/notifications/${obsolete.id}/resolve`)
      .send({ resolution: 'OBSOLETE', note: 'Historical test event is no longer relevant.' })
      .expect(200);
    expect(classified.body.data.resolution).toBe('OBSOLETE');
    expect(classified.body.data.resolvedAt).toBeTruthy();
    expect(classified.body.data.resolvedBy).toBeTruthy();
    await agent.post(`/api/admin/notifications/${obsolete.id}/retry`).expect(409);

    const actionable = await prisma.notificationEvent.create({
      data: {
        channel: 'email',
        type: 'lead_created_admin',
        recipient: 'reviewed@example.test',
        idempotencyKey: `dead-letter:${randomUUID()}`,
        status: NotificationStatus.FAILED,
        error: 'EMAIL_DELIVERY_FAILED',
      },
    });
    await agent
      .patch(`/api/admin/notifications/${actionable.id}/resolve`)
      .send({
        resolution: 'ACTIONABLE_REVIEW_REQUIRED',
        note: 'This individual event was reviewed and may be retried explicitly.',
      })
      .expect(200);

    const previous = env.EMAIL_DELIVERY_ENABLED;
    env.EMAIL_DELIVERY_ENABLED = true;
    try {
      await agent.post(`/api/admin/notifications/${actionable.id}/retry`).expect(202);
    } finally {
      env.EMAIL_DELIVERY_ENABLED = previous;
    }
    const retried = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: actionable.id } });
    expect(retried.status).toBe(NotificationStatus.PENDING);
    expect(retried.resolution).toBeNull();
    expect(retried.resolvedAt).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: 'notification.resolve' } })).toBe(2);
  });

  it('verifies webhook signatures and records provider delivery status', async () => {
    const event = await prisma.notificationEvent.create({
      data: {
        channel: 'whatsapp',
        type: 'booking_confirmed_customer',
        recipient: '+237699111111',
        idempotencyKey: `webhook-test-${randomUUID()}`,
        providerMessageId: `wamid-${randomUUID()}`,
        providerStatus: 'accepted',
        status: NotificationStatus.SENT,
      },
    });
    const previousSecret = env.WHATSAPP_APP_SECRET;
    env.WHATSAPP_APP_SECRET = 'webhook-test-secret';
    try {
      const rawBody = Buffer.from('{"object":"whatsapp_business_account"}');
      const signature = `sha256=${createHmac('sha256', env.WHATSAPP_APP_SECRET).update(rawBody).digest('hex')}`;
      expect(isValidWhatsAppSignature(rawBody, signature)).toBe(true);
      expect(isValidWhatsAppSignature(rawBody, 'sha256=invalid')).toBe(false);

      await handleWhatsAppWebhook({
        entry: [{ changes: [{ value: { statuses: [{ id: event.providerMessageId!, status: 'delivered' }] } }] }],
      });
      const delivered = await prisma.notificationEvent.findUniqueOrThrow({ where: { id: event.id } });
      expect(delivered.providerStatus).toBe('delivered');
      expect(delivered.deliveredAt).toBeInstanceOf(Date);
      expect(delivered.lastWebhookAt).toBeInstanceOf(Date);
    } finally {
      env.WHATSAPP_APP_SECRET = previousSecret;
    }
  });
});

describe('phase 8 curated media pipeline', () => {
  it('publishes only editorial categories and never exposes private storage paths', async () => {
    await prisma.mediaItem.createMany({
      data: [
        {
          title: 'Golden Studio Plus Hero',
          altText: 'Technical hero fixture',
          url: '/uploads/portfolio/hero.webp',
          storagePath: '/private/hero.png',
          category: 'hero',
          isPublished: true,
        },
        {
          title: 'TEST QA CODEX',
          altText: 'Technical QA fixture',
          url: '/uploads/portfolio/qa.webp',
          storagePath: '/private/qa.png',
          category: 'QA_TEST',
          isPublished: true,
        },
        {
          title: 'Portrait famille',
          altText: 'Portrait de famille en studio',
          url: '/uploads/portfolio/famille-1600.webp',
          thumbnailUrl: '/uploads/portfolio/famille-640.webp',
          storagePath: '/private/famille.png',
          category: 'Famille',
          width: 1200,
          height: 800,
          thumbnailWidth: 640,
          thumbnailHeight: 427,
          mimeType: 'image/webp',
          fileSize: 24000,
          thumbnailFileSize: 9000,
          isPublished: true,
        },
      ],
    });

    const response = await request(app).get('/api/media').expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      title: 'Portrait famille',
      category: 'Famille',
      mimeType: 'image/webp',
      thumbnailWidth: 640,
    });
    expect(response.body.data[0]).not.toHaveProperty('storagePath');
    expect(JSON.stringify(response.body)).not.toMatch(/QA_TEST|Golden Studio Plus Hero|\/private\//);
  });

  it('stores a private master, creates typed responsive derivatives, and removes every file on delete', async () => {
    const agent = await loginAdmin();
    const source = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 80, g: 40, b: 120 },
      },
    }).png().toBuffer();

    const response = await agent
      .post('/api/admin/media')
      .field('title', 'Portrait Phase 8')
      .field('altText', 'Portrait violet de validation Phase 8')
      .field('category', 'Portrait')
      .field('sortOrder', '3')
      .field('isPublished', 'on')
      .attach('file', source, { filename: 'portrait-source.png', contentType: 'image/png' })
      .expect(201);

    const media = response.body.data;
    expect(media).toMatchObject({
      title: 'Portrait Phase 8',
      category: 'Portrait',
      mimeType: 'image/webp',
      width: 1200,
      height: 800,
      thumbnailWidth: 640,
      sortOrder: 3,
    });
    expect(media.url).toMatch(/-1600\.webp$/);
    expect(media.thumbnailUrl).toMatch(/-640\.webp$/);
    expect(media.fileSize).toBeGreaterThan(0);
    expect(media.thumbnailFileSize).toBeGreaterThan(0);

    const stored = await prisma.mediaItem.findUniqueOrThrow({ where: { id: media.id } });
    expect(path.relative(env.PRIVATE_MEDIA_DIR, stored.storagePath!)).not.toMatch(/^\.\./);
    const masterStat = await fs.stat(stored.storagePath!);
    expect(masterStat.mode & 0o777).toBe(0o600);

    const primaryPath = path.join(env.UPLOAD_DIR, media.url.slice(`${env.UPLOAD_PUBLIC_PATH}/`.length));
    const thumbnailPath = path.join(env.UPLOAD_DIR, media.thumbnailUrl.slice(`${env.UPLOAD_PUBLIC_PATH}/`.length));
    const [primaryMetadata, thumbnailMetadata] = await Promise.all([
      sharp(primaryPath).metadata(),
      sharp(thumbnailPath).metadata(),
    ]);
    expect(primaryMetadata).toMatchObject({ format: 'webp', width: 1200, height: 800 });
    expect(thumbnailMetadata).toMatchObject({ format: 'webp', width: 640, height: 427 });

    const publicResponse = await request(app).get('/api/media').expect(200);
    expect(publicResponse.body.data.some((item: { id: string }) => item.id === media.id)).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: 'media.upload', entityId: media.id } })).toBe(1);

    await agent.delete(`/api/admin/media/${media.id}`).expect(204);
    await expect(fs.stat(stored.storagePath!)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.stat(primaryPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.stat(thumbnailPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects misleading or corrupt image bytes before creating a media record', async () => {
    const agent = await loginAdmin();
    const response = await agent
      .post('/api/admin/media')
      .field('title', 'Faux PNG')
      .field('altText', 'Fichier corrompu de validation')
      .field('category', 'Portrait')
      .attach('file', Buffer.from('not a real png'), { filename: 'fake.png', contentType: 'image/png' })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_IMAGE');
    expect(await prisma.mediaItem.count()).toBe(0);
  });
});

describe('phase 11 security boundary', () => {
  it('trusts only the loopback reverse proxy and returns hardened, privacy-safe HTTP errors', async () => {
    const previousTrustProxy = env.TRUST_PROXY;
    env.TRUST_PROXY = true;
    try {
      const proxyApp = createApp();
      expect(proxyApp.get('trust proxy')).toBe('loopback');
    } finally {
      env.TRUST_PROXY = previousTrustProxy;
    }

    const health = await request(app).get('/health').expect(200);
    expect(health.headers).not.toHaveProperty('x-powered-by');
    expect(health.headers['content-security-policy']).toContain("default-src 'self'");
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    expect(health.headers['x-frame-options']).toBe('SAMEORIGIN');

    const allowedOrigin = env.CLIENT_ORIGINS[0];
    const allowed = await request(app).get('/api/health').set('Origin', allowedOrigin).expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const blocked = await request(app)
      .get('/api/health')
      .set('Origin', 'https://attacker.example')
      .expect(403);
    expect(blocked.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    expect(blocked.headers).not.toHaveProperty('access-control-allow-origin');

    const invalidJson = await request(app)
      .post('/api/contact')
      .set('Content-Type', 'application/json')
      .send('{"broken"')
      .expect(400);
    expect(invalidJson.body.error).toEqual({
      code: 'INVALID_JSON',
      message: 'Request body contains invalid JSON.',
    });

    const oversized = await request(app)
      .post('/api/contact')
      .send({ message: 'x'.repeat(1024 * 1024) })
      .expect(413);
    expect(oversized.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(JSON.stringify(oversized.body)).not.toContain('stack');
  });

  it('sets a host-only strict production cookie and revokes the server-side session on logout', async () => {
    const previousNodeEnv = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      const productionLogin = await request(app)
        .post('/api/admin/login')
        .send({ email: 'admin@goldenstudioplus.test', password: adminPassword })
        .expect(200);
      const productionCookies = productionLogin.headers['set-cookie'] as unknown as string[];
      const sessionCookie = productionCookies.find((value) => value.startsWith(`${ADMIN_SESSION_COOKIE_PRODUCTION}=`));
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('Secure');
      expect(sessionCookie).toContain('SameSite=Strict');
      expect(sessionCookie).toContain('Path=/');
      expect(sessionCookie).toContain(`Max-Age=${env.ADMIN_SESSION_TTL_SECONDS}`);
      expect(sessionCookie).not.toContain('Domain=');
    } finally {
      env.NODE_ENV = previousNodeEnv;
    }

    const login = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@goldenstudioplus.test', password: adminPassword })
      .expect(200);
    const cookies = login.headers['set-cookie'] as unknown as string[];
    const sessionCookie = cookies.find((value) => value.startsWith(`${ADMIN_SESSION_COOKIE}=`));
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Strict');
    const cookie = sessionCookie!.split(';', 1)[0];

    await request(app).get('/api/admin/me').set('Cookie', cookie).expect(200);
    const logout = await request(app).post('/api/admin/logout').set('Cookie', cookie).expect(204);
    expect((logout.headers['set-cookie'] as unknown as string[]).join(';')).toContain(`${ADMIN_SESSION_COOKIE}=`);
    await request(app).get('/api/admin/me').set('Cookie', cookie).expect(401);

    const admin = await prisma.adminUser.findFirstOrThrow();
    expect(admin.sessionVersion).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'admin.logout', entityId: admin.id } })).toBe(1);

    const expiredToken = jwt.sign(
      { role: admin.role, sessionVersion: admin.sessionVersion },
      env.ADMIN_SESSION_SECRET,
      {
        algorithm: 'HS256',
        audience: 'golden-studio-plus-admin',
        issuer: 'golden-studio-plus',
        subject: admin.id,
        expiresIn: -1,
      },
    );
    await request(app)
      .get('/api/admin/me')
      .set('Cookie', `${ADMIN_SESSION_COOKIE}=${expiredToken}`)
      .expect(401);
  });

  it('blocks honeypots before all public-write validation and performs no database writes', async () => {
    const publicWritePaths = [
      '/api/reservation-intents',
      '/api/reservations',
      '/api/contact',
      '/api/b2b-inquiries',
      '/api/quote-requests',
    ];

    for (const pathName of publicWritePaths) {
      const response = await request(app).post(pathName).send({ website: 'https://bot.example' }).expect(400);
      expect(response.body.error.code).toBe('BOT_PROTECTION_FAILED');
    }

    expect(await prisma.reservationIntent.count()).toBe(0);
    expect(await prisma.reservation.count()).toBe(0);
    expect(await prisma.lead.count()).toBe(0);
    expect(await prisma.notificationEvent.count()).toBe(0);
  });

  it('rejects an upload above the exact eight-megabyte application boundary', async () => {
    const agent = await loginAdmin();
    const response = await agent
      .post('/api/admin/media')
      .field('title', 'Oversized image')
      .field('altText', 'Oversized security test image')
      .field('category', 'Portrait')
      .attach('file', Buffer.alloc(MAX_MEDIA_UPLOAD_BYTES + 1), {
        filename: 'oversized.png',
        contentType: 'image/png',
      })
      .expect(400);

    expect(response.body.error).toEqual({
      code: 'LIMIT_FILE_SIZE',
      message: 'Uploaded file is too large.',
    });
    expect(await prisma.mediaItem.count()).toBe(0);
  });

  it('enforces the documented request limits and excludes successful admin logins', async () => {
    expect(RATE_LIMIT_POLICIES).toEqual({
      api: { windowMs: 15 * 60 * 1000, limit: 300 },
      publicWrite: { windowMs: 10 * 60 * 1000, limit: 20 },
      adminLogin: { windowMs: 15 * 60 * 1000, limit: 5, skipSuccessfulRequests: true },
    });

    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'phase-11-rate-limit-test';
    try {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await request(app)
          .post('/api/admin/login')
          .send({ email: 'admin@goldenstudioplus.test', password: adminPassword })
          .expect(200);
      }

      for (let attempt = 0; attempt < RATE_LIMIT_POLICIES.adminLogin.limit; attempt += 1) {
        await request(app)
          .post('/api/admin/login')
          .send({ email: 'admin@goldenstudioplus.test', password: 'wrong-password' })
          .expect(401);
      }
      const blockedLogin = await request(app)
        .post('/api/admin/login')
        .send({ email: 'admin@goldenstudioplus.test', password: 'wrong-password' })
        .expect(429);
      expect(blockedLogin.body.error.code).toBe('RATE_LIMITED');

      for (let attempt = 0; attempt < RATE_LIMIT_POLICIES.publicWrite.limit; attempt += 1) {
        await request(app)
          .post('/api/contact')
          .send({ website: 'bot', attempt })
          .expect(400);
      }
      const blockedWrite = await request(app)
        .post('/api/contact')
        .send({ website: 'bot', attempt: RATE_LIMIT_POLICIES.publicWrite.limit })
        .expect(429);
      expect(blockedWrite.body.error.code).toBe('RATE_LIMITED');
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});

describe('P0-03 temporal lifecycle and future-slot protection', () => {
  it('rejects a direct early completion and keeps the future slot unavailable', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const startAt = futureDateAt(10, 0, 20);
    const created = await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, startAt))
      .expect(201);
    await prisma.reservation.update({
      where: { id: created.body.data.id },
      data: { status: ReservationStatus.CONFIRMED },
    });
    const agent = await loginAdmin();

    const response = await agent
      .patch(`/api/admin/reservations/${created.body.data.id}`)
      .send({ status: ReservationStatus.COMPLETED })
      .expect(409);

    expect(response.body.error.code).toBe('RESERVATION_END_NOT_REACHED');
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: created.body.data.id } })).status)
      .toBe(ReservationStatus.CONFIRMED);

    const date = businessDateKey(startAt);
    const availability = await request(app)
      .get('/api/availability')
      .query({ from: date, to: date, packageId: pack.id })
      .expect(200);
    expect(availability.body.data.days[0].slots.find((slot: { time: string }) => slot.time === '10:00'))
      .toMatchObject({ available: false, reason: 'reservation' });
  });

  it('allows completion exactly at end and no-show one minute after across a Douala day boundary', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const date = addBusinessDays(businessDateKey(new Date()), 25);
    const nextDate = addBusinessDays(date, 1);
    const scheduledEndAt = businessLocalToInstant(nextDate, '00:00');
    const created = await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, futureDateAt(11, 0, 25)))
      .expect(201);
    const reservation = await prisma.reservation.update({
      where: { id: created.body.data.id },
      data: {
        status: ReservationStatus.CONFIRMED,
        startAt: businessLocalToInstant(date, '23:00'),
        endAt: scheduledEndAt,
      },
    });

    await expect(
      prisma.$transaction((tx) =>
        transitionReservationStatus(tx, reservation.id, {
          toStatus: ReservationStatus.COMPLETED,
          expectedVersion: reservation.version,
          now: new Date(scheduledEndAt.getTime() - 60_000),
        }),
      ),
    ).rejects.toMatchObject({ code: 'RESERVATION_END_NOT_REACHED' });

    const completed = await prisma.$transaction((tx) =>
      transitionReservationStatus(tx, reservation.id, {
        toStatus: ReservationStatus.COMPLETED,
        expectedVersion: reservation.version,
        now: scheduledEndAt,
      }),
    );
    expect(completed.status).toBe(ReservationStatus.COMPLETED);
    expect(completed.statusChangedAt.toISOString()).toBe(scheduledEndAt.toISOString());

    const secondCreated = await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, futureDateAt(13, 0, 26)))
      .expect(201);
    const second = await prisma.reservation.update({
      where: { id: secondCreated.body.data.id },
      data: {
        status: ReservationStatus.CONFIRMED,
        startAt: businessLocalToInstant(nextDate, '00:00'),
        endAt: businessLocalToInstant(nextDate, '01:00'),
      },
    });
    const oneMinuteAfter = new Date(second.endAt.getTime() + 60_000);
    const noShow = await prisma.$transaction((tx) =>
      transitionReservationStatus(tx, second.id, {
        toStatus: ReservationStatus.NO_SHOW,
        expectedVersion: second.version,
        reason: 'Client absent après la fin du créneau',
        now: oneMinuteAfter,
      }),
    );
    expect(noShow.status).toBe(ReservationStatus.NO_SHOW);
    expect(noShow.statusChangedAt.toISOString()).toBe(oneMinuteAfter.toISOString());
  });

  it('requires explicit owner override, persists its audit, and keeps the slot blocked until end', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const startAt = futureDateAt(12, 0, 21);
    const created = await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, startAt))
      .expect(201);
    const reservation = await prisma.reservation.update({
      where: { id: created.body.data.id },
      data: { status: ReservationStatus.CONFIRMED },
    });
    const agent = await loginAdmin();

    const missingConfirmation = await agent
      .patch(`/api/admin/reservations/${reservation.id}`)
      .send({
        status: ReservationStatus.COMPLETED,
        expectedVersion: reservation.version,
        temporalOverride: true,
        reason: 'Clôture exceptionnelle contrôlée',
      })
      .expect(400);
    expect(missingConfirmation.body.error.code).toBe('TEMPORAL_OVERRIDE_CONFIRMATION_REQUIRED');

    const missingReason = await agent
      .patch(`/api/admin/reservations/${reservation.id}`)
      .send({
        status: ReservationStatus.COMPLETED,
        expectedVersion: reservation.version,
        temporalOverride: true,
        overrideConfirmed: true,
      })
      .expect(400);
    expect(missingReason.body.error.code).toBe('TEMPORAL_OVERRIDE_REASON_REQUIRED');

    await agent
      .patch(`/api/admin/reservations/${reservation.id}`)
      .send({
        status: ReservationStatus.COMPLETED,
        expectedVersion: reservation.version,
        temporalOverride: true,
        overrideConfirmed: true,
        reason: 'Incident studio imposant une clôture anticipée',
      })
      .expect(200);

    const transition = await prisma.reservationTransition.findFirstOrThrow({
      where: { reservationId: reservation.id, toStatus: ReservationStatus.COMPLETED },
      orderBy: { createdAt: 'desc' },
    });
    expect(transition.metadata).toMatchObject({
      temporalOverride: {
        applied: true,
        confirmed: true,
        reason: 'Incident studio imposant une clôture anticipée',
        scheduledEndAt: reservation.endAt.toISOString(),
      },
    });
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'reservation.early_close_override', entityId: reservation.id },
    });
    expect(audit.adminUserId).not.toBeNull();
    expect(audit.metadata).toMatchObject({
      oldStatus: ReservationStatus.CONFIRMED,
      newStatus: ReservationStatus.COMPLETED,
      reason: 'Incident studio imposant une clôture anticipée',
    });

    const doubleBooking = await request(app)
      .post('/api/reservation-intents')
      .send({ packageId: pack.id, startAt: startAt.toISOString(), idempotencyKey: randomUUID() })
      .expect(409);
    expect(doubleBooking.body.error.code).toBe('SLOT_ALREADY_RESERVED');
  });

  it('denies early override to staff but permits a normal close after end', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, futureDateAt(14, 0, 22)))
      .expect(201);
    let reservation = await prisma.reservation.update({
      where: { id: created.body.data.id },
      data: { status: ReservationStatus.CONFIRMED },
    });
    const passwordHash = await bcrypt.hash('p0-03-staff-password', 4);
    await prisma.adminUser.create({
      data: {
        email: 'staff-p0-03@goldenstudioplus.test',
        name: 'Staff P0-03',
        passwordHash,
        role: AdminRole.STAFF,
      },
    });
    const staff = request.agent(app);
    await staff
      .post('/api/admin/login')
      .send({ email: 'staff-p0-03@goldenstudioplus.test', password: 'p0-03-staff-password' })
      .expect(200);

    const forbidden = await staff
      .patch(`/api/admin/reservations/${reservation.id}`)
      .send({
        status: ReservationStatus.COMPLETED,
        expectedVersion: reservation.version,
        temporalOverride: true,
        overrideConfirmed: true,
        reason: 'Tentative sans permission',
      })
      .expect(403);
    expect(forbidden.body.error.code).toBe('ADMIN_PERMISSION_REQUIRED');

    const now = new Date();
    reservation = await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        startAt: new Date(now.getTime() - 2 * 60 * 60_000),
        endAt: new Date(now.getTime() - 60_000),
      },
    });
    const completed = await staff
      .patch(`/api/admin/reservations/${reservation.id}`)
      .send({ status: ReservationStatus.COMPLETED, expectedVersion: reservation.version })
      .expect(200);
    expect(completed.body.data.status).toBe(ReservationStatus.COMPLETED);
  });
});

describe('REF-01 public reservation references', () => {
  it('issues the short public format and preserves it when the intent becomes a reservation', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const payload = await reservationPayload(pack.id, futureDateAt(10, 0, 27));

    expect(payload.expectedReference).toMatch(/^GSP-\d{6}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);

    const created = await request(app)
      .post('/api/reservations')
      .send(payload)
      .expect(201);

    expect(created.body.data.reference).toBe(payload.expectedReference);
    expect(created.body.data.id).not.toBe(created.body.data.reference);
  });

  it('finds one reservation by a case-normalized indexed public reference', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const first = await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, futureDateAt(10, 0, 28)))
      .expect(201);
    await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, futureDateAt(14, 0, 29)))
      .expect(201);
    const agent = await loginAdmin();

    const response = await agent
      .get('/api/admin/reservations')
      .query({ reference: first.body.data.reference.toLowerCase() })
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: first.body.data.id,
      reference: first.body.data.reference,
    });
  });

  it('rejects database updates to public references after creation', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, futureDateAt(10, 0, 30)))
      .expect(201);
    const intent = await prisma.reservationIntent.findFirstOrThrow({
      where: { reservationId: created.body.data.id },
    });

    await expect(
      prisma.$executeRaw`UPDATE "Reservation" SET "reference" = ${'GSP-260802-ABCD'} WHERE "id" = ${created.body.data.id}`,
    ).rejects.toThrow(/PUBLIC_REFERENCE_IMMUTABLE/);
    await expect(
      prisma.$executeRaw`UPDATE "ReservationIntent" SET "reference" = ${'GSP-260802-EFGH'} WHERE "id" = ${intent.id}`,
    ).rejects.toThrow(/PUBLIC_REFERENCE_IMMUTABLE/);

    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: created.body.data.id } })).reference)
      .toBe(created.body.data.reference);
    expect((await prisma.reservationIntent.findUniqueOrThrow({ where: { id: intent.id } })).reference)
      .toBe(created.body.data.reference);
  });
});


describe('LEG-03 withdrawal request workflow', () => {
  it('records immutable legal context and a separate idempotent human decision', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, futureDateAt(10, 0, 31)))
      .expect(201);
    const agent = await loginAdmin();
    const commandId = randomUUID();
    const receivedAt = new Date();
    const createPayload = {
      commandId,
      expectedReservationVersion: 1,
      receivedAt: receivedAt.toISOString(),
      requestChannel: 'EMAIL',
      requestText: 'Je demande explicitement la rétractation de cette réservation.',
      requestEvidence: 'Courriel reçu sur info@gsplus.vip, référence Message-ID conservée.',
      serviceStatus: 'NOT_STARTED',
      executionStartedAt: null,
    };

    const first = await agent
      .post(`/api/admin/reservations/${created.body.data.id}/withdrawal-requests`)
      .send(createPayload)
      .expect(201);
    expect(first.body.data).toMatchObject({ replayed: false, request: {
      status: 'PENDING',
      version: 1,
      requestChannel: 'EMAIL',
      serviceStatus: 'NOT_STARTED',
      receivedWithinLegalWindow: true,
    } });
    expect(new Date(first.body.data.request.legalDeadlineAt).getTime() -
      new Date(first.body.data.request.contractConcludedAt).getTime()).toBe(15 * 24 * 60 * 60_000);

    const replay = await agent
      .post(`/api/admin/reservations/${created.body.data.id}/withdrawal-requests`)
      .send(createPayload)
      .expect(201);
    expect(replay.body.data).toMatchObject({ replayed: true, commandId, request: { id: first.body.data.request.id } });
    expect(await prisma.reservationWithdrawalRequest.count()).toBe(1);

    const decisionCommandId = randomUUID();
    const decisionPayload = {
      commandId: decisionCommandId,
      expectedVersion: 1,
      decision: 'ACCEPTED',
      reason: 'Demande reçue dans le délai; service non commencé; analyse propriétaire validée.',
    };
    const decision = await agent
      .patch(`/api/admin/withdrawal-requests/${first.body.data.request.id}/decision`)
      .send(decisionPayload)
      .expect(200);
    expect(decision.body.data).toMatchObject({ replayed: false, request: {
      status: 'ACCEPTED',
      version: 2,
      decisionReason: decisionPayload.reason,
    } });
    const decisionReplay = await agent
      .patch(`/api/admin/withdrawal-requests/${first.body.data.request.id}/decision`)
      .send(decisionPayload)
      .expect(200);
    expect(decisionReplay.body.data).toMatchObject({ replayed: true, commandId: decisionCommandId });

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.body.data.id },
      include: { payments: true, financialTasks: true },
    });
    expect(reservation.status).toBe(ReservationStatus.PENDING_CONFIRMATION);
    expect(reservation.version).toBe(1);
    expect(reservation.payments[0].status).toBe(PaymentStatus.PENDING);
    expect(reservation.financialTasks).toHaveLength(0);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'reservation.withdrawal_request.accept', entityId: first.body.data.request.id },
    });
    expect(audit.metadata).toMatchObject({ automaticCancellation: false, automaticRefund: false });
  });

  it('requires coherent service execution evidence before recording the request', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, futureDateAt(11, 0, 32)))
      .expect(201);
    const agent = await loginAdmin();
    const response = await agent
      .post(`/api/admin/reservations/${created.body.data.id}/withdrawal-requests`)
      .send({
        commandId: randomUUID(),
        expectedReservationVersion: 1,
        receivedAt: new Date().toISOString(),
        requestChannel: 'EMAIL',
        requestText: 'Demande explicite reçue.',
        requestEvidence: 'Courriel archivé.',
        serviceStatus: 'STARTED',
        executionStartedAt: null,
      })
      .expect(400);
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(response.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'executionStartedAt', message: 'La date de début d’exécution est obligatoire.' }),
    ]));
    expect(await prisma.reservationWithdrawalRequest.count()).toBe(0);
  });

  it('denies withdrawal recording to staff', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, futureDateAt(12, 0, 33)))
      .expect(201);
    const passwordHash = await bcrypt.hash('leg-03-staff-password', 4);
    await prisma.adminUser.create({ data: {
      email: 'leg-03-staff@goldenstudioplus.test',
      name: 'LEG-03 Staff',
      passwordHash,
      role: AdminRole.STAFF,
    } });
    const staff = request.agent(app);
    await staff.post('/api/admin/login').send({
      email: 'leg-03-staff@goldenstudioplus.test',
      password: 'leg-03-staff-password',
    }).expect(200);
    const response = await staff
      .post(`/api/admin/reservations/${created.body.data.id}/withdrawal-requests`)
      .send({
        commandId: randomUUID(),
        expectedReservationVersion: 1,
        receivedAt: new Date().toISOString(),
        requestChannel: 'EMAIL',
        requestText: 'Demande explicite reçue.',
        requestEvidence: 'Courriel archivé.',
        serviceStatus: 'NOT_STARTED',
      })
      .expect(403);
    expect(response.body.error).toMatchObject({ code: 'ADMIN_PERMISSION_REQUIRED' });
    expect(await prisma.reservationWithdrawalRequest.count()).toBe(0);
  });
});

describe('LEG-04 legal versions and image consent evidence', () => {
  it('requires distinct privacy acknowledgment and records grant or refusal against published versions', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const missingPrivacy = await reservationPayload(pack.id, futureDateAt(9, 0, 34));
    delete (missingPrivacy as Partial<typeof missingPrivacy>).acceptedPrivacy;
    const invalid = await request(app).post('/api/reservations').send(missingPrivacy).expect(400);
    expect(invalid.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'acceptedPrivacy' }),
    ]));

    const grantedPayload = await reservationPayload(pack.id, futureDateAt(10, 0, 35));
    grantedPayload.consentImage = true;
    const granted = await request(app).post('/api/reservations').send(grantedPayload).expect(201);
    const refusedPayload = await reservationPayload(pack.id, futureDateAt(11, 0, 36));
    refusedPayload.consentImage = false;
    const refused = await request(app).post('/api/reservations').send(refusedPayload).expect(201);

    const reservations = await prisma.reservation.findMany({
      where: { id: { in: [granted.body.data.id, refused.body.data.id] } },
      orderBy: { startAt: 'asc' },
      include: { snapshot: true, imageConsentEvents: { include: { legalVersion: true } } },
    });
    expect(reservations.map((item) => item.snapshot?.privacyAccepted)).toEqual([true, true]);
    expect(reservations.map((item) => item.snapshot?.privacyVersion)).toEqual(['2026-07-31', '2026-07-31']);
    expect(reservations.map((item) => item.imageConsentEvents[0].choice)).toEqual(['GRANTED', 'REFUSED']);
    expect(reservations.every((item) => item.imageConsentEvents[0].purpose === 'PORTFOLIO_AND_PROMOTION')).toBe(true);
    expect(reservations.every((item) => item.imageConsentEvents[0].legalVersion.documentType === 'IMAGE_AUTHORIZATION')).toBe(true);
    expect(reservations[0].imageConsentEvents[0].scope).toEqual(['WEBSITE', 'INSTAGRAM', 'TIKTOK']);
    expect(reservations[0].imageConsentEvents[0].evidence).toMatchObject({ selected: true, optional: true });
    expect(reservations[1].imageConsentEvents[0].evidence).toMatchObject({ selected: false, optional: true });
    expect(await prisma.legalDocumentVersion.count({ where: { status: 'PUBLISHED' } })).toBe(3);

    await expect(prisma.imageConsentEvent.update({
      where: { id: reservations[0].imageConsentEvents[0].id },
      data: { choice: 'REFUSED' },
    })).rejects.toThrow(/IMAGE_CONSENT_EVENT_IMMUTABLE/);
  });

  it('records an idempotent prospective withdrawal without mutating historical reservation evidence', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, futureDateAt(12, 0, 37)))
      .expect(201);
    const before = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.body.data.id },
      include: { snapshot: true, customer: true, imageConsentEvents: true },
    });
    const initial = before.imageConsentEvents[0];
    expect(initial.choice).toBe('GRANTED');
    const agent = await loginAdmin();
    const commandId = randomUUID();
    const payload = {
      commandId,
      expectedPriorEventId: initial.id,
      choice: 'WITHDRAWN',
      receivedAt: new Date().toISOString(),
      requestChannel: 'EMAIL',
      requestEvidence: 'Message-ID du retrait conservé dans la boîte professionnelle.',
    };
    const first = await agent
      .post(`/api/admin/reservations/${created.body.data.id}/image-consent-events`)
      .send(payload)
      .expect(201);
    expect(first.body.data).toMatchObject({
      replayed: false,
      event: {
        choice: 'WITHDRAWN',
        priorEventId: initial.id,
        purpose: 'PORTFOLIO_AND_PROMOTION',
        scope: ['WEBSITE', 'INSTAGRAM', 'TIKTOK'],
      },
    });
    expect(first.body.data.effectNotice).toMatch(/effet pour l’avenir/);
    const replay = await agent
      .post(`/api/admin/reservations/${created.body.data.id}/image-consent-events`)
      .send(payload)
      .expect(201);
    expect(replay.body.data).toMatchObject({ replayed: true, commandId, event: { id: first.body.data.event.id } });

    const after = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.body.data.id },
      include: { snapshot: true, customer: true, imageConsentEvents: { orderBy: { createdAt: 'asc' } } },
    });
    expect(after.imageConsentEvents.map((event) => event.choice)).toEqual(['GRANTED', 'WITHDRAWN']);
    expect(after.consentImage).toBe(true);
    expect(after.snapshot).toEqual(before.snapshot);
    expect(after.customer).toEqual(before.customer);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'reservation.image_consent.withdrawn', entityId: first.body.data.event.id },
    });
    expect(audit.metadata).toMatchObject({ prospectiveOnly: true, snapshotMutated: false });

    const stale = await agent
      .post(`/api/admin/reservations/${created.body.data.id}/image-consent-events`)
      .send({ ...payload, commandId: randomUUID(), choice: 'GRANTED' })
      .expect(409);
    expect(stale.body.error).toMatchObject({ code: 'IMAGE_CONSENT_VERSION_CONFLICT' });
  });

  it('denies image consent recording to staff', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app)
      .post('/api/reservations')
      .send(await reservationPayload(pack.id, futureDateAt(13, 0, 38)))
      .expect(201);
    const current = await prisma.imageConsentEvent.findFirstOrThrow({ where: { reservationId: created.body.data.id } });
    const passwordHash = await bcrypt.hash('leg-04-staff-password', 4);
    await prisma.adminUser.create({ data: {
      email: 'leg-04-staff@goldenstudioplus.test', name: 'LEG-04 Staff', passwordHash, role: AdminRole.STAFF,
    } });
    const staff = request.agent(app);
    await staff.post('/api/admin/login').send({
      email: 'leg-04-staff@goldenstudioplus.test', password: 'leg-04-staff-password',
    }).expect(200);
    const response = await staff
      .post(`/api/admin/reservations/${created.body.data.id}/image-consent-events`)
      .send({
        commandId: randomUUID(), expectedPriorEventId: current.id, choice: 'WITHDRAWN',
        receivedAt: new Date().toISOString(), requestChannel: 'EMAIL', requestEvidence: 'Preuve conservée.',
      })
      .expect(403);
    expect(response.body.error).toMatchObject({ code: 'ADMIN_PERMISSION_REQUIRED' });
    expect(await prisma.imageConsentEvent.count({ where: { reservationId: created.body.data.id } })).toBe(1);
  });
});


describe('LEG-05 data governance', () => {
  it('publishes seven non-automatic retention policies to the owner', async () => {
    const agent = await loginAdmin();
    const response = await agent.get('/api/admin/data-governance').expect(200);
    expect(response.body.data.policies).toHaveLength(7);
    expect(response.body.data.policies.every((policy: { automaticExecution: boolean }) => !policy.automaticExecution)).toBe(true);
    expect(response.body.data.policies.map((policy: { category: string }) => policy.category)).toEqual(expect.arrayContaining([
      'RESERVATIONS', 'PAYMENTS', 'CONSENTS', 'MEDIA_WORK_FILES', 'TECHNICAL_LOGS', 'BACKUPS', 'RIGHTS_REQUESTS',
    ]));
  });

  it('creates, replays and versions an auditable rights request', async () => {
    const agent = await loginAdmin();
    const receivedAt = new Date(Date.now() - 60_000);
    const commandId = randomUUID();
    const payload = {
      commandId,
      requestType: 'ACCESS',
      requesterName: 'Cliente Gouvernance',
      requesterEmail: 'rights@example.test',
      requestChannel: 'EMAIL',
      requestSummary: 'Demande complète d’accès aux données personnelles traitées.',
      identityStatus: 'UNVERIFIED',
      receivedAt: receivedAt.toISOString(),
      targetResponseAt: new Date(receivedAt.getTime() + 86_400_000).toISOString(),
    };
    const created = await agent.post('/api/admin/data-rights-requests').send(payload).expect(201);
    expect(created.body.data).toMatchObject({ replayed: false, request: { status: 'RECEIVED', version: 1 } });
    expect(created.body.data.request.reference).toMatch(/^DR-\d{8}-[A-F0-9]{12}$/);

    const replay = await agent.post('/api/admin/data-rights-requests').send(payload).expect(201);
    expect(replay.body.data).toMatchObject({ replayed: true, request: { id: created.body.data.request.id } });

    const updatePayload = {
      commandId: randomUUID(),
      expectedVersion: 1,
      status: 'FULFILLED',
      identityStatus: 'VERIFIED',
      identityEvidenceReference: 'Contrôle visuel consigné dans le ticket interne DR-1',
      processingRestricted: true,
      retentionAction: 'RESTRICTED_ARCHIVE',
      reason: 'Copie structurée préparée et réponse transmise au demandeur.',
      responseEvidence: 'Message-ID rights-response-001 conservé dans la boîte professionnelle',
      effectiveAt: new Date().toISOString(),
    };
    const updated = await agent.patch(`/api/admin/data-rights-requests/${created.body.data.request.id}`).send(updatePayload).expect(200);
    expect(updated.body.data.request).toMatchObject({ status: 'FULFILLED', version: 2, processingRestricted: true, retentionAction: 'RESTRICTED_ARCHIVE' });
    expect(updated.body.data.request.events).toHaveLength(2);
    await expect(prisma.dataRightsRequestEvent.update({
      where: { id: updated.body.data.request.events[0].id },
      data: { reason: 'Tentative de mutation directe interdite' },
    })).rejects.toThrow(/DATA_RIGHTS_EVENT_IMMUTABLE/);
    await expect(prisma.dataRetentionPolicy.update({
      where: { category: 'RIGHTS_REQUESTS' },
      data: { label: 'Tentative de mutation directe interdite' },
    })).rejects.toThrow(/RETENTION_POLICY_IMMUTABLE/);

    const stale = await agent.patch(`/api/admin/data-rights-requests/${created.body.data.request.id}`).send({
      ...updatePayload,
      commandId: randomUUID(),
      status: 'REFUSED',
    }).expect(409);
    expect(stale.body.error).toMatchObject({ code: 'DATA_RIGHTS_VERSION_CONFLICT' });
  });

  it('denies the confidential register to staff', async () => {
    const passwordHash = await bcrypt.hash('leg-05-staff-password', 4);
    await prisma.adminUser.create({ data: {
      email: 'leg-05-staff@goldenstudioplus.test', name: 'LEG-05 Staff', passwordHash, role: AdminRole.STAFF,
    } });
    const staff = request.agent(app);
    await staff.post('/api/admin/login').send({
      email: 'leg-05-staff@goldenstudioplus.test', password: 'leg-05-staff-password',
    }).expect(200);
    const response = await staff.get('/api/admin/data-governance').expect(403);
    expect(response.body.error).toMatchObject({ code: 'ADMIN_PERMISSION_REQUIRED' });
  });
});
describe('P2-01 localized validation responses', () => {
  it('returns a French summary and structured field details for public forms', async () => {
    const response = await request(app)
      .post('/api/contact')
      .send({
        submissionKey: randomUUID(),
        name: '',
        email: 'alice@example.com',
        message: 'court',
      })
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Corrigez les champs invalides avant de continuer.',
    });
    expect(response.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'name', code: 'too_small', message: 'Renseignez votre nom.' }),
      expect.objectContaining({ path: 'message', code: 'too_small', message: 'Le message doit contenir au moins 10 caractères.' }),
    ]));
    expect(JSON.stringify(response.body.error)).not.toMatch(/Request validation failed|Too small|Invalid input/);
  });
});
