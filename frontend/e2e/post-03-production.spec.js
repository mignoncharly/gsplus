import { expect, test } from '@playwright/test';

test('POST-03 publie 35 offres et réserve uniquement les 31 offres directes', async ({ page }) => {
  const servicesResponse = await page.goto('/services', { waitUntil: 'domcontentloaded' });
  expect(servicesResponse?.status()).toBe(200);

  const identity = page.locator('.pack-card-premium').filter({ hasText: 'Identité Standard' });
  await expect(identity).toContainText('Organisation sur échange');
  await expect(identity.getByRole('link', { name: 'Nous contacter' })).toHaveAttribute('href', '/contact');
  await expect(identity.getByRole('link', { name: 'Réserver ce pack' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Avantage étudiant' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Parrainage Golden' })).toBeVisible();

  const reservationResponse = await page.goto('/reservation', { waitUntil: 'domcontentloaded' });
  expect(reservationResponse?.status()).toBe(200);
  const select = page.locator('#booking-package');
  await expect(select).toBeEnabled();
  await expect(select.locator('option')).toHaveCount(31);
  await expect(select).not.toContainText('Identité Standard');
  await expect(select).not.toContainText('Abonnement Créateur');
  await expect(select).not.toContainText('Abonnement Influenceur');
  await expect(select).toContainText('Happy Hours — Flash Social');
});
