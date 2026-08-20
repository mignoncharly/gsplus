import { expect, test } from '@playwright/test';

const packageFixture = {
  id: 'p1-02-pack',
  slug: 'p1-02-pack',
  name: 'Pack P1-02',
  category: 'Portrait',
  price: 50000,
  durationMin: 60,
  isRange: false,
  isPromo: false,
  sortOrder: 10,
};

const slot = (date, time = '10:00', overrides = {}) => ({
  time,
  endTime: '11:00',
  startAt: `${date}T09:00:00.000Z`,
  endAt: `${date}T10:00:00.000Z`,
  available: true,
  reason: null,
  ...overrides,
});

const json = (route, data, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(data),
});

const installApi = async (page, options = {}) => {
  const calls = { availability: 0, freeAvailability: 0, intents: 0 };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (url.pathname === '/api/packages') return json(route, { data: [packageFixture] });
    if (url.pathname === '/api/media') return json(route, { data: [] });
    if (url.pathname === '/api/admin/me') return json(route, { error: { message: 'Non authentifié' } }, 401);

    if (url.pathname === '/api/availability') {
      calls.availability += 1;
      const date = url.searchParams.get('from');
      if (date === url.searchParams.get('to')) calls.freeAvailability += 1;
      const response = options.availability?.(date, calls.availability) ?? {
        days: [{ date, isClosed: false, slots: [slot(date)] }],
      };
      if (response.delay) await new Promise((resolve) => setTimeout(resolve, response.delay));
      if (response.error) return json(route, { error: { message: response.error } }, 503);
      return json(route, { data: response });
    }

    if (url.pathname === '/api/reservation-intents') {
      calls.intents += 1;
      const body = request.postDataJSON();
      if (options.intentDelay) await new Promise((resolve) => setTimeout(resolve, options.intentDelay));
      return json(route, {
        data: {
          id: `p1-02-intent-${calls.intents}`,
          reference: 'GSP-P102',
          startAt: body.startAt,
          endAt: body.startAt,
          expiresAt: '2028-01-01T00:15:00.000Z',
        },
      }, 201);
    }

    return json(route, { data: [] });
  });

  return calls;
};

const openFreeMode = async (page) => {
  await page.goto('/reservation', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /Continuer/ })).toBeEnabled();
  await page.getByRole('button', { name: /Continuer/ }).evaluate((button) => button.click());
  await expect(page.getByRole('heading', { name: 'Choisissez votre créneau' })).toBeVisible();
  const freeMode = page.getByRole('button', { name: 'Proposer mon horaire' });
  await freeMode.focus();
  await freeMode.press('Enter');
};

test('free proposal keeps its values, blocks duplicate verification and preserves the profile on back', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  const calls = await installApi(page, { intentDelay: 300 });
  await openFreeMode(page);

  const date = page.getByLabel('Date souhaitée');
  const time = page.getByLabel('Heure souhaitée');
  const verify = page.getByRole('button', { name: 'Vérifier la disponibilité' });
  await date.fill('2027-08-04');
  await time.fill('10:00');
  await verify.focus();
  await verify.evaluate((button) => {
    button.click();
    button.click();
  });

  const busyVerify = page.getByRole('button', { name: 'Vérification en cours…' });
  await expect(busyVerify).toBeDisabled();
  await expect(busyVerify).toHaveAttribute('aria-busy', 'true');
  await expect(date).toHaveValue('2027-08-04');
  await expect(time).toHaveValue('10:00');
  await expect(page.getByText('Créneau Disponible !')).toBeVisible();
  expect(calls.freeAvailability).toBe(1);
  expect(calls.intents).toBe(1);

  await expect(page.getByRole('button', { name: /Continuer/ })).toBeEnabled();
  const continueToProfile = page.getByRole('button', { name: /Continuer/ });
  await continueToProfile.evaluate((button) => button.click());
  await expect(page.getByRole('heading', { name: 'Création de votre Profil' })).toBeVisible();
  await expect(page.getByLabel('Nom *', { exact: true })).toBeVisible();
  await page.getByLabel('Nom *', { exact: true }).fill('Test');
  await page.getByLabel('Prénom *').fill('P1-02');
  await page.getByLabel('Téléphone (WhatsApp) *').fill('+237673026654');
  await page.getByLabel('Adresse email *').fill('p1-02@example.com');
  await page.getByLabel('Genre *').selectOption('Feminin');
  await page.getByRole('button', { name: /Retour/ }).click();

  await expect(date).toHaveValue('2027-08-04');
  await expect(time).toHaveValue('10:00');
  await page.getByRole('button', { name: /Continuer/ }).click();
  await expect(page.getByLabel('Nom *', { exact: true })).toHaveValue('Test');
  await expect(page.getByLabel('Adresse email *')).toHaveValue('p1-02@example.com');
});

test('editing the proposal invalidates a stale availability response', async ({ page }) => {
  await installApi(page, {
    availability: (date) => ({
      delay: date === '2027-08-04' ? 200 : 0,
      days: [{ date, isClosed: false, slots: [slot(date)] }],
    }),
  });
  await openFreeMode(page);

  const date = page.getByLabel('Date souhaitée');
  await date.fill('2027-08-04');
  await page.getByLabel('Heure souhaitée').fill('10:00');
  await page.getByRole('button', { name: 'Vérifier la disponibilité' }).click({ noWaitAfter: true });
  await date.fill('2027-08-05');

  await page.waitForTimeout(300);
  await expect(date).toHaveValue('2027-08-05');
  await expect(page.getByText('Créneau Disponible !')).toBeHidden();
  await expect(page.getByRole('button', { name: /Continuer/ })).toBeDisabled();
});

test('free proposal reports closed, occupied, duration and server-error states explicitly', async ({ page }) => {
  await installApi(page, {
    availability: (date) => {
      if (date === '2027-08-04') return { days: [{ date, isClosed: true, slots: [] }] };
      if (date === '2027-08-05') return {
        days: [{ date, isClosed: false, slots: [slot(date, '10:00', { available: false, reason: 'reservation' })] }],
      };
      if (date === '2027-08-06') return { days: [{ date, isClosed: false, slots: [slot(date, '11:00')] }] };
      return { error: 'Agenda temporairement indisponible.' };
    },
  });
  await openFreeMode(page);

  const date = page.getByLabel('Date souhaitée');
  const time = page.getByLabel('Heure souhaitée');
  const verify = page.getByRole('button', { name: 'Vérifier la disponibilité' });
  await time.fill('10:00');

  await date.fill('2026-08-02');
  await verify.click();
  await expect(page.getByText('La date doit être dans le futur.')).toBeVisible();

  await date.fill('2027-08-04');
  await verify.click();
  await expect(page.getByText('Le studio est fermé ce jour-là.')).toBeVisible();

  await date.fill('2027-08-05');
  await verify.click();
  await expect(page.getByText(/déjà réservé/)).toBeVisible();

  await date.fill('2027-08-06');
  await verify.click();
  await expect(page.getByText(/n[’']est pas proposé pour la durée choisie/)).toBeVisible();

  await date.fill('2027-08-07');
  await verify.click();
  await expect(page.getByText('Agenda temporairement indisponible.')).toBeVisible();
});
