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
import { handleWhatsAppWebhook, isValidWhatsAppSignature, processNotificationEvent, queueReservationCreatedNotifications } from '../../src/emails/notifications.js';
import { env } from '../../src/config/env.js';
import { RATE_LIMIT_POLICIES } from '../../src/middleware/security.js';
import { MAX_MEDIA_UPLOAD_BYTES } from '../../src/middleware/media-upload.js';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_PRODUCTION,
} from '../../src/services/admin-auth.js';
import { updatePackageWithVersion } from '../../src/services/packages.js';
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
  await prisma.calendarSyncLog.deleteMany();
  await prisma.notificationEvent.deleteMany();
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
    acceptedTerms: true,
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
  it('creates a reservation with payment details', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const payload = await reservationPayload(pack.id);
    const response = await request(app).post('/api/reservations').send(payload).expect(201);

    expect(response.body.data.reference).toBe(payload.expectedReference);
    expect(response.body.data.reference).toMatch(/^GSP/);
    expect(response.body.data.status).toBe(ReservationStatus.PENDING_CONFIRMATION);
    expect(response.body.data.payments[0].status).toBe(PaymentStatus.PENDING);
    expect(response.body.data.payments[0].transactionRef).toContain('MTN');

    const stored = await prisma.reservation.findUniqueOrThrow({
      where: { id: response.body.data.id },
      include: {
        packageVersion: true,
        transitions: true,
        payments: { include: { transitions: true } },
      },
    });
    expect(stored.packageVersion.version).toBe(1);
    expect(stored.transitions).toHaveLength(1);
    expect(stored.transitions[0].toStatus).toBe(ReservationStatus.PENDING_CONFIRMATION);
    expect(stored.payments[0].transitions[0].toStatus).toBe(PaymentStatus.PENDING);
  });

  it('rejects double bookings for blocking reservations', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const startAt = futureDateAt(11);

    await request(app).post('/api/reservations').send(await reservationPayload(pack.id, startAt)).expect(201);
    const response = await request(app)
      .post('/api/reservation-intents')
      .send({ packageId: pack.id, startAt: startAt.toISOString(), idempotencyKey: randomUUID() })
      .expect(409);

    expect(response.body.error.code).toBe('SLOT_ALREADY_RESERVED');
  });

  it('rejects a normalized duplicate payment reference for the same method', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const first = await reservationPayload(pack.id, futureDateAt(10));
    first.transactionRef = ' momo-ref-001 ';

    const second = await reservationPayload(pack.id, futureDateAt(12));
    second.transactionRef = 'MOMO-REF-001';

    await request(app).post('/api/reservations').send(first).expect(201);
    const response = await request(app).post('/api/reservations').send(second).expect(409);

    expect(response.body.error.code).toBe('PAYMENT_REFERENCE_ALREADY_USED');
  });

  it('allows a new booking when the previous booking was cancelled', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const startAt = futureDateAt(12);

    const first = await request(app).post('/api/reservations').send(await reservationPayload(pack.id, startAt)).expect(201);
    await prisma.reservation.update({
      where: { id: first.body.data.id },
      data: { status: ReservationStatus.CANCELLED },
    });

    await request(app).post('/api/reservations').send(await reservationPayload(pack.id, startAt)).expect(201);
  });

  it('marks unavailable slots caused by reservations and availability blocks', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const startAt = futureDateAt(10);
    const date = businessDateKey(startAt);

    await request(app).post('/api/reservations').send(await reservationPayload(pack.id, startAt)).expect(201);
    await prisma.availabilityBlock.create({
      data: {
        startAt: businessLocalToInstant(date, '14:00'),
        endAt: businessLocalToInstant(date, '15:00'),
        reason: 'Maintenance',
      },
    });

    const response = await request(app)
      .get('/api/availability')
      .query({ from: date, to: date, packageId: pack.id })
      .expect(200);

    const slots = response.body.data.days[0].slots;
    expect(slots.find((slot: { time: string }) => slot.time === '10:00')).toMatchObject({
      available: false,
      reason: 'reservation',
    });
    expect(slots.find((slot: { time: string }) => slot.time === '14:00')).toMatchObject({
      available: false,
      reason: 'availability_block',
    });
  });

  it('returns Douala wall-clock slots as canonical UTC instants', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const startAt = futureDateAt(9, 0);
    const date = businessDateKey(startAt);
    const response = await request(app)
      .get('/api/availability')
      .query({ from: date, to: date, packageId: pack.id })
      .expect(200);

    const slot = response.body.data.days[0].slots.find((item: { time: string }) => item.time === '09:00');
    expect(response.body.data.timeZone).toBe('Africa/Douala');
    expect(slot.startAt).toBe(startAt.toISOString());
    expect(slot.startAt.endsWith('08:00:00.000Z')).toBe(true);
  });

  it('reuses one server reference and reservation for idempotent retries', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const payload = await reservationPayload(pack.id, futureDateAt(13));
    const first = await request(app).post('/api/reservations').send(payload).expect(201);
    const retry = await request(app).post('/api/reservations').send(payload).expect(201);

    expect(first.body.data.reference).toBe(payload.expectedReference);
    expect(retry.body.data.id).toBe(first.body.data.id);
    expect(retry.body.data.reference).toBe(payload.expectedReference);
    expect(await prisma.reservation.count()).toBe(1);
    expect(await prisma.notificationEvent.count({ where: { reservationId: first.body.data.id } })).toBe(2);
  });

  it('allows only one concurrent hold for the same slot', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const startAt = futureDateAt(15);
    const attempts = await Promise.all([
      request(app)
        .post('/api/reservation-intents')
        .send({ packageId: pack.id, startAt: startAt.toISOString(), idempotencyKey: randomUUID() }),
      request(app)
        .post('/api/reservation-intents')
        .send({ packageId: pack.id, startAt: startAt.toISOString(), idempotencyKey: randomUUID() }),
    ]);

    expect(attempts.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await prisma.reservationIntent.count()).toBe(1);
  });

  it('rejects arbitrary operator transaction references', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const payload = await reservationPayload(pack.id, futureDateAt(16));
    payload.transactionRef = 'lalala';

    const response = await request(app).post('/api/reservations').send(payload).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'transactionRef' })]),
    );
  });

  it('rejects finalization after a slot hold expires', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const payload = await reservationPayload(pack.id, futureDateAt(17));
    await prisma.reservationIntent.update({
      where: { id: payload.intentId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await request(app).post('/api/reservations').send(payload).expect(409);
    expect(response.body.error.code).toBe('RESERVATION_INTENT_EXPIRED');
    expect(await prisma.reservation.count()).toBe(0);
  });
});

