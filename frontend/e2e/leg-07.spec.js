import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const reservationFixture = () => ({
  id: 'reservation-leg-07',
  reference: 'GSP-LEG07',
  version: 1,
  status: 'COMPLETED',
  startAt: '2026-08-08T09:00:00.000Z',
  endAt: '2026-08-08T10:00:00.000Z',
  snapshot: {
    firstName: 'Alice',
    lastName: 'Média',
    notificationPhoneE164: '+237640703249',
    notificationEmail: 'alice@example.test',
    email: 'alice@example.test',
  },
  customer: { firstName: 'Alice', lastName: 'Média', phone: '+237640703249' },
  package: { id: 'pack-leg-07', name: 'Portrait LEG-07', price: 25000 },
  packageVersion: { version: 1 },
  payments: [],
  transitions: [],
  calendarSyncLogs: [],
  rescheduleRequests: [],
  withdrawalRequests: [],
  deliveries: [],
  imageConsentEvents: [{
    id: 'grant-leg-07',
    choice: 'GRANTED',
    purpose: 'PORTFOLIO_AND_PROMOTION',
    scope: ['WEBSITE', 'INSTAGRAM', 'TIKTOK'],
    effectiveAt: '2026-08-08T10:00:00.000Z',
    legalVersion: { version: '2026-07-31' },
  }],
});

const mediaFixtures = () => ([
  {
    id: 'catalog-leg-07',
    title: 'Catalogue approuvé LEG-07',
    altText: 'Média du catalogue propriétaire',
    url: '/favicon-32.png',
    thumbnailUrl: '/favicon-32.png',
    category: 'Corporate',
    isPublished: true,
    isFeatured: false,
    rightsBasis: 'OWNER_APPROVED_CATALOG',
    rightsEvidence: { manifest: 'private-media/phase8-curated/manifest.json' },
    reservation: null,
    consentUsages: [],
  },
  {
    id: 'client-leg-07',
    title: 'Portrait client LEG-07',
    altText: 'Portrait client avec autorisation active',
    url: '/favicon-32.png',
    thumbnailUrl: '/favicon-32.png',
    category: 'Portrait',
    isPublished: true,
    isFeatured: false,
    rightsBasis: 'CUSTOMER_IMAGE_AUTHORIZATION',
    reservation: { id: 'reservation-leg-07', reference: 'GSP-LEG07' },
    consentUsages: [{
      id: 'usage-leg-07',
      status: 'ACTIVE',
      grantEvent: {
        id: 'grant-leg-07',
        choice: 'GRANTED',
        purpose: 'PORTFOLIO_AND_PROMOTION',
        scope: ['WEBSITE', 'INSTAGRAM', 'TIKTOK'],
        legalVersion: { version: '2026-07-31' },
      },
      withdrawalEvent: null,
    }],
  },
]);

