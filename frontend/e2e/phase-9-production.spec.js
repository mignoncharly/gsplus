import process from 'node:process';
import { expect, test } from '@playwright/test';

const productionOrigin = process.env.PLAYWRIGHT_BASE_URL;
test.skip(!productionOrigin, 'Production smoke runs only when PLAYWRIGHT_BASE_URL is explicitly provided.');

test('production publishes the July 2026 legal set and complete privacy disclosures', async ({ page }) => {
  for (const route of ['/confidentialite', '/mentions-legales', '/cgv']) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), route).toBe(200);
    await expect(page.getByText('Dernière mise à jour : 24 juillet 2026')).toBeVisible();
  }

  await page.goto('/confidentialite', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('rowheader', { name: 'Cal.com' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Zoho Mail (SMTP)' })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Actif pour les notifications transactionnelles/ })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Journaux de sécurité du serveur' })).toBeVisible();
  await expect(page.getByText(/portabilité des données/)).toBeVisible();

  await page.goto('/mentions-legales', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Informations officielles en attente de validation/)).toBeVisible();
  await expect(page.getByText(/Aucun numéro, nom ou renseignement juridique non vérifié/)).toBeVisible();
  await expect(page.getByText('Hetzner Online GmbH')).toBeVisible();
  await expect(page.getByText(/Industriestr\. 25, 91710 Gunzenhausen/)).toBeVisible();
});

test('production public copy is corrected and no Wikimedia image is requested', async ({ page }) => {
  const requestedUrls = [];
  page.on('request', (request) => requestedUrls.push(request.url()));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Incontournable')).toBeVisible();
  await expect(page.getByText('Idéal pour un profil professionnel')).toBeVisible();

  await page.goto('/contact', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: "Horaires d'ouverture" })).toBeVisible();
  await expect(page.getByText(/Fermé, sauf rendez-vous VIP préalable/)).toBeVisible();

  expect(requestedUrls.some((url) => url.includes('upload.wikimedia.org'))).toBe(false);
});
