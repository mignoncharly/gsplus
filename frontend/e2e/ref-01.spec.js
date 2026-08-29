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
    if (url.pathname === '/api/admin/dashboard') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
        generatedAt: new Date().toISOString(), businessDate: '2026-08-18',
        toHandle: [], today: [], finance: [], integrations: [], requests: [],
        summary: { reservationsThisMonth: 0, uniqueCustomers: 0, revenue: { net: 0, onActiveReservations: 0, onCancelledReservations: 0, refunded: 0 } },
      } }) });
    }
    if (url.pathname === '/api/admin/reservations') {
      // Phase 4 routes reference lookup through the general search, and the server
      // normalises the term, so the mock does the same.
      const term = url.searchParams.get('q') || url.searchParams.get('reference');
      if (term) lookups.push(term.toUpperCase());
      const data = term
        ? reservations.filter((item) => item.reference.includes(term.toUpperCase()))
        : reservations;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, meta: { total: data.length, limit: 25, offset: 0 } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Réservations' }).click();

  const search = page.getByLabel('Rechercher');
  await search.fill('gsp-260802-k7m4');
  const searchButton = page.getByRole('button', { name: 'Filtrer' });
  await expect(searchButton).toBeEnabled();
  await searchButton.evaluate((button) => button.click());

  await expect.poll(() => lookups.at(-1)).toBe('GSP-260802-K7M4');
  // At 390 px the table is hidden and the card layout carries the record (ADM-03),
  // so the visible copy of the reference is the card's.
  await expect(page.locator('.admin-reservation-cards').getByText('GSP-260802-K7M4', { exact: true })).toBeVisible();
  await expect(page.locator('.admin-reservation-table')).toBeHidden();
  await expect(page.getByText('GSP-260802-P9XZ', { exact: true })).toHaveCount(0);
  // The search reached the record through the general query, not a reference-only call.
  await expect(page.getByText('ref-01-target', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