const installAdminApi = async (page) => {
  let reservation = reservationFixture();
  let media = mediaFixtures();
  const calls = [];

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') {
      return json(route, { data: { id: 'owner-leg-07', name: 'Owner LEG-07', role: 'OWNER' } });
    }
    if (path === '/api/admin/media' && request.method() === 'GET') return json(route, { data: media });
    if (path === '/api/admin/media/client-leg-07' && request.method() === 'PATCH') {
      const body = request.postDataJSON();
      calls.push({ path, body });
      if (body.isPublished && media[1].consentUsages[0]?.status !== 'ACTIVE') {
        return json(route, {
          error: {
            code: 'IMAGE_CONSENT_REQUIRED',
            message: 'L’autorisation d’image active doit couvrir le portfolio du site avant publication.',
          },
        }, 409);
      }
      media = media.map((item) => item.id === 'client-leg-07' ? { ...item, ...body } : item);
      return json(route, { data: media[1] });
    }
    if (path === '/api/admin/reservations/reservation-leg-07/image-consent-events' && request.method() === 'POST') {
      const body = request.postDataJSON();
      calls.push({ path, body });
      const event = {
        id: 'withdrawal-leg-07',
        choice: 'WITHDRAWN',
        priorEventId: body.expectedPriorEventId,
        purpose: 'PORTFOLIO_AND_PROMOTION',
        scope: ['WEBSITE', 'INSTAGRAM', 'TIKTOK'],
        effectiveAt: body.receivedAt,
        legalVersion: { version: '2026-07-31' },
      };
      reservation = { ...reservation, imageConsentEvents: [event, ...reservation.imageConsentEvents] };
      media = media.map((item) => item.id === 'client-leg-07' ? {
        ...item,
        isPublished: false,
        isFeatured: false,
        consentUsages: [{
          ...item.consentUsages[0],
          status: 'WITHDRAWN',
          withdrawalEvent: event,
        }],
      } : item);
      return json(route, {
        data: {
          event,
          replayed: false,
          effectNotice: 'Le retrait produit effet pour l’avenir et dépublie les contenus liés.',
        },
      }, 201);
    }
    if (path === '/api/admin/reservations/reservation-leg-07') return json(route, { data: reservation });
    if (path === '/api/admin/reservations') return json(route, { data: [reservation] });
    if (path === '/api/admin/data-governance') return json(route, { data: { policies: [], requests: [] } });
    if ([
      '/api/admin/leads',
      '/api/admin/packages',
      '/api/admin/availability-blocks',
      '/api/admin/notifications',
    ].includes(path)) return json(route, { data: [] });
    return json(route, { error: { message: `Route inattendue ${request.method()} ${path}` } }, 404);
  });

  return calls;
};

test('LEG-07 affiche la base de droits et garde la publication directe désactivée', async ({ page }) => {
  await installAdminApi(page);
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
  await page.getByRole('button', { name: 'Portfolio' }).click();

  await expect(page.getByLabel('Référence de réservation *')).toHaveAttribute('required', '');
  await expect(page.getByLabel('Publier directement')).not.toBeChecked();
  await expect(page.locator('p').filter({ hasText: 'Base de droits : Catalogue propriétaire approuvé' })).toBeVisible();
  await expect(page.locator('p').filter({ hasText: 'Base de droits : Autorisation active' })).toBeVisible();
  await expect(page.getByText('GSP-LEG07', { exact: false })).toBeVisible();
});

test('LEG-07 rend le retrait effectif et bloque toute nouvelle publication', async ({ page }) => {
  const calls = await installAdminApi(page);
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
  await page.getByRole('button', { name: 'Réservations' }).click();
  await page.getByRole('button', { name: 'Détails' }).evaluate((button) => button.click());
  await expect(page.getByRole('heading', { name: 'Réservation GSP-LEG07' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer le retrait image' })).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer le retrait image' }).click();
  const dialog = page.getByRole('dialog', { name: 'Enregistrer le retrait du droit à l’image' });
  await dialog.getByLabel('Preuve du choix explicite *').fill('Message-ID LEG-07 archivé.');
  await dialog.getByRole('button', { name: 'Enregistrer le retrait image' }).click();
  await expect(page.getByText('Autorisation retirée', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Fermer la fenêtre' }).click();

  await page.getByRole('button', { name: 'Portfolio' }).click();
  const card = page.locator('.admin-stat-card').filter({ hasText: 'Portrait client LEG-07' });
  await expect(card.locator('p').filter({ hasText: 'Base de droits : Autorisation retirée' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Publier' })).toBeVisible();
  await card.getByRole('button', { name: 'Publier' }).click();
  await expect(page.getByText(/autorisation d’image active doit couvrir/i)).toBeVisible();

  expect(calls).toEqual(expect.arrayContaining([
    expect.objectContaining({ body: expect.objectContaining({ choice: 'WITHDRAWN' }) }),
    expect.objectContaining({ body: { isPublished: true } }),
  ]));
});
