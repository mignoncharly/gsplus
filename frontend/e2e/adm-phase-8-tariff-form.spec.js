import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

// Eight sections, exactly as the catalogue has. "Privilèges" holds no formula, which is
// the case the old derived list could not express.
const taxonomy = [
  { key: 'portraits-identite', sortOrder: 10, isActive: true, locales: [{ locale: 'en', label: 'Portraits & identity' }, { locale: 'fr', label: 'Portraits & identité' }] },
  { key: 'evenements', sortOrder: 60, isActive: true, locales: [{ locale: 'en', label: 'Events' }, { locale: 'fr', label: 'Événements' }] },
  { key: 'privileges-golden-promotion', sortOrder: 80, isActive: true, locales: [{ locale: 'en', label: 'Golden privileges' }, { locale: 'fr', label: 'Privilèges Golden — Promotion' }] },
  { key: 'archive-2024', sortOrder: 90, isActive: false, locales: [{ locale: 'en', label: 'Archive 2024' }, { locale: 'fr', label: 'Archive 2024' }] },
];

const packs = [
  { id: 'p1', slug: 'portrait-decouverte', name: 'Portrait Découverte', category: 'Portraits & identité',
    taxonomyKey: 'portraits-identite', price: 10000, currency: 'XAF', durationMin: 30, bookingMode: 'DIRECT',
    isRange: false, options: null, description: 'Résumé', content: 'Contenu de la formule complet.',
    inclusions: ['Une inclusion'], conditions: 'Conditions applicables complètes.', legalText: 'Mentions obligatoires complètes.',
    deliveryLabel: 'Galerie sous 5 jours', effectiveAt: '2026-08-01T08:00:00.000Z', sortOrder: 10, version: 3,
    publicationStatus: 'PUBLISHED', publishedVersion: 3, englishEnabled: false, isArchived: false, locales: [] },
  { id: 'p2', slug: 'abonnement-createur-pro', name: 'Abonnement Créateur Pro', category: 'Événements',
    taxonomyKey: 'evenements', price: 35000, currency: 'XAF', durationMin: null, bookingMode: 'CONTACT',
    isRange: false, options: { priceSuffix: '/ mois', subscription: { commitmentMonths: 3, sessionsPerMonth: 2 } },
    description: 'Abonnement', content: 'Contenu abonnement complet.', inclusions: ['Deux séances'],
    conditions: 'Conditions abonnement complètes.', legalText: 'Mentions abonnement complètes.',
    deliveryLabel: 'Pour connaître les modalités et délais de livraison de cette offre, veuillez nous contacter.',
    effectiveAt: '2026-08-01T08:00:00.000Z', sortOrder: 20, version: 1, publicationStatus: 'DRAFT',
    publishedVersion: null, englishEnabled: false, isArchived: false, locales: [] },
  { id: 'p3', slug: 'evenement-lite', name: 'Événement Lite', category: 'Événements', taxonomyKey: 'evenements',
    price: 80000, currency: 'XAF', durationMin: 120, bookingMode: 'DIRECT', isRange: true, options: null,
    description: 'Événement', content: 'Contenu événement complet.', inclusions: ['Reportage'],
    conditions: 'Conditions événement complètes.', legalText: 'Mentions événement complètes.',
    deliveryLabel: 'Galerie sous 10 jours', effectiveAt: '2026-08-01T08:00:00.000Z', sortOrder: 30, version: 2,
    publicationStatus: 'PUBLISHED', publishedVersion: 2, englishEnabled: false, isArchived: false, locales: [] },
];

const benefits = [
  { id: 'b1', code: 'STUDENT', isActive: true, versions: [{ version: 1, status: 'PUBLISHED', applicationMode: 'MANUAL_CONTACT',
    taxonomyKey: 'privileges-golden-promotion', sortOrder: 10,
    locales: [
      { locale: 'en', name: 'Student benefit', advantage: '−15 %', conditions: 'On presentation of a card.', applicationLabel: 'Applied with the team', mandatoryWording: 'Non cumulable.' },
      { locale: 'fr', name: 'Avantage étudiant', advantage: '−15 %', conditions: 'Sur présentation d’une carte.', applicationLabel: 'Appliqué avec l’équipe', mandatoryWording: 'Non cumulable.' },
    ] }] },
  { id: 'b2', code: 'REFERRAL', isActive: true, versions: [{ version: 2, status: 'DRAFT', applicationMode: 'MANUAL_CONTACT',
    taxonomyKey: 'privileges-golden-promotion', sortOrder: 20,
    locales: [
      { locale: 'en', name: 'Golden referral', advantage: '3,000 / 5,000 FCFA', conditions: 'Both people must book.', applicationLabel: 'Applied with the team', mandatoryWording: 'Non cumulable.' },
      { locale: 'fr', name: 'Parrainage Golden', advantage: '3 000 / 5 000 FCFA', conditions: 'Les deux personnes réservent.', applicationLabel: 'Appliqué avec l’équipe', mandatoryWording: 'Non cumulable.' },
    ] }] },
];

