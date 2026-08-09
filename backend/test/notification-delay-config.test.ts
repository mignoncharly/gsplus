import { afterEach, describe, expect, it, vi } from 'vitest';

describe('NOTIF-01 configurable notification delays', () => {
  const originalNotice = process.env.PAYMENT_VERIFIED_NOTICE_DELAY_MS;
  const originalOverdue = process.env.PAYMENT_DECISION_OVERDUE_DELAY_MS;

  afterEach(() => {
    if (originalNotice === undefined) delete process.env.PAYMENT_VERIFIED_NOTICE_DELAY_MS;
    else process.env.PAYMENT_VERIFIED_NOTICE_DELAY_MS = originalNotice;
    if (originalOverdue === undefined) delete process.env.PAYMENT_DECISION_OVERDUE_DELAY_MS;
    else process.env.PAYMENT_DECISION_OVERDUE_DELAY_MS = originalOverdue;
    vi.resetModules();
  });

  it('defaults the E-03 grouping window to five minutes and I-03 escalation to thirty minutes', async () => {
    delete process.env.PAYMENT_VERIFIED_NOTICE_DELAY_MS;
    delete process.env.PAYMENT_DECISION_OVERDUE_DELAY_MS;
    vi.resetModules();
    const { env } = await import('../src/config/env.js');
    expect(env.PAYMENT_VERIFIED_NOTICE_DELAY_MS).toBe(5 * 60 * 1000);
    expect(env.PAYMENT_DECISION_OVERDUE_DELAY_MS).toBe(30 * 60 * 1000);
  });

  it('reads the E-03 grouping window and I-03 escalation delay from configured environment variables', async () => {
    process.env.PAYMENT_VERIFIED_NOTICE_DELAY_MS = String(2 * 60 * 1000);
    process.env.PAYMENT_DECISION_OVERDUE_DELAY_MS = String(45 * 60 * 1000);
    vi.resetModules();
    const { env } = await import('../src/config/env.js');
    expect(env.PAYMENT_VERIFIED_NOTICE_DELAY_MS).toBe(2 * 60 * 1000);
    expect(env.PAYMENT_DECISION_OVERDUE_DELAY_MS).toBe(45 * 60 * 1000);
  });
});
