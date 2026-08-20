import process from 'node:process';
import { expect, test } from '@playwright/test';

const productionOrigin = process.env.PLAYWRIGHT_BASE_URL;
test.skip(!productionOrigin, 'Production smoke runs only when PLAYWRIGHT_BASE_URL is explicitly provided.');

test('production publie les sources juridiques OWNER du 11 août 2026', async ({ page }) => {
  for (const [route, lastUpdated] of [
    ['/confidentialite', '11 août 2026'],
    ['/mentions-legales', '11 août 2026'],
    ['/cgv', '11 août 2026'],
  ]) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), route).toBe(200);
    await expect(page.getByText(`Dernière mise à jour : ${lastUpdated}`)).toBeVisible();
  }

  await page.goto('/confidentialite', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Golden Studio Plus détermine les finalités et les moyens/)).toBeVisible();
  await expect(page.getByText(/Cookies, traceurs et mesure d’audience/)).toBeVisible();
  await expect(page.getByText(/portabilité des données/)).toBeVisible();

  await page.goto('/mentions-legales', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Golden Studio Plus est l’éditeur du site/)).toBeVisible();
  await expect(page.getByText(/Le présent site est soumis au droit camerounais/)).toBeVisible();
  await expect(page.getByText(/Consultez les conditions générales de vente et la politique de confidentialité/)).toBeVisible();
});

test('production public copy is corrected and no Wikimedia image is requested', async ({ page }) => {
  const requestedUrls = [];
  page.on('request', (request) => requestedUrls.push(request.url()));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Incontournable')).toBeVisible();
  await expect(page.getByText('Idéal pour un profil professionnel')).toBeVisible();

  await page.goto('/contact', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Horaires d[’']ouverture/ })).toBeVisible();
  await expect(page.getByText(/Fermé, sauf rendez-vous VIP préalable/)).toBeVisible();

  expect(requestedUrls.some((url) => url.includes('upload.wikimedia.org'))).toBe(false);
});
