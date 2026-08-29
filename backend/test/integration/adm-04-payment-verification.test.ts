import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { AdminRole, PaymentStatus, ReservationStatus } from '../../src/generated/prisma/client.js';
import { paymentAmountVariance } from '../../src/services/payments.js';

const app = createApp();
const password = 'adm-04-admin-password';

const resetDatabase = async () => {
  await prisma.notificationEvent.deleteMany();
  await prisma.financialTask.deleteMany();
  await prisma.adminCommand.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.paymentTransition.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.reservationTransition.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.packageVersionLocale.deleteMany();
  await prisma.packageVersion.deleteMany();
  await prisma.package.deleteMany();
  await prisma.adminUser.deleteMany();
};

const seed = async () => {
  const owner = await prisma.adminUser.create({
    data: { email: 'adm-04-owner@example.test', name: 'ADM-04 Owner', passwordHash: await bcrypt.hash(password, 4), role: AdminRole.OWNER },
  });
  const staff = await prisma.adminUser.create({
    data: { email: 'adm-04-staff@example.test', name: 'ADM-04 Staff', passwordHash: await bcrypt.hash(password, 4), role: AdminRole.STAFF },
  });
  const pack = await prisma.package.create({
    data: { slug: 'adm-04-pack', name: 'ADM-04 Portrait', category: 'ADM-04', price: 25_000, durationMin: 60 },
  });
  const packVersion = await prisma.packageVersion.create({
    data: {
      packageId: pack.id, version: 1, name: 'ADM-04 Portrait', category: 'ADM-04',
      price: 25_000, durationMin: 60, createdById: owner.id,
    },
  });
  const customer = await prisma.customer.create({
    data: { firstName: 'Amina', lastName: 'Paiement', phone: '+237640703249', email: 'amina@example.test' },
  });

  const makeReservation = async (reference: string, ref: string, normalized: string, method: string, declared: number | null) => {
    const reservation = await prisma.reservation.create({
      data: {
        reference, customerId: customer.id, packageId: pack.id, packageVersionId: packVersion.id,
        startAt: new Date('2030-05-05T09:00:00.000Z'), endAt: new Date('2030-05-05T10:00:00.000Z'),
        status: ReservationStatus.PENDING_CONFIRMATION,
      },
    });
    const payment = await prisma.payment.create({
      data: {
        reservationId: reservation.id, amount: 25_000, declaredAmount: declared,
        method, transactionRef: ref, transactionRefNormalized: normalized,
        paymentPhone: '+237690000000', status: PaymentStatus.PENDING,
      },
    });
    return { reservation, payment };
  };

  const first = await makeReservation('GSP-ADM04-0001', 'TXN-111', 'TXN111', 'mtn_momo', null);
  const second = await makeReservation('GSP-ADM04-0002', 'TXN-111', 'TXN111', 'orange_money', 20_000);
  const third = await makeReservation('GSP-ADM04-0003', 'TXN-222', 'TXN222', 'mtn_momo', 25_000);
  return { owner, staff, first, second, third };
};

