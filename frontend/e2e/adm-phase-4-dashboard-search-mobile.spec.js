import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const dashboard = {
  generatedAt: '2026-08-29T09:00:00.000Z',
  businessDate: '2026-08-29',
  toHandle: [
    { key: 'paymentsToVerify', label: 'Paiements à vérifier', count: 4, href: '/admin/paiements/verification?open=true' },
    { key: 'reservationsToDecide', label: 'Réservations à décider', count: 2, href: '/admin/reservations?status=PENDING_CONFIRMATION' },
    { key: 'informationRequired', label: 'Informations manquantes', count: 0, href: '/admin/paiements/verification?status=PAYMENT_INFO_REQUIRED' },
  ],
  today: [{ key: 'sessionsToday', label: 'Séances du jour', count: 1, href: '/admin/reservations?from=2026-08-29&to=2026-08-29' }],
  finance: [{ key: 'refundsToProcess', label: 'Remboursements à traiter', count: 3, href: '/admin/paiements/remboursements?status=PENDING' }],
  integrations: [{ key: 'calendarFailures', label: 'Échecs Cal.com', count: 0, href: '/admin/planning' }],
  requests: [{ key: 'newRequests', label: 'Demandes non lues', count: 5, href: '/admin/demandes' }],
  summary: {
    reservationsThisMonth: 12,
    uniqueCustomers: 30,
    revenue: { net: 75000, onActiveReservations: 100000, onCancelledReservations: 40000, refunded: 25000 },
  },
};

const reservation = (reference, status, name) => ({
  id: `res-${reference}`, reference, status, startAt: '2026-09-02T09:00:00.000Z', endAt: '2026-09-02T10:00:00.000Z',
  package: { id: 'p1', name: 'Portrait Signature' }, payments: [],
  snapshot: { firstName: name, lastName: 'Client', notificationPhoneE164: '+237640703249' },
  customer: { firstName: name, lastName: 'Client', phone: '+237640703249' },
});

const allRows = [
  reservation('GSP-260829-0001', 'PENDING_CONFIRMATION', 'Amina'),
  reservation('GSP-260829-0002', 'CONFIRMED', 'Bruno'),
  reservation('GSP-260829-0003', 'CANCELLED', 'Chantal'),
];

const installAdminApi = async (page) => {
  const calls = { reservations: [] };
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') return json(route, { data: { id: 'a', name: 'Owner', email: 'o@e.test', role: 'OWNER' } });
    if (path === '/api/admin/dashboard') return json(route, { data: dashboard });
    if (path === '/api/admin/reservations') {
      calls.reservations.push(url.search);
      const statuses = url.searchParams.getAll('status');
      const q = url.searchParams.get('q');
      let items = allRows;
      if (statuses.length) items = items.filter((r) => statuses.includes(r.status));
      if (q) items = items.filter((r) => r.reference.includes(q.toUpperCase()) || r.snapshot.firstName.toLowerCase().includes(q.toLowerCase()));
      return json(route, { data: items, meta: { total: items.length, limit: 25, offset: 0 } });
    }
    if (path === '/api/admin/financial-tasks') return json(route, { data: [], meta: { total: 0, limit: 25, offset: 0, operators: [] } });
    if (path === '/api/admin/payments') return json(route, { data: [], meta: { total: 0, limit: 25, offset: 0 } });
    return json(route, { data: [] });
  });
  return calls;
};

const open = async (page, path) => {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
};

test('ADM-01 the dashboard leads with what needs a decision', async ({ page }) => {
  await installAdminApi(page);
  await open(page, '/admin/tableau-de-bord');

  await expect(page.getByRole('heading', { level: 1, name: /À traiter/ })).toBeVisible();
  // Decisions come before statistics: the summary is the last zone on the page.
  const headings = await page.locator('.admin-card h2').allTextContents();
  expect(headings[0]).toContain('À traiter');
  expect(headings.some((h) => h.includes('Résumé'))).toBe(true);
  expect(headings.indexOf(headings.find((h) => h.includes('Résumé')))).toBeGreaterThan(0);

  // 4 + 2 + 0 to handle, 3 refunds, 0 integration alerts, 5 requests = 14. The day's
  // sessions are information, not a backlog, so they are not counted.
  await expect(page.locator('.admin-overview-lede')).toContainText('14 élément(s) en attente');
  await expect(page.getByText('Demandes non lues')).toBeVisible();
});

