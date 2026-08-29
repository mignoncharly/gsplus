import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const hours = Array.from({ length: 7 }, (_item, dayOfWeek) => ({
  id: `h-${dayOfWeek}`, dayOfWeek, opensAt: '09:00', closesAt: '18:00',
  isClosed: dayOfWeek === 0, breaks: dayOfWeek === 3 ? [{ start: '12:00', end: '14:00' }] : null,
}));

const planning = {
  from: '2026-09-01', to: '2026-09-02', today: '2026-09-01',
  days: [
    { date: '2026-09-01', dayOfWeek: 2, isClosed: false, opensAt: '09:00', closesAt: '18:00', reason: null },
    { date: '2026-09-02', dayOfWeek: 3, isClosed: true, opensAt: null, closesAt: null, reason: 'Jour férié' },
  ],
  reservations: [{
    id: 'r1', reference: 'GSP-260901-0001', status: 'CONFIRMED',
    startAt: '2026-09-01T09:00:00.000Z', endAt: '2026-09-01T10:00:00.000Z', scheduleKind: 'STANDARD_HOLD',
    package: { id: 'p1', name: 'Portrait Signature' },
    snapshot: { firstName: 'Amina', lastName: 'Ngo' }, customer: { firstName: 'Amina', lastName: 'Ngo' },
  }],
  blocks: [{ id: 'b1', startAt: '2026-09-01T13:00:00.000Z', endAt: '2026-09-01T14:00:00.000Z', reason: 'Maintenance' }],
  intents: [{ id: 'i1', startAt: '2026-09-01T15:00:00.000Z', endAt: '2026-09-01T16:00:00.000Z', expiresAt: '2026-09-01T15:20:00.000Z', package: { name: 'Portrait Signature' } }],
};

const installAdminApi = async (page) => {
  const calls = { hourSaves: [], exceptionSaves: [], ruleSaves: [] };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') return json(route, { data: { id: 'a', name: 'Owner', email: 'o@e.test', role: 'OWNER' } });
    if (path === '/api/admin/schedule/business-hours') return json(route, { data: hours });
    if (path.startsWith('/api/admin/schedule/business-hours/') && request.method() === 'PUT') {
      calls.hourSaves.push(request.postDataJSON());
      return json(route, { data: { ...request.postDataJSON(), id: 'h-x' } });
    }
    if (path === '/api/admin/schedule/exceptions' && request.method() === 'PUT') {
      calls.exceptionSaves.push(request.postDataJSON());
      return json(route, { data: { id: 'e-x', ...request.postDataJSON() } });
    }
    if (path === '/api/admin/schedule/exceptions') {
      return json(route, { data: [{ id: 'e1', date: '2026-09-02', isClosed: true, opensAt: null, closesAt: null, reason: 'Jour férié' }] });
    }
    if (path === '/api/admin/schedule/booking-rules' && request.method() === 'PUT') {
      calls.ruleSaves.push(request.postDataJSON());
      return json(route, { data: request.postDataJSON() });
    }
    if (path === '/api/admin/schedule/booking-rules') {
      return json(route, { data: {
        global: { minNoticeMinutes: 120, horizonDays: null, dailyCapacity: null, bufferMinutes: 15 },
        effectiveGlobal: { minNoticeMinutes: 120, horizonDays: null, dailyCapacity: null, bufferMinutes: 15 },
        perPackage: [], packages: [],
      } });
    }
    if (path === '/api/admin/schedule/planning') return json(route, { data: planning });
    if (path === '/api/admin/calendar/health') {
      return json(route, { data: { lastSuccessAt: '2026-08-29T09:00:00.000Z', lastFailureAt: null, lastFailureError: null, pendingCount: 0, failingCount: 0, healthy: true } });
    }
    if (path === '/api/admin/availability-blocks') return json(route, { data: planning.blocks });
    if (path === '/api/admin/dashboard') return json(route, { data: { generatedAt: '', businessDate: '2026-09-01', toHandle: [], today: [], finance: [], integrations: [], requests: [], summary: { reservationsThisMonth: 0, uniqueCustomers: 0, revenue: { net: 0, onActiveReservations: 0, onCancelledReservations: 0, refunded: 0 } } } });
    return json(route, { data: [] });
  });
  return calls;
};

