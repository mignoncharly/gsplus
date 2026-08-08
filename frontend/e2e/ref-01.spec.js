import { expect, test } from '@playwright/test';

const reservations = [
  {
    id: 'ref-01-target', reference: 'GSP-260802-K7M4', startAt: '2026-08-18T09:00:00.000Z',
    status: 'PENDING_CONFIRMATION', customerId: 'customer-target',
    package: { id: 'pack-ref', name: 'Portrait REF-01' }, payments: [],
    snapshot: { firstName: 'Alice', lastName: 'Référence', notificationPhoneE164: '+237640703249', notificationEmail: 'alice@example.test' },
  },
  {
    id: 'ref-01-other', reference: 'GSP-260802-P9XZ', startAt: '2026-08-19T09:00:00.000Z',
    status: 'CONFIRMED', customerId: 'customer-other',
    package: { id: 'pack-ref', name: 'Portrait REF-01' }, payments: [],
    snapshot: { firstName: 'Brice', lastName: 'Autre', notificationPhoneE164: '+237670000000', notificationEmail: 'brice@example.test' },
  },
];

test('REF-01 searches the normalized public reference without exposing technical ids', async ({ page }) => {
  const lookups = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/health') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
    if (url.pathname === '/api/admin/me') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'owner-ref', name: 'Owner REF-01', role: 'OWNER' } }) });
    if (url.pathname === '/api/admin/reservations') {
      const reference = url.searchParams.get('reference');
      if (reference) lookups.push(reference);
      const data = reference ? reservations.filter((item) => item.reference === reference) : reservations;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Réservations' }).click();

  const search = page.getByLabel('Rechercher par référence');
  await search.fill('gsp-260802-k7m4');
  const searchButton = page.getByRole('button', { name: 'Rechercher' });
  await expect(searchButton).toBeEnabled();
  await searchButton.evaluate((button) => button.click());

  await expect.poll(() => lookups.at(-1)).toBe('GSP-260802-K7M4');
  await expect(page.getByText('GSP-260802-K7M4', { exact: true })).toBeVisible();
  await expect(page.getByText('GSP-260802-P9XZ', { exact: true })).toHaveCount(0);
  await expect(page.getByText('ref-01-target', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
