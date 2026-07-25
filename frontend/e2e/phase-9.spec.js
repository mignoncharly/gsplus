import { expect, test } from '@playwright/test';

const packageFixtures = [
  { id: 'phase9-classic', slug: 'classic-propre', name: 'Classic Propre', category: 'Portrait', price: 20000, durationMin: 60, isRange: false, isPromo: false, sortOrder: 10 },
  { id: 'phase9-signature', slug: 'pack-signature', name: 'Pack Signature', category: 'Portrait', price: 35000, durationMin: 120, isRange: false, isPromo: false, sortOrder: 20 },
  { id: 'phase9-duo', slug: 'duo-couple', name: 'Duo Couple', category: 'Famille', price: 30000, durationMin: 90, isRange: false, isPromo: false, sortOrder: 30 },
  { id: 'phase9-premariage', slug: 'pre-mariage-decouverte', name: 'Pre-mariage Decouverte', category: 'Fiancailles & Pre-mariage', price: 40000, durationMin: 120, isRange: true, isPromo: false, sortOrder: 40 },
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (url.pathname === '/api/packages') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: packageFixtures }),
      });
    }
    if (url.pathname === '/api/admin/me') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UNAUTHORIZED' } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });
});

test('July 2026 legal pages are mutually linked and publish the complete privacy register', async ({ page }) => {
  await page.goto('/confidentialite', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Politique de confidentialité');
  await expect(page.getByText('Dernière mise à jour : 24 juillet 2026')).toBeVisible();
  for (const heading of [
    'Données collectées',
    'Finalités et fondements',
    'Destinataires et prestataires',
    'Durées de conservation',
    'Cookies et mesure d’audience',
    'Vos droits',
  ]) {
    await expect(page.getByRole('heading', { name: new RegExp(heading) })).toBeVisible();
  }
  await expect(page.getByRole('rowheader', { name: 'Cal.com' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Zoho Mail (SMTP)' })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Actif pour les notifications transactionnelles/ })).toBeVisible();
  await expect(page.getByText(/portabilité des données/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'conditions générales de vente' })).toHaveAttribute('href', '/cgv');

  await page.getByRole('link', { name: 'mentions légales' , exact: true }).click();
  await expect(page).toHaveURL(/\/mentions-legales$/);
  await expect(page.getByText(/Informations officielles en attente de validation/)).toBeVisible();
  await expect(page.getByText(/numéro RCCM et identifiant fiscal/)).toBeVisible();
  await expect(page.getByText('Hetzner Online GmbH')).toBeVisible();
  await expect(page.getByText(/Industriestr\. 25, 91710 Gunzenhausen/)).toBeVisible();

  await page.getByRole('link', { name: 'conditions générales de vente' }).click();
  await expect(page).toHaveURL(/\/cgv$/);
  await expect(page.getByText(/contrôle manuel du paiement/)).toBeVisible();
  await expect(page.getByText(/absence non signalée/)).toBeVisible();
});

test('approved public copy and package accents render without external icon requests', async ({ page }) => {
  const thirdPartyImages = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'image' && !new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) {
      thirdPartyImages.push(request.url());
    }
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Incontournable')).toBeVisible();
  await expect(page.getByText('Idéal pour un profil professionnel')).toBeVisible();
  await expect(page.getByText(/Livraison sous 72 h/).first()).toBeVisible();

  await page.goto('/services', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('tab', { name: 'Séances photo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pré-mariage Découverte' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fiançailles & Pré-mariage', exact: true })).toBeVisible();

  await page.goto('/contact', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: "Horaires d'ouverture" })).toBeVisible();
  await expect(page.getByText(/Fermé, sauf rendez-vous VIP préalable/)).toBeVisible();
  expect(thirdPartyImages).toEqual([]);
});

test('legal tables remain contained at contracted mobile and tablet widths', async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/confidentialite', '/mentions-legales', '/cgv']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(dimensions.scrollWidth, `${route} at ${width}px`).toBeLessThanOrEqual(dimensions.clientWidth);
    }
  }
});
