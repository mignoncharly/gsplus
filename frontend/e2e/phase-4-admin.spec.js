import { expect, test } from '@playwright/test';

const reservation = {
  id: 'reservation-phase-4', reference: 'GSP-260821-P4AA', status: 'CONFIRMED',
  startAt: '2026-08-24T09:00:00.000Z', endAt: '2026-08-24T10:00:00.000Z',
  scheduleKind: 'CATALOGUE_SLOT', package: { id: 'pack-p4', name: 'Portrait Phase 4', price: 50000 },
  snapshot: { firstName: 'Alice', lastName: 'Phase 4', notificationPhoneE164: '+237640703249', notificationEmail: 'alice@example.test', locale: 'fr' },
  payments: [], transitions: [], calendarSyncLogs: [], rescheduleRequests: [], withdrawalRequests: [],
};
const lead = {
  id: 'lead-phase-4', reference: 'B2B-260821-P4BB', type: 'B2B', status: 'NEW',
  name: 'Brice Phase 4', company: 'Entreprise Phase 4', email: 'brice@example.test',
  phone: '+237670000000', subject: 'Identité visuelle', source: 'corporate', message: 'Demande de devis.',
};
const task = {
  id: 'task-phase-4', dedupeKey: 'refund:phase-4', type: 'FULL_REFUND', status: 'IN_PROGRESS',
  amount: 50000, reason: 'Annulation studio', dueAt: '2026-08-22T09:00:00.000Z',
  channel: 'MTN Mobile Money', providerReference: 'P4-ENGAGED', initiatedAt: '2026-08-21T09:00:00.000Z',
  completedAt: null, createdAt: '2026-08-21T08:00:00.000Z', proof: null,
  createdBy: { id: 'owner-phase-4', name: 'Owner Phase 4' },
  reservation,
  payment: { id: 'payment-phase-4', version: 3, method: 'mtn_momo', status: 'REFUND_PENDING', amount: 50000, refundAmount: 50000 },
};
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const installApi = async (page, authenticated = true) => {
  let session = authenticated;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/login' && request.method() === 'POST') {
      session = true;
      return json(route, { data: { id: 'owner-phase-4', name: 'Owner Phase 4', role: 'OWNER' } });
    }
    if (path === '/api/admin/me') return session
      ? json(route, { data: { id: 'owner-phase-4', name: 'Owner Phase 4', role: 'OWNER' } })
      : json(route, { error: { message: 'Non authentifié' } }, 401);
    if (path === '/api/admin/reservations/' + reservation.reference) return json(route, { data: reservation });
    if (path === '/api/admin/leads/' + lead.reference) return json(route, { data: lead });
    if (path === '/api/admin/financial-tasks/' + task.id) return json(route, { data: task });
    if (path === '/api/admin/financial-tasks') return json(route, { data: [task], meta: { total: 1, limit: 25, offset: 0, operators: [task.createdBy] } });
    if (path === '/api/admin/reservations') return json(route, { data: [] });
    if (path === '/api/admin/leads') return json(route, { data: [] });
    return json(route, { data: [] });
  });
};

test('Phase 4 authenticated links open and focus reservation, lead, and finance records', async ({ page }) => {
  await installApi(page);
  await page.goto('/admin/reservations/' + reservation.reference);
  await expect(page.getByRole('heading', { name: new RegExp(reservation.reference) })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList.contains('admin-modal-content'))).toBe(true);

  await page.goto('/admin/leads/' + lead.reference);
  await expect(page.getByText(lead.reference, { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate((reference) => document.activeElement?.dataset.leadReference === reference, lead.reference)).toBe(true);

  await page.goto('/admin/finance/' + task.id);
  await expect(page.getByText(task.dedupeKey, { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate((id) => document.activeElement?.dataset.financialTask === id, task.id)).toBe(true);
});

test('Phase 4 preserves a finance destination through login', async ({ page }) => {
  await installApi(page, false);
  await page.goto('/admin/finance/' + task.id);
  await page.getByLabel('Adresse email').fill('owner@example.test');
  await page.getByLabel('Mot de passe').fill('phase-4-password');
  await page.getByRole('button', { name: 'Se Connecter' }).click();
  await expect(page).toHaveURL(new RegExp('/admin/finance/' + task.id + '$'));
  await expect(page.getByText(task.dedupeKey, { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate((id) => document.activeElement?.dataset.financialTask === id, task.id)).toBe(true);
});