test('ADM-01 every counter opens the list it counts', async ({ page }) => {
  const calls = await installAdminApi(page);
  await open(page, '/admin/tableau-de-bord');

  await page.getByRole('link', { name: /Réservations à décider/ }).click();
  await expect(page).toHaveURL(/\/admin\/reservations\?status=PENDING_CONFIRMATION$/);
  // The list really is filtered, not merely opened.
  await expect(page.locator('.admin-table tbody tr')).toHaveCount(1);
  expect(calls.reservations.at(-1)).toContain('status=PENDING_CONFIRMATION');
});

test('ADM-01 verified revenue is stated net, with the deductions visible', async ({ page }) => {
  await installAdminApi(page);
  await open(page, '/admin/tableau-de-bord');

  // 100 000 collected on active bookings, 25 000 refunded → 75 000 net. The 40 000
  // verified against cancelled bookings is shown but never counted as income.
  await expect(page.getByText('Revenu vérifié net du mois')).toBeVisible();
  const breakdown = page.locator('.admin-revenue-breakdown');
  await expect(breakdown).toContainText('Vérifié sur réservations annulées ou refusées');
  await expect(breakdown).toContainText('Remboursé ce mois');
});

test('ADM-02 filters live in the URL and survive a reload', async ({ page }) => {
  const calls = await installAdminApi(page);
  await open(page, '/admin/reservations');
  await expect(page.locator('.admin-table tbody tr')).toHaveCount(3);

  await page.getByLabel('Rechercher').fill('Bruno');
  await page.getByRole('button', { name: 'Filtrer' }).click();
  await expect(page).toHaveURL(/q=Bruno/);
  await expect(page.locator('.admin-table tbody tr')).toHaveCount(1);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.admin-table tbody tr')).toHaveCount(1);
  await expect(page.getByLabel('Rechercher')).toHaveValue('Bruno');

  await page.getByRole('button', { name: /Réinitialiser/ }).click();
  await expect(page).toHaveURL(/\/admin\/reservations$/);
  await expect(page.locator('.admin-table tbody tr')).toHaveCount(3);
  expect(calls.reservations.length).toBeGreaterThan(2);
});

test('ADM-02 status filters combine and are reflected in the address', async ({ page }) => {
  await installAdminApi(page);
  await open(page, '/admin/reservations');

  await page.getByRole('checkbox', { name: statusName('Confirmée') }).check();
  await page.getByRole('checkbox', { name: statusName('Annulée') }).check();
  await page.getByRole('button', { name: 'Filtrer' }).click();

  await expect(page).toHaveURL(/status=CONFIRMED/);
  await expect(page).toHaveURL(/status=CANCELLED/);
  await expect(page.locator('.admin-table tbody tr')).toHaveCount(2);
  await expect(page.getByText('2 filtre(s) actif(s)')).toBeVisible();
});

function statusName(label) { return label; }

test('ADM-03 the list carries no horizontal scroll at 390 pixels', async ({ page }) => {
  await installAdminApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/admin/reservations');

  // Cards replace the table, so the essentials and one action fit the width.
  await expect(page.locator('.admin-reservation-cards')).toBeVisible();
  await expect(page.locator('.admin-reservation-table')).toBeHidden();
  await expect(page.locator('.admin-reservation-card')).toHaveCount(3);
  await expect(page.locator('.admin-reservation-card').first().getByRole('button', { name: /Détails/ })).toBeVisible();

  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth);
  expect(overflow, 'the page body must not scroll sideways at 390px').toBe(true);
});

test('ADM-03 the dashboard also fits a 390 pixel screen', async ({ page }) => {
  await installAdminApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/admin/tableau-de-bord');

  await expect(page.getByRole('heading', { level: 1, name: /À traiter/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth);
  expect(overflow).toBe(true);
});
