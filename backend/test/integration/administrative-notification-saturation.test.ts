import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../../src/db/prisma.js';
import { AdminRole, NotificationStatus } from '../../src/generated/prisma/client.js';
import {
  administrativeSuppressionReason,
  enqueueInternalEmailNotification,
} from '../../src/emails/internal-notification-policy.js';

const resetDatabase = async () => {
  await prisma.notificationEvent.deleteMany();
  await prisma.adminUser.deleteMany();
};

const createAdmin = (role: AdminRole, label: string) => prisma.adminUser.create({
  data: {
    email: `${label}-${randomUUID().slice(0, 8)}@example.test`,
    name: label,
    passwordHash: 'not-used-by-integration-test',
    role,
  },
});

const baseNotification = (recipient: string, templateCode = 'I-04') => ({
  type: 'post_02_policy_test_admin',
  recipient,
  idempotencyKey: `post-02:${randomUUID()}`,
  templateCode,
  templateVersion: 'TEST',
  renderedContent: { audience: 'admin', code: templateCode, subject: 'Test', text: 'Test', html: '<p>Test</p>' },
  metadata: { templateCode },
});

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('POST-02 administrative anti-saturation policy', () => {
  it('suppresses an OWNER alert addressed to the same nominative mailbox and audits no address', async () => {
    const owner = await createAdmin(AdminRole.OWNER, 'owner-self');
    const event = await enqueueInternalEmailNotification({
      ...baseNotification(owner.email),
      actor: owner,
      destination: { type: 'NOMINATIVE', adminUserId: owner.id },
    });

    expect(event).toMatchObject({
      status: NotificationStatus.CANCELLED,
      providerStatus: 'suppressed_self_nominative',
      resolution: 'SUPPRESSED',
      resolutionNote: 'SELF_NOMINATIVE_REDUNDANT',
      resolvedBy: 'SYSTEM',
    });
    expect(event.metadata).toMatchObject({
      audience: 'ADMIN',
      destinationType: 'NOMINATIVE',
      actorType: 'ADMIN',
      actorAdminUserId: owner.id,
      destinationAdminUserId: owner.id,
      suppressionReason: 'SELF_NOMINATIVE_REDUNDANT',
    });
    expect(JSON.stringify(event.metadata)).not.toContain(owner.email);
  });

  it('keeps the shared operational mailbox even when its address equals the OWNER address', async () => {
    const owner = await createAdmin(AdminRole.OWNER, 'owner-shared');
    const event = await enqueueInternalEmailNotification({
      ...baseNotification(owner.email),
      actor: owner,
      destination: { type: 'SHARED_OPERATIONAL' },
    });

    expect(event).toMatchObject({ status: NotificationStatus.PENDING, resolution: null });
    expect(event.metadata).toMatchObject({
      audience: 'ADMIN',
      destinationType: 'SHARED_OPERATIONAL',
      actorAdminUserId: owner.id,
    });
  });

  it('keeps a STAFF alert addressed to a different OWNER', async () => {
    const [staff, owner] = await Promise.all([
      createAdmin(AdminRole.STAFF, 'staff-actor'),
      createAdmin(AdminRole.OWNER, 'owner-recipient'),
    ]);
    const event = await enqueueInternalEmailNotification({
      ...baseNotification(owner.email),
      actor: staff,
      destination: { type: 'NOMINATIVE', adminUserId: owner.id },
    });

    expect(event.status).toBe(NotificationStatus.PENDING);
    expect(event.metadata).toMatchObject({
      actorAdminUserId: staff.id,
      destinationAdminUserId: owner.id,
    });
  });

  it('keeps a worker alert without an actor and never suppresses terminal integrity alerts', async () => {
    const owner = await createAdmin(AdminRole.OWNER, 'owner-terminal');
    const worker = await enqueueInternalEmailNotification({
      ...baseNotification(owner.email),
      destination: { type: 'NOMINATIVE', adminUserId: owner.id },
    });
    const terminal = await enqueueInternalEmailNotification({
      ...baseNotification(owner.email, 'I-10'),
      actor: owner,
      destination: { type: 'NOMINATIVE', adminUserId: owner.id },
    });

    expect(worker.status).toBe(NotificationStatus.PENDING);
    expect(worker.metadata).toMatchObject({ actorType: 'SYSTEM' });
    expect(terminal.status).toBe(NotificationStatus.PENDING);
  });

  it('never applies the administrative filter to a customer recipient', async () => {
    const owner = await createAdmin(AdminRole.OWNER, 'owner-customer');
    expect(administrativeSuppressionReason({
      audience: 'CUSTOMER',
      recipient: owner.email,
      actor: owner,
      destination: { type: 'NOMINATIVE', adminUserId: owner.id },
      templateCode: 'E-05',
    })).toBeNull();
  });

  it('records one suppression under replay and concurrent producers', async () => {
    const owner = await createAdmin(AdminRole.OWNER, 'owner-concurrent');
    const input = {
      ...baseNotification(owner.email),
      actor: owner,
      destination: { type: 'NOMINATIVE' as const, adminUserId: owner.id },
    };
    const events = await Promise.all([
      enqueueInternalEmailNotification(input),
      enqueueInternalEmailNotification(input),
    ]);
    const replay = await enqueueInternalEmailNotification(input);

    expect(new Set([...events, replay].map((event) => event.id)).size).toBe(1);
    expect(await prisma.notificationEvent.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
    expect(replay).toMatchObject({
      status: NotificationStatus.CANCELLED,
      attemptCount: 0,
      resolutionNote: 'SELF_NOMINATIVE_REDUNDANT',
    });
  });
});
