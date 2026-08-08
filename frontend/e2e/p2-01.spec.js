import { expect, test } from '@playwright/test';

test('P2-01 localizes server errors beside contact fields and preserves values', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/contact') {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: [
              { path: 'name', code: 'too_small', minimum: 1, message: 'Too small' },
              { path: 'message', code: 'too_small', minimum: 10, message: 'Too small' },
            ],
          },
        }),
      });
    }
    if (url.pathname === '/api/admin/me') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Non authentifié' } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });

  await page.goto('/contact', { waitUntil: 'domcontentloaded' });
  const name = page.getByLabel('Nom complet *');
  const message = page.getByLabel('Votre message *');
  await name.fill('Alice Localisation');
  await page.getByLabel('Email *').fill('alice@example.com');
  await message.fill('Message suffisamment long pour atteindre le serveur.');
  await page.getByRole('button', { name: 'Envoyer le message' }).click();

  await expect(page.getByText('Renseignez votre nom.')).toBeVisible();
  await expect(page.getByText('Le message doit contenir au moins 10 caractères.')).toBeVisible();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toHaveAttribute('aria-describedby', 'contact-name-error');
  await expect(message).toHaveAttribute('aria-invalid', 'true');
  await expect(message).toHaveAttribute('aria-describedby', 'contact-message-error');
  await expect(name).toHaveValue('Alice Localisation');
  await expect(message).toHaveValue('Message suffisamment long pour atteindre le serveur.');
  await expect(page.getByText('Request validation failed')).toHaveCount(0);
  await expect(page.getByText('Corrigez les champs indiqués ci-dessous.')).toBeVisible();
});
