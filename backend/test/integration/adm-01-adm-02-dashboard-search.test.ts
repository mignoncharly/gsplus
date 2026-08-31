import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { AdminRole, PaymentStatus, ReservationStatus } from '../../src/generated/prisma/client.js';
import { buildAdminDashboard } from '../../src/services/admin-dashboard.js';

const app = createApp();
const password = 'adm-01-admin-password';

const resetDatabase = async () => {
  await prisma.notificationEvent.deleteMany();
  await prisma.financialTask.deleteMany();
  await prisma.calendarSyncLog.deleteMany();
  await prisma.adminCommand.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.paymentTransition.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.reservationRescheduleRequest.deleteMany();
  await prisma.reservationTransition.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.packageVersionLocale.deleteMany();
  await prisma.packageVersion.deleteMany();
  await prisma.package.deleteMany();
  await prisma.adminUser.deleteMany();
};

const seed = async () => {
  const owner = await prisma.adminUser.create({
    data: { email: 'adm-01-owner@example.test', name: 'Owner', passwordHash: await bcrypt.hash(password, 4), role: AdminRole.OWNER },
  });
  const pack = await prisma.package.create({
    data: { slug: 'adm-01-pack', name: 'Portrait Signature', category: 'ADM-01', price: 25_000, durationMin: 60 },
  });
  const other = await prisma.package.create({
    data: { slug: 'adm-01-other', name: 'Maternité Or', category: 'ADM-01', price: 40_000, durationMin: 90 },
  });
  const version = await prisma.packageVersion.create({
    data: { packageId: pack.id, version: 1, name: 'Portrait Signature', category: 'ADM-01', price: 25_000, durationMin: 60, createdById: owner.id },
  });
  const otherVersion = await prisma.packageVersion.create({
    data: { packageId: other.id, version: 1, name: 'Maternité Or', category: 'ADM-01', price: 40_000, durationMin: 90, createdById: owner.id },
  });

  const make = async (opts: {
    reference: string; first: string; last: string; phone: string; email: string;
    status: ReservationStatus; startAt: string; packageId: string; packageVersionId: string;
    payment?: { status: PaymentStatus; amount: number; ref?: string };
    snapshotName?: { first: string; last: string };
  }) => {
    const customer = await prisma.customer.create({
      data: { firstName: opts.first, lastName: opts.last, phone: opts.phone, email: opts.email },
    });
    const reservation = await prisma.reservation.create({
      data: {
        reference: opts.reference, customerId: customer.id, packageId: opts.packageId,
        packageVersionId: opts.packageVersionId, status: opts.status,
        startAt: new Date(opts.startAt), endAt: new Date(new Date(opts.startAt).getTime() + 3_600_000),
      },
    });
    if (opts.snapshotName) {
      await prisma.reservationSnapshot.create({
        data: {
          reservationId: reservation.id, locale: 'fr',
          firstName: opts.snapshotName.first, lastName: opts.snapshotName.last,
          phoneRaw: opts.phone, phoneE164: opts.phone, email: opts.email,
          notificationPhoneE164: opts.phone, notificationEmail: opts.email,
          packageId: opts.packageId, packageVersionId: opts.packageVersionId, packageVersion: 1,
          packageName: 'Portrait Signature', durationMin: 60, amount: 25_000, currency: 'XAF',
          startAt: reservation.startAt, endAt: reservation.endAt,
          termsAccepted: true, termsVersion: 'test', termsAcceptedAt: new Date(),
          privacyAccepted: true, privacyVersion: 'test', privacyAcceptedAt: new Date(),
          whatsappConsent: false, imageConsent: false, imageAuthorizationVersion: 'test',
          source: 'test',
        },
      });
    }
    if (opts.payment) {
      await prisma.payment.create({
        data: {
          reservationId: reservation.id, amount: opts.payment.amount, method: 'mtn_momo',
          transactionRef: opts.payment.ref ?? `REF-${opts.reference}`,
          transactionRefNormalized: (opts.payment.ref ?? `REF-${opts.reference}`).replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
          status: opts.payment.status,
          ...(opts.payment.status === PaymentStatus.REFUNDED ? { refundAmount: opts.payment.amount, refundedAt: new Date() } : {}),
        },
      });
    }
    return reservation;
  };

  const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
  await make({ reference: 'GSP-A-0001', first: 'Amina', last: 'Ngo', phone: '+237640703249', email: 'amina@example.test', status: ReservationStatus.PENDING_CONFIRMATION, startAt: soon, packageId: pack.id, packageVersionId: version.id, payment: { status: PaymentStatus.PENDING, amount: 25_000, ref: 'TXN-AAA' } });
  await make({ reference: 'GSP-B-0002', first: 'Bruno', last: 'Kamga', phone: '+237699111222', email: 'bruno@example.test', status: ReservationStatus.CONFIRMED, startAt: soon, packageId: pack.id, packageVersionId: version.id, payment: { status: PaymentStatus.VERIFIED, amount: 25_000, ref: 'TXN-BBB' } });
  // Cancelled but paid: the money must not read as income.
  await make({ reference: 'GSP-C-0003', first: 'Chantal', last: 'Etoa', phone: '+237677333444', email: 'chantal@example.test', status: ReservationStatus.CANCELLED, startAt: soon, packageId: other.id, packageVersionId: otherVersion.id, payment: { status: PaymentStatus.VERIFIED, amount: 40_000, ref: 'TXN-CCC' } });
  // The live customer row was edited after booking; the snapshot keeps the old name.
  await make({ reference: 'GSP-D-0004', first: 'Nouveau', last: 'Nom', phone: '+237688555666', email: 'd@example.test', status: ReservationStatus.CONFIRMED, startAt: soon, packageId: pack.id, packageVersionId: version.id, snapshotName: { first: 'Ancien', last: 'Patronyme' } });

  await prisma.lead.create({ data: { reference: 'CONTACT-1', type: 'CONTACT', status: 'NEW', name: 'Lead One', message: 'Bonjour' } });
  await prisma.lead.create({ data: { reference: 'CONTACT-2', type: 'B2B', status: 'IN_PROGRESS', name: 'Lead Two', message: 'Bonjour' } });
  return { owner, pack };
};

