import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { AdminRole } from '../../src/generated/prisma/client.js';

const app = createApp();
const password = 'adm-07b-order-password';

const resetDatabase = async () => {
  // This suite shares its database with the rest of the integration tests. A payment
  // left by an earlier suite references its reservation, so delete the dependent row
  // first. Keeping the reset in one transaction also prevents a partial cleanup from
  // becoming the starting state for the next test when a delete fails.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notificationEvent.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.reservation.deleteMany(),
    prisma.reservationIntent.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.packageVersion.deleteMany(),
    prisma.package.deleteMany(),
    prisma.adminUser.deleteMany(),
  ]);
};

const seed = async () => {
  await prisma.adminUser.create({
    data: { email: 'adm-07b@example.test', name: 'Owner', passwordHash: await bcrypt.hash(password, 4), role: AdminRole.OWNER },
  });
  // Spaced in tens, exactly as the live catalogue is.
  const names = ['Alpha', 'Bravo', 'Charlie'];
  const created = [];
  for (const [index, name] of names.entries()) {
    created.push(await prisma.package.create({
      data: { slug: name.toLowerCase(), name, category: 'Tests', price: 1000, durationMin: 60, sortOrder: (index + 1) * 10 },
    }));
  }
  return created;
};

const signIn = async () => {
  const agent = request.agent(app);
  await agent.post('/api/admin/login').send({ email: 'adm-07b@example.test', password }).expect(200);
  return agent;
};

const orderNames = async () => (await prisma.package.findMany({ orderBy: { sortOrder: 'asc' }, select: { name: true } })).map((item) => item.name);

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('§6.2 the catalogue order is a property of the list', () => {
  it('moves a formula one place instead of writing a value that changes nothing', async () => {
    const [alpha, bravo, charlie] = await seed();
    const agent = await signIn();

    // The previous behaviour wrote sortOrder - 1: 20 became 19, still after Alpha at 10,
    // so the arrow appeared to work and moved nothing.
    await prisma.package.update({ where: { id: bravo.id }, data: { sortOrder: bravo.sortOrder - 1 } });
    expect(await orderNames()).toEqual(['Alpha', 'Bravo', 'Charlie']);

    await agent.post('/api/admin/packages/reorder')
      .send({ orderedIds: [bravo.id, alpha.id, charlie.id] })
      .expect(200);
    expect(await orderNames()).toEqual(['Bravo', 'Alpha', 'Charlie']);
  });

  it('respaces the catalogue in tens so the next move has room', async () => {
    const [alpha, bravo, charlie] = await seed();
    const agent = await signIn();
    await agent.post('/api/admin/packages/reorder').send({ orderedIds: [charlie.id, bravo.id, alpha.id] }).expect(200);
    const rows = await prisma.package.findMany({ orderBy: { sortOrder: 'asc' }, select: { name: true, sortOrder: true } });
    expect(rows).toEqual([
      { name: 'Charlie', sortOrder: 10 },
      { name: 'Bravo', sortOrder: 20 },
      { name: 'Alpha', sortOrder: 30 },
    ]);
  });

  it('refuses a partial order rather than leaving the formulas it omits at stale positions', async () => {
    const [alpha, bravo] = await seed();
    const agent = await signIn();
    const { body } = await agent.post('/api/admin/packages/reorder').send({ orderedIds: [bravo.id, alpha.id] }).expect(422);
    expect(body.error.code).toBe('PACKAGE_ORDER_INCOMPLETE');
    expect(await orderNames()).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('refuses a duplicate and an unknown formula', async () => {
    const [alpha, bravo, charlie] = await seed();
    const agent = await signIn();
    await agent.post('/api/admin/packages/reorder').send({ orderedIds: [alpha.id, alpha.id, bravo.id] }).expect(422);
    await agent.post('/api/admin/packages/reorder').send({ orderedIds: [alpha.id, bravo.id, charlie.id, 'ghost'] }).expect(404);
    expect(await orderNames()).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('records the move, and creates no tariff version', async () => {
    const [alpha, bravo, charlie] = await seed();
    const agent = await signIn();
    await agent.post('/api/admin/packages/reorder').send({ orderedIds: [charlie.id, alpha.id, bravo.id] }).expect(200);
    // Nothing a client reads has changed, so no new version is cut.
    expect(await prisma.packageVersion.count()).toBe(0);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'package.reorder' } });
    expect(log.metadata).toMatchObject({ orderedIds: [charlie.id, alpha.id, bravo.id] });
  });
});
