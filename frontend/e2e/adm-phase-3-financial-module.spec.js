import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const payment = (id, reference, status, declaredAmount, transactionRef, extra = {}) => ({
  id, version: 1, status, method: 'mtn_momo', amount: 25000, declaredAmount,
  transactionRef, paymentPhone: '+237690000000', createdAt: '2026-08-20T09:00:00.000Z',
  verifiedAt: null, verifiedBy: null, duplicateOf: null, duplicates: [],
  amountVariance: declaredAmount === null ? null : declaredAmount - 25000,
  reservation: {
    id: `res-${id}`, reference, status: 'PENDING_CONFIRMATION',
    startAt: '2026-09-02T09:00:00.000Z', endAt: '2026-09-02T10:00:00.000Z',
    snapshot: { firstName: 'Amina', lastName: 'Paiement', notificationPhoneE164: '+237640703249', packageName: 'Portrait', amount: 25000 },
    customer: { firstName: 'Amina', lastName: 'Paiement', phone: '+237640703249' },
  },
  ...extra,
});

const rows = [
  payment('pay-1', 'GSP-260820-0001', 'PENDING', null, 'TXN-111'),
  payment('pay-2', 'GSP-260820-0002', 'PENDING', 20000, 'TXN-222'),
  payment('pay-3', 'GSP-260820-0003', 'VERIFIED', 25000, 'TXN-333'),
];

const installAdminApi = async (page, { role = 'OWNER' } = {}) => {
  const calls = { lists: [] };
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') return json(route, { data: { id: 'admin-1', name: 'Admin', email: 'a@example.test', role } });
    if (path === '/api/admin/payments') {
      calls.lists.push(url.search);
      let items = rows;
      if (url.searchParams.get('open') === 'true') items = items.filter((r) => r.status === 'PENDING');
      if (url.searchParams.get('mismatch') === 'true') items = items.filter((r) => r.amountVariance !== null && r.amountVariance !== 0);
      if (url.searchParams.get('q')) items = items.filter((r) => r.transactionRef.includes(url.searchParams.get('q')));
      return json(route, { data: items, meta: { total: items.length, limit: 25, offset: 0 } });
    }
    if (path === '/api/admin/payments/pay-1/duplicates') return json(route, { data: [rows[1]] });
    if (path.endsWith('/duplicates')) return json(route, { data: [] });
    if (path === '/api/admin/financial-tasks') return json(route, { data: [], meta: { total: 0, limit: 25, offset: 0, operators: [] } });
    if ([
      '/api/admin/reservations', '/api/admin/leads', '/api/admin/packages',
      '/api/admin/media', '/api/admin/availability-blocks', '/api/admin/notifications',
    ].includes(path)) return json(route, { data: [] });
    return json(route, { error: { message: 'Unexpected ' + path } }, 500);
  });
  return calls;
};

const open = async (page, path) => {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
};

test('ADM-04 the module is one view with two addressable files', async ({ page }) => {
  await installAdminApi(page);
  await open(page, '/admin/paiements');

  await expect(page.getByRole('heading', { name: /Paiements & remboursements/ })).toBeVisible();
  await expect(page.locator('.admin-subview-tab.active')).toHaveText('Vérification');

  await page.getByRole('link', { name: 'Remboursements' }).click();
  await expect(page).toHaveURL(/\/admin\/paiements\/remboursements$/);
  await expect(page.locator('.admin-subview-tab.active')).toHaveText('Remboursements');

  // The address survives a reload, like every other Phase 2 view.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.admin-subview-tab.active')).toHaveText('Remboursements');
});

test('ADM-04 the queue shows expected against received, and never invents a match', async ({ page }) => {
  await installAdminApi(page);
  await open(page, '/admin/paiements/verification');

  // Clear the default open-only filter so a decided payment is visible too.
  await page.getByLabel(/À décider uniquement/).uncheck();
  await page.getByRole('button', { name: 'Filtrer' }).click();

  const table = page.locator('.admin-table tbody tr');
  await expect(table).toHaveCount(3);

  // An unrecorded amount says so, rather than showing the expected figure twice.
  await expect(table.nth(0)).toContainText('Reçu : non renseigné');
  await expect(table.nth(0)).not.toContainText('Écart');

  // A genuine disagreement is flagged.
  await expect(table.nth(1)).toContainText('Écart');
  await expect(table.nth(1)).toHaveClass(/admin-row-attention/);

  // A recorded amount that agrees is not a mismatch.
  await expect(table.nth(2)).toContainText('Reçu : 25');
  await expect(table.nth(2)).not.toHaveClass(/admin-row-attention/);
});

test('ADM-04 duplicates are surfaced, not merely refused', async ({ page }) => {
  await installAdminApi(page);
  await open(page, '/admin/paiements/verification');

  await page.locator('.admin-table tbody tr').nth(0).getByRole('button', { name: 'Doublons' }).click();
  const candidates = page.locator('.admin-payment-duplicates li');
  await expect(candidates).toHaveCount(1);
  await expect(candidates.first()).toContainText('GSP-260820-0002');
  await expect(candidates.first().getByRole('button', { name: 'Marquer doublon' })).toBeVisible();
});

test('ADM-04 a search reaches a decided payment the open-only filter would hide', async ({ page }) => {
  const calls = await installAdminApi(page);
  await open(page, '/admin/paiements/verification');

  // TXN-333 is VERIFIED, so the default "à décider uniquement" filter excludes it.
  // Searching must still find it, or the report's retrievability criterion fails.
  await page.getByLabel('Rechercher').fill('TXN-333');
  await page.getByRole('button', { name: 'Filtrer' }).click();
  await expect(page.locator('.admin-table tbody tr')).toHaveCount(1);

  const searchCall = calls.lists.at(-1);
  expect(searchCall).toContain('q=TXN-333');
  expect(searchCall, 'a search must not carry the open-only restriction').not.toContain('open=true');

  // The control reflects the filter actually in force.
  await expect(page.getByLabel(/À décider uniquement/)).not.toBeChecked();

  const exportLink = page.getByRole('link', { name: /Exporter en CSV/ });
  await expect(exportLink).toHaveAttribute('href', /\/api\/admin\/payments\/export\.csv\?/);
});

test('ADM-04 staff can triage but the refunds file stays with the owner', async ({ page }) => {
  await installAdminApi(page, { role: 'STAFF' });
  await open(page, '/admin/paiements/verification');
  // The default view is the queue awaiting a decision: the two pending payments.
  await expect(page.locator('.admin-table tbody tr')).toHaveCount(2);

  await page.getByRole('link', { name: 'Remboursements' }).click();
  await expect(page.getByText(/réservés au rôle propriétaire/)).toBeVisible();
});

test('ADM-04 the payment queue becomes labelled cards at 390 pixels', async ({ page }) => {
  await installAdminApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/admin/paiements/verification');

  const row = page.locator('.admin-payment-table tbody tr').first();
  await expect(row).toBeVisible();
  await expect(row).toHaveCSS('display', 'block');
  await expect(row.getByRole('link', { name: 'Décider' })).toBeVisible();
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth);
  expect(overflow).toBe(true);
});
