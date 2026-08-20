import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const packageFixture = () => ({
  id: 'package-p1-04',
  slug: 'formule-p1-04',
  name: 'Formule éditoriale',
  category: 'Portrait',
  description: 'Résumé public de la formule.',
  content: 'Séance éditoriale avec accompagnement.',
  inclusions: ['Direction artistique', 'Dix fichiers retouchés'],
  conditions: 'Acompte requis et report selon les CGV.',
  legalText: 'Prix TTC, modalités de paiement et conditions de report.',
  effectiveAt: '2026-08-02T10:00:00.000Z',
  price: 45000,
  currency: 'XAF',
  durationMin: 120,
  deliveryLabel: 'Livraison sous dix jours',
  sortOrder: 1,
  version: 1,
  publishedVersion: null,
  publicationStatus: 'DRAFT',
  isActive: false,
  isArchived: false,
  _count: { reservations: 0, reservationIntents: 0 },
});

const installAdminApi = async (page) => {
  let pack = packageFixture();
  const calls = { validate: 0, publish: 0, archive: 0, create: 0 };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') return json(route, { data: { id: 'owner-p1-04', name: 'Owner P1-04', role: 'OWNER' } });
    if (path === '/api/admin/packages' && request.method() === 'GET') return json(route, { data: [pack] });
    if (path === '/api/admin/packages' && request.method() === 'POST') {
      calls.create += 1;
      return json(route, { data: pack }, 201);
    }
    if (path === '/api/admin/packages/package-p1-04/validate' && request.method() === 'POST') {
      calls.validate += 1;
      pack = { ...pack, publicationStatus: 'VALIDATED', validatedAt: new Date().toISOString() };
      return json(route, { data: pack });
    }
    if (path === '/api/admin/packages/package-p1-04/publish' && request.method() === 'POST') {
      calls.publish += 1;
      pack = {
        ...pack,
        publicationStatus: 'PUBLISHED',
        publishedVersion: 1,
        isActive: true,
        publishedAt: new Date().toISOString(),
        publishedBy: { id: 'owner-p1-04', name: 'Owner P1-04' },
      };
      return json(route, { data: pack });
    }
    if (path === '/api/admin/packages/package-p1-04/archive' && request.method() === 'POST') {
      calls.archive += 1;
      pack = { ...pack, publicationStatus: 'ARCHIVED', isActive: false, isArchived: true };
      return json(route, { data: pack });
    }
    if (['/api/admin/reservations', '/api/admin/leads', '/api/admin/media', '/api/admin/availability-blocks', '/api/admin/notifications'].includes(path)) {
      return json(route, { data: [] });
    }
    return json(route, { error: { message: 'Route inattendue: ' + request.method() + ' ' + path } }, 500);
  });
  return calls;
};

const openTariffs = async (page) => {
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
  if ((page.viewportSize()?.width || 1280) < 992) await page.locator('.admin-menu-toggle').click();
  await page.getByRole('button', { name: 'Tarifs' }).click();
};

test('P1-04 previews, validates, publishes and archives one immutable tariff version', async ({ page }) => {
  const calls = await installAdminApi(page);
  await openTariffs(page);

  await expect(page.getByText('Brouillon', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Aperçu avant publication' }).click();
  const preview = page.getByRole('dialog', { name: /Aperçu avant publication/ });
  await expect(preview.getByText('Séance éditoriale avec accompagnement.')).toBeVisible();
  await expect(preview.getByText('Prix TTC, modalités de paiement et conditions de report.')).toBeVisible();
  await preview.getByRole('button', { name: 'Fermer la fenêtre' }).click();

  await page.getByRole('button', { name: 'Valider les mentions' }).click();
  let dialog = page.getByRole('dialog', { name: 'Valider les mentions' });
  await dialog.getByRole('button', { name: 'Valider les mentions' }).click();
  await expect(page.getByText('Mentions validées', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Publier la formule' }).click();
  dialog = page.getByRole('dialog', { name: 'Publier la formule' });
  await dialog.getByRole('button', { name: 'Publier la formule' }).click();
  await expect(page.getByText('Publié', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Archiver' }).click();
  dialog = page.getByRole('dialog', { name: 'Archiver la formule' });
  await dialog.getByRole('button', { name: 'Archiver la formule' }).click();
  await expect(page.getByText('Archivé', { exact: true })).toBeVisible();

  expect(calls).toMatchObject({ validate: 1, publish: 1, archive: 1 });
});

test('P1-04 exposes every mandatory draft field without mobile overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const calls = await installAdminApi(page);
  await openTariffs(page);
  await page.getByRole('button', { name: 'Créer un brouillon' }).click();
  const dialog = page.getByRole('dialog', { name: 'Créer un brouillon tarifaire' });

  for (const label of [
    'Nom *',
    'Montant *',
    'Devise *',
    'Durée en minutes — vide si prise de contact',
    'Contenu de la formule *',
    'Inclusions — une par ligne *',
    'Conditions applicables *',
    'Mentions obligatoires *',
    'Date d’effet à Douala *',
  ]) {
    await expect(dialog.getByLabel(label, { exact: true })).toBeVisible();
  }
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Créer le brouillon' }).click();
  await expect(dialog.getByText('Ce champ est obligatoire.').first()).toBeVisible();
  expect(calls.create).toBe(0);
});