describe('lead capture', () => {
  it('creates contact leads', async () => {
    await request(app)
      .post('/api/contact')
      .send({
        submissionKey: randomUUID(),
        name: 'Contact Test',
        email: 'contact@example.test',
        phone: '+237699111111',
        subject: 'Question',
        message: 'I would like to know more about portrait sessions.',
      })
      .expect(201);

    const lead = await prisma.lead.findFirstOrThrow({ where: { email: 'contact@example.test' } });
    expect(lead.type).toBe('CONTACT');
  });

  it('rejects public form submissions that fill the honeypot field', async () => {
    const response = await request(app)
      .post('/api/contact')
      .send({
        submissionKey: randomUUID(),
        name: 'Bot Test',
        email: 'bot@example.test',
        subject: 'Spam',
        message: 'This should be rejected by bot protection.',
        website: 'https://spam.example.test',
      })
      .expect(400);

    expect(response.body.error.code).toBe('BOT_PROTECTION_FAILED');
  });

  it('creates B2B leads', async () => {
    await request(app)
      .post('/api/b2b-inquiries')
      .send({
        submissionKey: randomUUID(),
        company: 'Acme SARL',
        rccm: 'RCCM-TEST',
        name: 'B2B Test',
        email: 'b2b@example.test',
        phone: '+237699222222',
        subject: 'Corporate photos',
        message: 'We need corporate headshots for the whole team.',
      })
      .expect(201);

    const lead = await prisma.lead.findFirstOrThrow({ where: { email: 'b2b@example.test' } });
    expect(lead.type).toBe('B2B');
    expect(lead.company).toBe('Acme SARL');
  });

  it('deduplicates concurrent contact submissions and queues one notification', async () => {
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
    expect(await prisma.notificationEvent.count({ where: { leadId: first.body.data.id } })).toBe(1);
  });

  it('deduplicates concurrent B2B submissions and queues one notification', async () => {
    const submissionKey = randomUUID();
    const payload = {
      submissionKey,
      company: 'Double Click SARL',
      name: 'B2B Retry Test',
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
    expect(await prisma.notificationEvent.count({ where: { leadId: first.body.data.id } })).toBe(1);
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
    const agent = await loginAdmin();

    const response = await agent
      .patch(`/api/admin/payments/${paymentId}/verify`)
      .send({ status: PaymentStatus.VERIFIED, transactionRef: 'VERIFIED-TX-001' })
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
    const agent = await loginAdmin();

    const missingReason = await agent
      .patch(`/api/admin/payments/${paymentId}/verify`)
      .send({ status: PaymentStatus.REJECTED })
      .expect(400);
    expect(missingReason.body.error.code).toBe('PAYMENT_REASON_REQUIRED');

    const rejected = await agent
      .patch(`/api/admin/payments/${paymentId}/verify`)
      .send({ status: PaymentStatus.REJECTED, reason: 'Reference introuvable chez l operateur' })
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
    const previousStartAt = created.body.data.startAt;
    const newStartAt = futureDateAt(14, 30, 11);
    const agent = await loginAdmin();

    const response = await agent
      .patch(`/api/admin/reservations/${reservationId}/reschedule`)
      .send({ startAt: newStartAt.toISOString(), reason: 'Client disponible uniquement l’après-midi' })
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: reservationId,
      status: ReservationStatus.PENDING_CONFIRMATION,
      startAt: newStartAt.toISOString(),
      calendarSync: null,
    });
    expect(new Date(response.body.data.endAt).getTime() - new Date(response.body.data.startAt).getTime()).toBe(60 * 60_000);

    const stored = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      include: { transitions: { orderBy: { createdAt: 'desc' } }, notifications: true },
    });
    expect(stored.version).toBe(2);
    expect(stored.transitions[0]).toMatchObject({
      fromStatus: ReservationStatus.PENDING_CONFIRMATION,
      toStatus: ReservationStatus.PENDING_CONFIRMATION,
      reason: 'Client disponible uniquement l’après-midi',
      actorType: 'ADMIN',
    });
    expect(stored.transitions[0].oldStartAt?.toISOString()).toBe(previousStartAt);
    expect(stored.transitions[0].newStartAt?.toISOString()).toBe(newStartAt.toISOString());
    expect(stored.transitions[0].metadata).toMatchObject({ kind: 'RESCHEDULE' });
    expect(stored.notifications.some((event) => event.type === 'booking_rescheduled_customer')).toBe(true);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'reservation.reschedule', entityId: reservationId },
    });
    expect(audit.metadata).toMatchObject({ reason: 'Client disponible uniquement l’après-midi' });
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

    const response = await agent
      .patch(`/api/admin/reservations/${first.body.data.id}/reschedule`)
      .send({ startAt: occupiedStart.toISOString(), reason: 'Tentative de collision' })
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
      .patch(`/api/admin/reservations/${created.body.data.id}/reschedule`)
      .send({ startAt: futureDateAt(15, 0, 12).toISOString(), reason: 'Ne doit pas être accepté' })
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

    const response = await agent.patch(`/api/admin/packages/${pack.id}`).send({ price: 17000 }).expect(200);
    expect(response.body.data.version).toBe(2);
    expect(response.body.data.price).toBe(17000);

    const versions = await prisma.packageVersion.findMany({
      where: { packageId: pack.id },
      orderBy: { version: 'asc' },
    });
    const unchangedReservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.body.data.id },
      include: { packageVersion: true },
    });

    expect(versions.map((version) => version.price)).toEqual([15000, 17000]);
    expect(unchangedReservation.packageVersionId).toBe(original.packageVersionId);
    expect(unchangedReservation.packageVersion.price).toBe(15000);
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
    expect(updated.body.data.version).toBe(2);
    expect(updated.body.data.legalText).toBe('Texte de test');

    await agent.delete(`/api/admin/packages/${duplicated.body.data.id}`).expect(204);

    const source = await prisma.package.findFirstOrThrow({ where: { slug: 'test-portrait' } });
    const reservation = await reservationPayload(source.id, futureDateAt(14));
    await request(app).post('/api/reservations').send(reservation).expect(201);

    const protectedDelete = await agent.delete(`/api/admin/packages/${source.id}`).expect(409);
    expect(protectedDelete.body.error.code).toBe('PACKAGE_IN_USE');

    const archived = await agent
      .patch(`/api/admin/packages/${source.id}`)
      .send({ isArchived: true, isActive: false })
      .expect(200);
    expect(archived.body.data.isActive).toBe(false);
    expect(archived.body.data.isArchived).toBe(true);
  });

  it('returns actor, old state, new state and reason in reservation history', async () => {
    const pack = await prisma.package.findFirstOrThrow();
    const created = await request(app).post('/api/reservations').send(await reservationPayload(pack.id)).expect(201);
    const agent = await loginAdmin();

    await agent
      .patch(`/api/admin/reservations/${created.body.data.id}`)
      .send({ status: ReservationStatus.CONFIRMED })
      .expect(200);
    await agent
      .patch(`/api/admin/reservations/${created.body.data.id}`)
      .send({ status: ReservationStatus.CANCELLED, reason: 'Demande confirmée par téléphone' })
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
    const agent = await loginAdmin();

    const response = await agent
      .patch(`/api/admin/payments/${paymentId}/verify`)
      .send({ status: PaymentStatus.VERIFIED, transactionRef: 'lalala' })
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
    expect(await prisma.notificationEvent.count({ where: { reservationId: created.body.data.id } })).toBe(2);

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