const signIn = async () => {
  const agent = request.agent(app);
  await agent.post('/api/admin/login').send({ email: 'adm-01-owner@example.test', password }).expect(200);
  return agent;
};

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('ADM-02 reservation search', () => {
  it('returns a total so the list is no longer a blind 50-row window', async () => {
    await seed();
    const agent = await signIn();
    const response = await agent.get('/api/admin/reservations').query({ limit: 2 }).expect(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta.total).toBe(4);
  });

  it('finds a record by any business datum, in fewer than three actions', async () => {
    await seed();
    const agent = await signIn();
    for (const [term, expected] of [
      ['GSP-A-0001', 1], ['Amina', 1], ['amina@example.test', 1],
      ['640703249', 1], ['TXN-BBB', 1], ['Portrait Signature', 3],
    ] as const) {
      const response = await agent.get('/api/admin/reservations').query({ q: term }).expect(200);
      expect(response.body.meta.total, `search "${term}"`).toBe(expected);
    }
  });

  it('searches the frozen snapshot as well as the edited customer row', async () => {
    await seed();
    const agent = await signIn();
    // The customer was renamed after booking; both names must still find the record.
    const bySnapshot = await agent.get('/api/admin/reservations').query({ q: 'Ancien' }).expect(200);
    expect(bySnapshot.body.meta.total).toBe(1);
    const byCustomer = await agent.get('/api/admin/reservations').query({ q: 'Nouveau' }).expect(200);
    expect(byCustomer.body.meta.total).toBe(1);
    expect(byCustomer.body.data[0].reference).toBe('GSP-D-0004');
  });

  it('applies the status and payment filters the previous schema only declared', async () => {
    await seed();
    const agent = await signIn();
    const confirmed = await agent.get('/api/admin/reservations').query({ status: 'CONFIRMED' }).expect(200);
    expect(confirmed.body.meta.total).toBe(2);

    const verified = await agent.get('/api/admin/reservations').query({ payment: 'VERIFIED' }).expect(200);
    expect(verified.body.meta.total).toBe(2);

    const withoutPayment = await agent.get('/api/admin/reservations').query({ payment: 'NONE' }).expect(200);
    expect(withoutPayment.body.meta.total).toBe(1);
    expect(withoutPayment.body.data[0].reference).toBe('GSP-D-0004');
  });

  it('filters reservations by pending reschedule request', async () => {
    await seed();
    const agent = await signIn();
    const reservation = await prisma.reservation.findUniqueOrThrow({ where: { reference: 'GSP-B-0002' } });
    await prisma.reservationRescheduleRequest.create({
      data: {
        reservationId: reservation.id, commandId: 'adm-02-pending-reschedule', reservationVersionAtRequest: reservation.version,
        oldStartAt: reservation.startAt, oldEndAt: reservation.endAt,
        requestedStartAt: new Date(reservation.startAt.getTime() + 86_400_000), requestedEndAt: new Date(reservation.endAt.getTime() + 86_400_000),
        reason: 'Le client demande un autre créneau',
      },
    });
    const response = await agent.get('/api/admin/reservations').query({ rescheduleStatus: 'PENDING' }).expect(200);
    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].reference).toBe('GSP-B-0002');
  });

  it('keeps the historical exact-reference lookup working', async () => {
    await seed();
    const agent = await signIn();
    const response = await agent.get('/api/admin/reservations').query({ reference: 'gsp-a-0001' }).expect(200);
    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].reference).toBe('GSP-A-0001');
  });

  it('sorts on the requested column and direction', async () => {
    await seed();
    const agent = await signIn();
    const ascending = await agent.get('/api/admin/reservations').query({ sort: 'reference', direction: 'asc' }).expect(200);
    expect(ascending.body.data.map((row: { reference: string }) => row.reference)).toEqual(['GSP-A-0001', 'GSP-B-0002', 'GSP-C-0003', 'GSP-D-0004']);
  });
});

