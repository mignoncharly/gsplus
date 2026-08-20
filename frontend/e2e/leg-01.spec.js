import { expect, test } from '@playwright/test';

test('LEG-01 publie la version OWNER du 11 août et les quatre sections normatives', async ({ page }) => {
  await page.goto('/mentions-legales', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Dernière mise à jour : 11 août 2026')).toBeVisible();
  const headings = page.locator('.legal-content-wrap > .legal-section > h2');
  await expect(headings).toHaveText([
    '1. Éditeur et propriété intellectuelle',
    '2. Responsabilité',
    '3. Droit applicable et différends',
    '4. Documents associés',
  ]);
  await expect(page.getByText(/L’accès au site n’emporte aucune cession de droits/)).toBeVisible();
  await expect(page.getByText(/extraction automatisée ou répétée des contenus/)).toBeVisible();
  await expect(page.getByText(/entraîner, tester ou alimenter un système automatisé ou d’intelligence artificielle/)).toBeVisible();
  await expect(page.getByText(/compétence exclusive des tribunaux matériellement compétents du ressort de Douala/)).toBeVisible();

  await page.goto('/confidentialite', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Dernière mise à jour : 11 août 2026')).toBeVisible();
});

test('LEG-01 reste fidèle à la source OWNER sans débordement mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/mentions-legales', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText(/Golden Studio Plus est l’éditeur du site/)).toBeVisible();
  await expect(page.getByText(/Les informations, services et tarifs figurant sur le site sont fournis à titre indicatif/)).toBeVisible();
  await expect(page.getByText(/Le présent site est soumis au droit camerounais/)).toBeVisible();
  await expect(page.getByText(/Consultez les conditions générales de vente et la politique de confidentialité/)).toBeVisible();

  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
});