const signIn = async (email: string) => {
  const agent = request.agent(app);
  await agent.post('/api/admin/login').send({ email, password }).expect(200);
  return agent;
};

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('ADM-04 payment verification queue', () => {
  it('separates an unrecorded declared amount from one that matches', async () => {
    expect(paymentAmountVariance({ amount: 25_000, declaredAmount: null })).toBeNull();
    expect(paymentAmountVariance({ amount: 25_000, declaredAmount: 25_000 })).toBe(0);
    expect(paymentAmountVariance({ amount: 25_000, declaredAmount: 20_000 })).toBe(-5_000);
  });

  it('lists every payment with a variance and a total', async () => {
    await seed();
    const agent = await signIn('adm-04-owner@example.test');
    const response = await agent.get('/api/admin/payments').expect(200);

    expect(response.body.meta.total).toBe(3);
    expect(response.body.data).toHaveLength(3);
    const byReference = Object.fromEntries(response.body.data.map((row: { reservation: { reference: string } }) => [row.reservation.reference, row]));
    expect(byReference['GSP-ADM04-0001'].amountVariance).toBeNull();
    expect(byReference['GSP-ADM04-0002'].amountVariance).toBe(-5_000);
    expect(byReference['GSP-ADM04-0003'].amountVariance).toBe(0);
  });

  it('finds a record by transaction code, payer phone, reference and customer name', async () => {
    await seed();
    const agent = await signIn('adm-04-owner@example.test');
    for (const [term, expected] of [['TXN-222', 1], ['txn222', 1], ['+237690000000', 3], ['GSP-ADM04-0001', 1], ['Amina', 3]] as const) {
      const response = await agent.get('/api/admin/payments').query({ q: term }).expect(200);
      expect(response.body.data.length, `search "${term}"`).toBe(expected);
    }
  });

  it('filters the open queue and the amount mismatches', async () => {
    await seed();
    const agent = await signIn('adm-04-owner@example.test');

    const open = await agent.get('/api/admin/payments').query({ open: 'true' }).expect(200);
    expect(open.body.data).toHaveLength(3);

    // A recorded amount equal to the expected one is not a mismatch.
    const mismatch = await agent.get('/api/admin/payments').query({ mismatch: 'true' }).expect(200);
    expect(mismatch.body.data).toHaveLength(1);
    expect(mismatch.body.data[0].reservation.reference).toBe('GSP-ADM04-0002');
  });

  it('surfaces the duplicate the unique index can only refuse', async () => {
    const { first, second } = await seed();
    const agent = await signIn('adm-04-owner@example.test');

    const candidates = await agent.get(`/api/admin/payments/${first.payment.id}/duplicates`).expect(200);
    expect(candidates.body.data.map((row: { id: string }) => row.id)).toContain(second.payment.id);

    await agent.patch(`/api/admin/payments/${second.payment.id}/duplicate`)
      .send({ duplicateOfPaymentId: first.payment.id, reason: 'Même référence sur un autre opérateur.' })
      .expect(200);

    const flagged = await agent.get('/api/admin/payments').query({ duplicate: 'true' }).expect(200);
    expect(flagged.body.data).toHaveLength(2);

    const audits = await prisma.auditLog.findMany({ where: { action: 'payment.duplicate.link' } });
    expect(audits).toHaveLength(1);
  });

  it('refuses a self-referencing duplicate and a chain of duplicates', async () => {
    const { first, second, third } = await seed();
    const agent = await signIn('adm-04-owner@example.test');

    await agent.patch(`/api/admin/payments/${first.payment.id}/duplicate`)
      .send({ duplicateOfPaymentId: first.payment.id, reason: 'test' })
      .expect(400);

    await agent.patch(`/api/admin/payments/${second.payment.id}/duplicate`)
      .send({ duplicateOfPaymentId: first.payment.id, reason: 'test' })
      .expect(200);
    await agent.patch(`/api/admin/payments/${third.payment.id}/duplicate`)
      .send({ duplicateOfPaymentId: second.payment.id, reason: 'test' })
      .expect(409);
  });

  it('records a declared amount under an optimistic version and audits it', async () => {
    const { first } = await seed();
    const agent = await signIn('adm-04-owner@example.test');

    const stale = await agent.patch(`/api/admin/payments/${first.payment.id}/declared-amount`)
      .send({ commandId: crypto.randomUUID(), expectedVersion: 99, declaredAmount: 24_000, reason: 'Relevé opérateur' });
    expect(stale.status).toBe(409);

    const ok = await agent.patch(`/api/admin/payments/${first.payment.id}/declared-amount`)
      .send({ commandId: crypto.randomUUID(), expectedVersion: first.payment.version, declaredAmount: 24_000, reason: 'Relevé opérateur' })
      .expect(200);
    expect(ok.body.data.declaredAmount).toBe(24_000);
    expect(ok.body.data.amountVariance).toBe(-1_000);

    const audit = await prisma.auditLog.findFirst({ where: { action: 'payment.declared_amount' } });
    expect(audit).not.toBeNull();
  });

  it('exports the queue as CSV, audited, with formula injection neutralised', async () => {
    const { first } = await seed();
    await prisma.payment.update({ where: { id: first.payment.id }, data: { transactionRef: '=cmd|calc' } });
    const agent = await signIn('adm-04-owner@example.test');

    const response = await agent.get('/api/admin/payments/export.csv').expect(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text.split('\r\n')[0]).toContain('"expected_amount","declared_amount","variance"');
    expect(response.text).toContain('"\'=cmd|calc"');

    const audit = await prisma.auditLog.findFirst({ where: { action: 'payment.export' } });
    expect(audit).not.toBeNull();
  });

  it('lets staff read the queue while every money decision stays with the owner', async () => {
    const { first } = await seed();
    const staffAgent = await signIn('adm-04-staff@example.test');

    // Triage is a read, so staff may do it.
    await staffAgent.get('/api/admin/payments').expect(200);
    await staffAgent.get(`/api/admin/payments/${first.payment.id}`).expect(200);
    await staffAgent.get(`/api/admin/payments/${first.payment.id}/duplicates`).expect(200);

    // Deciding, annotating, exporting and refunding remain owner-only.
    await staffAgent.get('/api/admin/payments/export.csv').expect(403);
    await staffAgent.patch(`/api/admin/payments/${first.payment.id}/declared-amount`)
      .send({ commandId: crypto.randomUUID(), expectedVersion: first.payment.version, declaredAmount: 1, reason: 'test' })
      .expect(403);
    await staffAgent.patch(`/api/admin/payments/${first.payment.id}/duplicate`)
      .send({ duplicateOfPaymentId: null, reason: 'test' })
      .expect(403);
    await staffAgent.get('/api/admin/financial-tasks').expect(403);
  });
});