const installAdminApi = async (page) => {
  const calls = { created: [], updated: [], reordered: [], benefits: [], sections: [] };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') return json(route, { data: { id: 'a', name: 'Owner', email: 'o@e.test', role: 'OWNER' } });
    if (path === '/api/admin/packages' && request.method() === 'GET') return json(route, { data: packs });
    if (path === '/api/admin/packages' && request.method() === 'POST') { calls.created.push(request.postDataJSON()); return json(route, { data: {} }, 201); }
    if (path === '/api/admin/catalogue-taxonomy') return json(route, { data: taxonomy });
    if (path === '/api/admin/catalogue-benefits' && request.method() === 'GET') return json(route, { data: benefits });
    if (path === '/api/admin/catalogue-benefits' && request.method() === 'POST') { calls.benefits.push(request.postDataJSON()); return json(route, { data: {} }, 201); }
    if (path.startsWith('/api/admin/catalogue-taxonomy/')) { calls.sections.push(request.postDataJSON()); return json(route, { data: {} }); }
    if (path === '/api/admin/packages/reorder') { calls.reordered.push(request.postDataJSON()); return json(route, { data: packs }); }
    if (path.startsWith('/api/admin/packages/') && request.method() === 'PATCH') { calls.updated.push(request.postDataJSON()); return json(route, { data: {} }); }
    return json(route, { data: [] });
  });
  return calls;
};