describe('ADM-01 decision-first dashboard', () => {
  it('counts every queue in the database, not from a page of rows', async () => {
    await seed();
    const dashboard = await buildAdminDashboard();
    const byKey = Object.fromEntries(
      [...dashboard.toHandle, ...dashboard.finance, ...dashboard.integrations, ...dashboard.requests, ...dashboard.today]
        .map((entry) => [entry.key, entry]),
    );
    expect(byKey.paymentsToVerify.count).toBe(1);
    expect(byKey.reservationsToDecide.count).toBe(1);
    expect(byKey.newRequests.count).toBe(1);
  });

  it('does not count a verified payment on a cancelled booking as income', async () => {
    await seed();
    const dashboard = await buildAdminDashboard();
    // 25 000 verified on an active booking; 40 000 verified on a cancelled one.
    expect(dashboard.summary.revenue.onActiveReservations).toBe(25_000);
    expect(dashboard.summary.revenue.onCancelledReservations).toBe(40_000);
    expect(dashboard.summary.revenue.net).toBe(25_000);
  });

  it('gives every counter a link that opens the list it counts', async () => {
    await seed();
    const agent = await signIn();
    const response = await agent.get('/api/admin/dashboard').expect(200);
    const zones = [
      ...response.body.data.toHandle, ...response.body.data.today,
      ...response.body.data.finance, ...response.body.data.integrations, ...response.body.data.requests,
    ];
    expect(zones.length).toBeGreaterThanOrEqual(9);
    for (const entry of zones) {
      expect(entry.href, `${entry.key} needs a destination`).toMatch(/^\/admin\//);
      expect(typeof entry.count).toBe('number');
      expect(entry.label).toBeTruthy();
    }
  });

  it('opens the exact set of failed and retrying Cal.com operations', async () => {
    await seed();
    const agent = await signIn();
    await prisma.calendarSyncLog.createMany({ data: [
      { status: 'FAILED', action: 'CREATE', error: 'Provider unavailable' },
      { status: 'RETRYING', action: 'UPDATE', error: 'Retry scheduled' },
      { status: 'SYNCED', action: 'CANCEL' },
    ] });
    const dashboard = await agent.get('/api/admin/dashboard').expect(200);
    const counter = dashboard.body.data.integrations.find((entry: { key: string }) => entry.key === 'calendarFailures');
    const params = new URLSearchParams(counter.href.split('?')[1]);
    const list = await agent.get('/api/admin/calendar/sync-logs').query({ status: params.getAll('calendarStatus') }).expect(200);
    expect(counter.count).toBe(2);
    expect(list.body.meta.total).toBe(counter.count);
    expect(list.body.data.map((item: { status: string }) => item.status).sort()).toEqual(['FAILED', 'RETRYING']);
  });


  it('agrees with the list its link opens', async () => {
    await seed();
    const agent = await signIn();
    const dashboard = await agent.get('/api/admin/dashboard').expect(200);
    const toDecide = dashboard.body.data.toHandle.find((entry: { key: string }) => entry.key === 'reservationsToDecide');

    // Follow the counter's own link and compare with the list it produces.
    const query = Object.fromEntries(new URLSearchParams(toDecide.href.split('?')[1]));
    const list = await agent.get('/api/admin/reservations').query(query).expect(200);
    expect(list.body.meta.total).toBe(toDecide.count);
  });
});