const open = async (page, path) => {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
};

test('ADM-05 the planning view shows the agenda, hours, exceptions and rules', async ({ page }) => {
  await installAdminApi(page);
  await open(page, '/admin/planning?debut=2026-09-01&vue=day');

  await expect(page.getByRole('heading', { level: 1, name: /Planning/ })).toBeVisible();

  // Cal.com health, which the report asks to see beside the schedule.
  await expect(page.getByText('Opérationnel')).toBeVisible();

  // Agenda entries: a reservation, a temporary hold and a block, each distinguishable.
  await expect(page.locator('.admin-agenda-entry--reservation')).toHaveCount(1);
  await expect(page.locator('.admin-agenda-entry--hold')).toHaveCount(1);
  await expect(page.locator('.admin-agenda-entry--block')).toHaveCount(1);
  await expect(page.getByText('GSP-260901-0001')).toBeVisible();

  // The weekly pattern, including a configured pause.
  await expect(page.getByText(/09:00 – 18:00 · pauses : 12:00–14:00/)).toBeVisible();
  // Exceptions and rules are both readable without opening anything.
  await expect(page.getByText('Jour férié').first()).toBeVisible();
  await expect(page.getByText('120 min')).toBeVisible();
  // Horizon is masculine, capacity feminine: both read as "no limit".
  await expect(page.getByText('Illimité', { exact: true })).toBeVisible();
  await expect(page.getByText('Illimitée', { exact: true })).toBeVisible();
});

test('ADM-05 a closed day reads as closed, with its reason', async ({ page }) => {
  await installAdminApi(page);
  await open(page, '/admin/planning?debut=2026-09-01&vue=week');
  const closed = page.locator('.admin-agenda-day.is-closed');
  await expect(closed).toHaveCount(1);
  await expect(closed).toContainText('Fermé — Jour férié');
});

test('ADM-05 the studio can change an opening hour without a developer', async ({ page }) => {
  const calls = await installAdminApi(page);
  await open(page, '/admin/planning?debut=2026-09-01&vue=day');

  await page.getByRole('button', { name: 'Modifier les horaires du lundi' }).click();
  const dialog = page.locator('.admin-action-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Ouverture (HH:MM)').fill('11:00');
  await dialog.getByLabel('Fermeture (HH:MM)').fill('16:00');
  await dialog.getByRole('button', { name: 'Enregistrer les horaires' }).click();

  await expect.poll(() => calls.hourSaves.length).toBe(1);
  expect(calls.hourSaves[0]).toMatchObject({ dayOfWeek: 1, opensAt: '11:00', closesAt: '16:00', isClosed: false });
});

test('ADM-05 an exception and a rule are both editable from the view', async ({ page }) => {
  const calls = await installAdminApi(page);
  await open(page, '/admin/planning?debut=2026-09-01&vue=day');

  await page.getByRole('button', { name: /Ajouter/ }).click();
  const exceptionDialog = page.locator('.admin-action-dialog');
  await exceptionDialog.getByLabel(/Motif/).fill('Fête nationale');
  await exceptionDialog.getByRole('button', { name: 'Enregistrer l’exception' }).click();
  await expect.poll(() => calls.exceptionSaves.length).toBe(1);
  expect(calls.exceptionSaves[0]).toMatchObject({ isClosed: true, reason: 'Fête nationale' });

  await page.getByRole('button', { name: 'Modifier les règles de réservation' }).click();
  const ruleDialog = page.locator('.admin-action-dialog');
  await ruleDialog.getByLabel(/Horizon de réservation/).fill('60');
  await ruleDialog.getByRole('button', { name: 'Enregistrer les règles' }).click();
  await expect.poll(() => calls.ruleSaves.length).toBe(1);
  // An empty field means "no limit", which is how the rules behaved before they existed.
  expect(calls.ruleSaves[0]).toMatchObject({ packageId: null, horizonDays: 60, dailyCapacity: null });
});

test('ADM-05 the agenda range is addressable and survives a reload', async ({ page }) => {
  await installAdminApi(page);
  await open(page, '/admin/planning?debut=2026-09-01&vue=day');
  await page.getByRole('button', { name: 'Semaine', exact: true }).click();
  await expect(page).toHaveURL(/vue=week/);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Semaine', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