const openTarifs = async (page) => {
  await page.goto('/admin/tarifs', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
  await page.getByRole('button', { name: 'Créer un brouillon' }).waitFor();
};

test('§6.2 the eight sections come from the taxonomy, including one holding no formula', async ({ page }) => {
  await installAdminApi(page);
  await openTarifs(page);
  await page.getByRole('button', { name: 'Créer un brouillon' }).click();
  const section = page.locator('.admin-action-dialog').getByLabel('Section publique *');

  await expect(section.locator('option')).toHaveText([
    'Portraits & identité', 'Événements', 'Privilèges Golden — Promotion',
  ]);
  // An inactive section is not offered: the public never shows it, so nothing may be filed there.
  await expect(section.locator('option', { hasText: 'Archive 2024' })).toHaveCount(0);
});

test('§6.2 the identifier follows the name, and stays hidden until advanced settings are shown', async ({ page }) => {
  await installAdminApi(page);
  await openTarifs(page);
  await page.getByRole('button', { name: 'Créer un brouillon' }).click();
  const dialog = page.locator('.admin-action-dialog');

  await expect(dialog.getByLabel('Identifiant URL *')).toHaveCount(0);
  await dialog.getByLabel('Nom *').fill('Maternité Élégance');
  await dialog.getByLabel('Réglages avancés').selectOption('true');
  // Accents are stripped rather than dropped, so the name does not become "maternit-l-gance".
  await expect(dialog.getByLabel('Identifiant URL *')).toHaveValue('maternite-elegance');

  await dialog.getByLabel('Identifiant URL *').fill('offre-maternite');
  await dialog.getByLabel('Nom *').fill('Maternité Douce');
  // Once edited by hand the identifier is the owner's, and the name stops overwriting it.
  await expect(dialog.getByLabel('Identifiant URL *')).toHaveValue('offre-maternite');
});

test('§6.2 the booking mode drives the duration, which is genuinely empty for a contact formula', async ({ page }) => {
  const calls = await installAdminApi(page);
  await openTarifs(page);
  await page.getByRole('button', { name: 'Créer un brouillon' }).click();
  const dialog = page.locator('.admin-action-dialog');

  await expect(dialog.getByLabel('Durée en minutes *')).toBeVisible();
  await dialog.getByLabel('Mode de réservation *').selectOption('CONTACT');
  await expect(dialog.getByLabel('Durée en minutes')).toHaveCount(0);

  await dialog.getByLabel('Nom *').fill('Sur échange');
  await dialog.getByLabel('Montant *').fill('0');
  await dialog.getByRole('button', { name: 'Créer le brouillon' }).click();
  await expect.poll(() => calls.created.length).toBe(1);
  expect(calls.created[0].durationMin).toBeNull();
});

test('§6.2 a draft saves without its public presentation, which publication still requires', async ({ page }) => {
  const calls = await installAdminApi(page);
  await openTarifs(page);
  await page.getByRole('button', { name: 'Créer un brouillon' }).click();
  const dialog = page.locator('.admin-action-dialog');

  // Only the name, the mode, the amount and the section are demanded at this stage.
  await expect(dialog.getByLabel('Résumé public *')).toHaveCount(0);
  await expect(dialog.getByLabel('Contenu de la formule *')).toHaveCount(0);
  await dialog.getByLabel('Nom *').fill('Brouillon en cours');
  await dialog.getByLabel('Durée en minutes *').fill('45');
  await dialog.getByLabel('Montant *').fill('12000');
  await dialog.getByRole('button', { name: 'Créer le brouillon' }).click();

  await expect.poll(() => calls.created.length).toBe(1);
  const payload = calls.created[0];
  expect(payload.content).toBeNull();
  expect(payload.inclusions).toBeNull();
  // A locale row must be complete or absent, so an unfinished draft carries none rather
  // than an empty one the API would refuse.
  expect(payload.locales).toBeUndefined();
});

test('§6.2 the tariff shape drives what the public page prints', async ({ page }) => {
  const calls = await installAdminApi(page);
  await openTarifs(page);
  await page.getByRole('button', { name: 'Créer un brouillon' }).click();
  const dialog = page.locator('.admin-action-dialog');
  await dialog.getByLabel('Nom *').fill('Abonnement test');
  await dialog.getByLabel('Durée en minutes *').fill('60');
  await dialog.getByLabel('Montant *').fill('15000');

  await expect(dialog.getByLabel('Engagement en mois')).toHaveCount(0);
  await dialog.getByLabel('Forme du tarif *').selectOption('PER_MONTH');
  await dialog.getByLabel('Engagement en mois *').fill('3');
  await dialog.getByLabel('Séances par mois *').fill('1');
  await dialog.getByRole('button', { name: 'Créer le brouillon' }).click();

  await expect.poll(() => calls.created.length).toBe(1);
  expect(calls.created[0]).toMatchObject({
    isRange: false,
    options: { priceSuffix: '/ mois', subscription: { commitmentMonths: 3, sessionsPerMonth: 1 } },
  });
});

test('§6.2 a delivery on request writes the studio wording rather than an empty field', async ({ page }) => {
  const calls = await installAdminApi(page);
  await openTarifs(page);
  await page.getByRole('button', { name: 'Créer un brouillon' }).click();
  const dialog = page.locator('.admin-action-dialog');
  await dialog.getByLabel('Nom *').fill('Livraison sur échange');
  await dialog.getByLabel('Durée en minutes *').fill('30');
  await dialog.getByLabel('Montant *').fill('5000');
  await dialog.getByLabel('Livraison *').selectOption('CONTACT');
  await expect(dialog.getByLabel('Délai de livraison', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Créer le brouillon' }).click();

  await expect.poll(() => calls.created.length).toBe(1);
  expect(calls.created[0].deliveryLabel).toContain('veuillez nous contacter');
});

test('§6.2 moving a formula sends the whole order, and the ends cannot be moved off the list', async ({ page }) => {
  const calls = await installAdminApi(page);
  await openTarifs(page);

  await expect(page.getByRole('button', { name: 'Monter Portrait Découverte' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Descendre Événement Lite' })).toBeDisabled();

  await page.getByRole('button', { name: 'Descendre Portrait Découverte' }).click();
  const dialog = page.locator('.admin-action-dialog');
  // The consequence names the neighbour, so the operator knows where it lands.
  await expect(dialog.getByText(/passe après Abonnement Créateur Pro/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Déplacer la formule' }).click();

  await expect.poll(() => calls.reordered.length).toBe(1);
  expect(calls.reordered[0].orderedIds).toEqual(['p2', 'p1', 'p3']);
});

test('§6.2 the tariff shapes a formula cannot express live in the privileges, where the form sends you', async ({ page }) => {
  await installAdminApi(page);
  await openTarifs(page);

  // The tariff form says percentages and shared advantages are managed here, so here has
  // to exist and has to show them.
  await page.getByRole('button', { name: 'Créer un brouillon' }).click();
  await expect(page.locator('.admin-action-dialog').getByText(/pourcentages et les doubles avantages/)).toBeVisible();
  await page.locator('.admin-action-dialog').getByRole('button', { name: 'Annuler' }).click();

  const student = page.locator('.admin-section-row').filter({ hasText: 'Avantage étudiant' });
  await expect(student.getByText('−15 %')).toBeVisible();
  const referral = page.locator('.admin-section-row').filter({ hasText: 'Parrainage Golden' });
  await expect(referral.getByText('3 000 / 5 000 FCFA')).toBeVisible();
  // A published privilege offers no validation step; a draft does.
  await expect(referral.getByRole('button', { name: /Valider les mentions du privilège/ })).toBeVisible();
  await expect(student.getByRole('button', { name: /Valider les mentions du privilège/ })).toHaveCount(0);
});

test('§6.2 a section is renamed from the sections list, never from inside a formula', async ({ page }) => {
  const calls = await installAdminApi(page);
  await openTarifs(page);

  await page.getByRole('button', { name: 'Modifier la rubrique Événements' }).click();
  const dialog = page.locator('.admin-action-dialog');
  await dialog.getByLabel('Libellé français *').fill('Événements & entreprises');
  await dialog.getByRole('button', { name: 'Enregistrer la rubrique' }).click();

  await expect.poll(() => calls.sections.length).toBe(1);
  expect(calls.sections[0]).toMatchObject({ isActive: true, labels: { fr: 'Événements & entreprises' } });
  // An inactive section is listed here — it must be reachable to be switched back on —
  // even though the tariff form refuses to file a formula under it.
  await expect(page.getByRole('button', { name: 'Modifier la rubrique Archive 2024' })).toBeVisible();
});
