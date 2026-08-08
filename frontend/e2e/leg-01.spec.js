import { expect, test } from '@playwright/test';

test('LEG-01 publie la version du 31 juillet et les quatre sections normatives', async ({ page }) => {
  await page.goto('/mentions-legales', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Dernière mise à jour : 31 juillet 2026')).toBeVisible();
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
  await expect(page.getByText('Dernière mise à jour : 31 juillet 2026')).toBeVisible();
});

test('LEG-01 conserve les informations vérifiées sans débordement mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/mentions-legales', { waitUntil: 'domcontentloaded' });
  const main = page.locator('#main-content');

  await expect(page.getByText('Cité des Palmiers, Douala, Cameroun')).toBeVisible();
  await expect(main.getByRole('link', { name: '+237 673 026 654' })).toHaveAttribute('href', 'tel:+237673026654');
  await expect(main.getByRole('link', { name: 'info@gsplus.vip' })).toHaveAttribute('href', 'mailto:info@gsplus.vip');
  await expect(page.getByText('Hetzner Online GmbH')).toBeVisible();
  await expect(page.getByText(/numéro RCCM et identifiant fiscal/)).toBeVisible();
  await expect(page.getByText(/Aucun numéro, nom ou renseignement juridique non vérifié/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'conditions générales de vente' })).toHaveAttribute('href', '/cgv');
  await expect(page.getByRole('link', { name: 'politique de confidentialité' })).toHaveAttribute('href', '/confidentialite');

  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
});
