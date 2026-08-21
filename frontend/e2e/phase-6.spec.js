import { expect, test } from '@playwright/test';

const packageFixture = {
  id: 'phase-6-pack',
  slug: 'phase-6-pack',
  name: 'Phase 6 Portrait',
  category: 'Portrait',
  price: 50000,
  durationMin: 60,
  bookingMode: 'DIRECT',
  isRange: false,
  isPromo: false,
  sortOrder: 10,
};

const json = (route, data, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(data),
});

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (url.pathname === '/api/packages') return json(route, { data: [packageFixture] });
    if (url.pathname === '/api/media') return json(route, { data: [] });
    if (url.pathname === '/api/availability') return json(route, { data: { days: [] } });
    if (url.pathname === '/api/admin/me') return json(route, { error: { message: 'Unauthorized' } }, 401);
    if (url.pathname === '/api/reservation-intents') {
      const body = request.postDataJSON();
      return json(route, {
        data: {
          id: 'phase-6-intent',
          reference: 'GSP-PHASE6',
          startAt: body.startAt,
          endAt: body.startAt,
          expiresAt: '2027-01-01T00:15:00.000Z',
          scheduleKind: body.scheduleKind,
        },
      }, 201);
    }
    return json(route, { data: [] });
  });
});

test('locale switch preserves the public route and query while metadata remains reciprocal', async ({ page }) => {
  await page.goto('/fr/services?pack=portrait#packs', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/services\?pack=portrait#packs$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://gsplus.vip/en/services');
  await expect(page.locator('link[hreflang="fr"]')).toHaveAttribute('href', 'https://gsplus.vip/fr/services');
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', 'https://gsplus.vip/en/services');
  await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute('href', 'https://gsplus.vip/fr/services');
});

test('English legal pages publish approved authority wording without editorial tokens', async ({ page }) => {
  for (const path of ['/en/mentions-legales', '/en/confidentialite', '/en/cgv']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('This English translation is provided for convenience. The French version remains authoritative.')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('OWNER');
  }
});

test('English segmented date labels submit the exact Africa/Douala instant', async ({ page }) => {
  let postedIntent = null;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/reservation-intents' && request.method() === 'POST') {
      postedIntent = request.postDataJSON();
    }
  });

  await page.goto('/en/reservation', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: 'Suggest my time' }).click();

  await expect(page.getByLabel('Month')).toBeVisible();
  await expect(page.getByLabel('Month').locator('option').nth(1)).toHaveText('January');
  await page.getByLabel('Year').selectOption('2027');
  await page.getByLabel('Month').selectOption('8');
  await page.getByLabel('Day').selectOption('4');
  await page.getByLabel('Preferred time').fill('10:00');
  await page.getByRole('button', { name: 'Record this proposal' }).click();

  await expect(page.getByText('Proposal recorded — not confirmed')).toBeVisible();
  expect(postedIntent).toMatchObject({
    startAt: '2027-08-04T09:00:00.000Z',
    scheduleKind: 'CUSTOM_PROPOSAL',
  });
  await expect(page.locator('input[name="preferredDate"]')).toHaveValue('2027-08-04');
});
