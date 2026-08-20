import { expect, test } from '@playwright/test';

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

test('English public routes contain no known untranslated interface or legal placeholders', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('gsp.locale', 'en'));
  await page.route('**/api/**', (route) => json(route, { data: [] }));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('with Golden Studio Plus');
  await expect(page.getByRole('heading', { level: 1 })).not.toContainText('avec');
  await expect(page).toHaveTitle(/Premium photo studio in Douala/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'en_US');

  await page.goto('/portfolio');
  await expect(page.getByRole('button', { name: 'Maternity', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Maternité', exact: true })).toHaveCount(0);

  await page.goto('/corporate');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offers B2B & Corporate');

  for (const [path, heading] of [['/mentions-legales', 'Publisher and intellectual property'], ['/confidentialite', 'Data controller and contact'], ['/cgv', 'Booking, prices and payment']]) {
    await page.goto(path);
    await expect(page.getByText('Last updated: 11 August 2026')).toBeVisible();
    await expect(page.getByRole('heading', { name: new RegExp(heading) })).toBeVisible();
    await expect(page.getByText(/English legal translation is being prepared/)).toHaveCount(0);
  }

  for (const path of ['/', '/services', '/portfolio', '/reservation', '/services-creatifs', '/a-propos', '/contact', '/corporate', '/mentions-legales', '/confidentialite', '/cgv']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#main-content')).toBeVisible();
    const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(widths.document, `${path}: document width`).toBeLessThanOrEqual(widths.viewport + 1);
    expect(widths.body, `${path}: body width`).toBeLessThanOrEqual(widths.viewport + 1);
  }
});
