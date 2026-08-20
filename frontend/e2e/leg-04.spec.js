import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const packageFixture = {
  id: 'leg-04-pack', slug: 'leg-04-pack', name: 'Portrait LEG-04', category: 'Portrait',
  price: 25000, durationMin: 60, isRange: false, isPromo: false, sortOrder: 1,
};

const installPublicApi = async (page) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/packages') return json(route, { data: [packageFixture] });
    if (path === '/api/availability') return json(route, { data: { days: [{
      date: '2030-01-10', isClosed: false, slots: [{
        time: '10:00', endTime: '11:00', startAt: '2030-01-10T09:00:00.000Z',
        endAt: '2030-01-10T10:00:00.000Z', available: true,
      }],
    }] } });
    if (path === '/api/reservation-intents') return json(route, { data: {
      id: 'intent-leg-04', reference: 'GSP-LEG04', startAt: '2030-01-10T09:00:00.000Z',
      endAt: '2030-01-10T10:00:00.000Z', expiresAt: '2030-01-10T09:15:00.000Z',
    } }, 201);
    if (path === '/api/admin/me') return json(route, { error: { message: 'Non authentifié' } }, 401);
    if (path === '/api/health') return json(route, { status: 'ok' });
    return json(route, { data: [] });
  });
};

const openPublicChoices = async (page) => {
  await page.goto('/reservation', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Continuer/ }).evaluate((button) => button.click());
  await page.locator('.date-card-btn').first().click();
  await page.locator('.slot-available').first().click();
  const continueButton = page.getByRole('button', { name: /Continuer/ });
  await expect(continueButton).toBeEnabled();
  await continueButton.evaluate((button) => button.click());
  await expect(page.getByRole('heading', { name: 'Création de votre Profil' })).toBeVisible();
};

const adminReservation = () => ({
  id: 'reservation-leg-04', reference: 'GSP-LEG04', version: 1,
  status: 'PENDING_CONFIRMATION', startAt: '2030-01-10T09:00:00.000Z', endAt: '2030-01-10T10:00:00.000Z',
  snapshot: { firstName: 'Alice', lastName: 'Consentement', notificationPhoneE164: '+237640703249', notificationEmail: 'alice@example.test', email: 'alice@example.test' },
  customer: { firstName: 'Alice', lastName: 'Consentement', phone: '+237640703249' },
  package: { id: 'leg-04-pack', name: 'Portrait LEG-04', price: 25000 }, packageVersion: { version: 1 },
  payments: [], transitions: [], calendarSyncLogs: [], rescheduleRequests: [], withdrawalRequests: [], deliveries: [],
  imageConsentEvents: [{
    id: 'image-consent-initial', choice: 'GRANTED', purpose: 'PORTFOLIO_AND_PROMOTION',
    scope: ['WEBSITE', 'INSTAGRAM', 'TIKTOK'], source: 'PUBLIC_BOOKING',
    effectiveAt: '2026-08-08T10:00:00.000Z', legalVersion: { version: '2026-07-31' },
  }],
});

const installAdminApi = async (page) => {
  let reservation = adminReservation();
  const calls = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') return json(route, { data: { id: 'owner-leg-04', name: 'Owner LEG-04', role: 'OWNER' } });
    if (path === '/api/admin/reservations/reservation-leg-04/image-consent-events' && request.method() === 'POST') {
      const body = request.postDataJSON();
      calls.push(body);
      const event = {
        id: 'image-consent-withdrawn', choice: body.choice, priorEventId: body.expectedPriorEventId,
        purpose: 'PORTFOLIO_AND_PROMOTION', scope: ['WEBSITE', 'INSTAGRAM', 'TIKTOK'],
        source: 'ADMIN_RECORDED_CUSTOMER_CHOICE', effectiveAt: body.receivedAt,
        legalVersion: { version: '2026-07-31' }, recordedBy: { id: 'owner-leg-04', name: 'Owner LEG-04' },
      };
      reservation = { ...reservation, imageConsentEvents: [event, ...reservation.imageConsentEvents] };
      return json(route, { data: { event, replayed: false, effectNotice: 'Le retrait produit effet pour l’avenir.' } }, 201);
    }
    if (path === '/api/admin/reservations/reservation-leg-04') return json(route, { data: reservation });
    if (path === '/api/admin/reservations') return json(route, { data: [reservation] });
    if (['/api/admin/leads', '/api/admin/packages', '/api/admin/media', '/api/admin/availability-blocks', '/api/admin/notifications'].includes(path)) return json(route, { data: [] });
    return json(route, { error: { message: `Route inattendue: ${request.method()} ${path}` } }, 500);
  });
  return calls;
};

test('LEG-04 présente quatre choix séparés et ne pré-coche aucun consentement facultatif', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await installPublicApi(page);
  await openPublicChoices(page);

  await expect(page.getByLabel(/J’autorise l’utilisation des images/)).not.toBeChecked();
  await expect(page.getByLabel(/informations liées à ma réservation sur WhatsApp/)).not.toBeChecked();
  await expect(page.getByLabel(/offres, actualités et communications promotionnelles/)).not.toBeChecked();
  await expect(page.getByLabel(/Je reconnais avoir pris connaissance/)).not.toBeChecked();
  await expect(page.getByRole('link', { name: 'Conditions générales de vente' })).toHaveAttribute('href', '/cgv');
  await expect(page.getByRole('link', { name: 'Politique de confidentialité' })).toHaveAttribute('href', '/confidentialite');
  const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
});

test('LEG-04 enregistre un retrait propriétaire prospectif avec preuve et version attendue', async ({ page }) => {
  const calls = await installAdminApi(page);
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
  await page.getByRole('button', { name: 'Réservations' }).click();
  await page.getByRole('button', { name: 'Détails' }).click();

  await expect(page.getByText('Historique du droit à l’image')).toBeVisible();
  await expect(page.getByText('Autorisation active', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer le retrait image' }).click();
  const dialog = page.getByRole('dialog', { name: 'Enregistrer le retrait du droit à l’image' });
  await expect(dialog.getByLabel('Canal de preuve *')).toHaveValue('EMAIL');
  await dialog.getByLabel('Preuve du choix explicite *').fill('Message-ID client archivé dans la boîte professionnelle.');
  await dialog.getByRole('button', { name: 'Enregistrer le retrait image' }).click();

  await expect(page.getByText('Autorisation retirée', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/n’efface pas les preuves antérieures/)).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    expectedPriorEventId: 'image-consent-initial', choice: 'WITHDRAWN', requestChannel: 'EMAIL',
  });
});
