import { expect, test } from '@playwright/test';

test('LEG-02 publie les dix sections et la date du 31 juillet 2026', async ({ page }) => {
  await page.goto('/confidentialite', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Dernière mise à jour : 31 juillet 2026')).toBeVisible();
  await expect(page.locator('.legal-content-wrap > .legal-section > h2')).toHaveText([
    '1. Responsable du traitement et contact',
    '2. Données collectées',
    '3. Finalités et fondements des traitements',
    '4. Destinataires, prestataires et transferts',
    '5. Traitement numérique des images',
    '6. Durées de conservation et archivage',
    '7. Cookies, traceurs et mesure d’audience',
    '8. Sécurité',
    '9. Vos droits et modalités d’exercice',
    '10. Documents associés',
  ]);
  await expect(page.getByText(/détecter les erreurs, incohérences, doublons ou tentatives de fraude/)).toBeVisible();
  await expect(page.getByText(/Les données ne sont pas vendues comme une activité commerciale autonome/)).toBeVisible();
  await expect(page.getByText(/archive intermédiaire à accès restreint/)).toBeVisible();
  await expect(page.getByText(/Le droit à l’effacement n’est pas absolu/)).toBeVisible();
});

test('LEG-02 conserve les pratiques réelles et reste contenue à 320 pixels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/confidentialite', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('rowheader', { name: 'Cal.com' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Zoho Mail (SMTP)' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Journaux de sécurité du serveur' })).toBeVisible();
  await expect(page.getByText(/Le site public n’utilise actuellement ni cookie publicitaire ni outil de mesure d’audience/)).toBeVisible();
  await expect(page.getByText(/Une preuve d’identité proportionnée/)).toBeVisible();
  await expect(page.getByText(/Le retrait d’une autorisation relative au droit à l’image est traité séparément/)).toBeVisible();

  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
});
