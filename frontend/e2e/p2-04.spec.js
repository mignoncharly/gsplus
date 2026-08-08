import { expect, test } from '@playwright/test';

const json = (route, data, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(data),
});

test('P2-04 affiche les accents, la date française et la devise FCFA uniformes', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/packages') return json(route, { data: [{
      id: 'p2-04-pack',
      slug: 'maternite-bebe-fiancailles',
      name: 'Maternite Bebe Fiancailles',
      category: 'Maternite',
      price: 50000,
      durationMin: 60,
      isRange: false,
      isPromo: false,
      sortOrder: 1,
    }] });
    if (path === '/api/availability') return json(route, { data: { days: [{
      date: '2027-08-10',
      isClosed: false,
      slots: [{ time: '10:00', endTime: '11:00', available: true, reason: null }],
    }] } });
    if (path === '/api/admin/me') return json(route, { error: { message: 'Non authentifié' } }, 401);
    return json(route, { data: [] });
  });

  await page.goto('/reservation', { waitUntil: 'domcontentloaded' });

  const packageSelect = page.locator('#booking-package');
  await expect(packageSelect).toContainText(/Maternité Bébé Fiançailles — 50\D?000 FCFA/u);

  await page.getByRole('button', { name: /Continuer/ }).click();
  await expect(page.getByRole('heading', { name: 'Choisissez votre créneau' })).toBeVisible();
  const dateCard = page.locator('.date-card-btn').first();
  await expect(dateCard).toContainText('Mar');
  await expect(dateCard).toContainText('10');
  await expect(dateCard).toContainText('Aoû');

  await dateCard.click();
  await page.locator('.slot-available').click();
  await expect(page.getByText('Le Mar 10 Août de 10:00', { exact: false })).toBeVisible();
});
