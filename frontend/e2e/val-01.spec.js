import { expect, test } from '@playwright/test';

const futureDate = '2027-08-04';
const packageFixture = {
  id: 'val-01-pack',
  slug: 'val-01-pack',
  name: 'Pack VAL-01',
  category: 'Portrait',
  price: 50000,
  durationMin: 60,
  bookingMode: 'DIRECT',
  isRange: false,
  isPromo: false,
  sortOrder: 10,
};

const json = (route, data, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(data),
});

const installApi = async (page, options = {}) => {
  const calls = { contact: 0 };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (url.pathname === '/api/packages') return json(route, { data: [packageFixture] });
    if (url.pathname === '/api/media') return json(route, { data: [] });
    if (url.pathname === '/api/admin/me') return json(route, { error: { message: 'Non authentifié' } }, 401);
    if (url.pathname === '/api/availability') {
      return json(route, { data: { days: [{
        date: futureDate,
        isClosed: false,
        slots: [{
          time: '10:00',
          endTime: '11:00',
          startAt: '2027-08-04T09:00:00.000Z',
          endAt: '2027-08-04T10:00:00.000Z',
          available: true,
          reason: null,
        }],
      }] } });
    }
    if (url.pathname === '/api/reservation-intents') {
      return json(route, { data: {
        id: 'val-01-intent',
        reference: 'GSP-VAL01',
        startAt: '2027-08-04T09:00:00.000Z',
        endAt: '2027-08-04T10:00:00.000Z',
        expiresAt: '2030-01-01T00:15:00.000Z',
      } }, 201);
    }
    if (url.pathname === '/api/contact') {
      calls.contact += 1;
      if (options.contactError) return json(route, options.contactError, 400);
      return json(route, { data: { id: 'val-01-lead' } }, 201);
    }
    return json(route, { data: [] });
  });
  return calls;
};

const openReservationProfile = async (page) => {
  await page.goto('/reservation', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /Continuer/ })).toBeEnabled();
  await page.getByRole('button', { name: /Continuer/ }).evaluate((button) => button.click());
  await expect(page.getByRole('heading', { name: 'Choisissez votre créneau' })).toBeVisible();
  await page.locator('.date-card-btn').first().click();
  await page.locator('.slot-available').first().click();
  await expect(page.getByRole('button', { name: /Continuer/ })).toBeEnabled();
  await page.getByRole('button', { name: /Continuer/ }).evaluate((button) => button.click());
  await expect(page.getByRole('heading', { name: 'Création de votre Profil' })).toBeVisible();
};

test('VAL-01 links French phone and email errors to reservation fields and preserves values', async ({ page }) => {
  await installApi(page);
  await openReservationProfile(page);
  await page.getByLabel('Nom *', { exact: true }).fill('Validation');
  await page.getByLabel('Prénom *').fill('Alice');
  const phone = page.getByLabel('Téléphone (WhatsApp) *');
  const email = page.getByLabel('Adresse email *');
  await phone.fill('640ABC249');
  await email.fill('alice@localhost');
  await page.getByLabel('Genre *').selectOption('Feminin');
  await page.getByLabel(/Je reconnais avoir pris connaissance/).check();
  await page.getByRole('button', { name: /Continuer/ }).click();

  await expect(page.getByText('Saisissez un numéro camerounais valide, par exemple 640 70 32 49.')).toBeVisible();
  await expect(page.getByText('Saisissez une adresse e-mail valide.')).toBeVisible();
  await expect(phone).toHaveAttribute('aria-invalid', 'true');
  await expect(phone).toHaveAttribute('aria-describedby', 'booking-phone-error');
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAttribute('aria-describedby', 'booking-email-error');
  await expect(phone).toHaveValue('640ABC249');
  await expect(email).toHaveValue('alice@localhost');

  await phone.fill('640 70 32 49');
  await email.fill('Alice@EXAMPLE.COM');
  await expect(page.locator('#booking-phone-error')).toBeHidden();
  await expect(page.locator('#booking-email-error')).toBeHidden();
  await page.getByRole('button', { name: /Continuer/ }).click();
  await expect(page.getByLabel('Opérateur Mobile utilisé')).toBeVisible();
});

test('VAL-01 blocks WhatsApp consent without a phone before calling the contact API', async ({ page }) => {
  const calls = await installApi(page);
  await page.goto('/contact', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Nom complet *').fill('Alice Validation');
  await page.getByLabel('Email *').fill('alice@example.com');
  await page.getByLabel('Votre message *').fill('Je souhaite obtenir des informations complémentaires.');
  await page.getByText(/J’accepte de recevoir sur WhatsApp/).click();
  await page.getByRole('button', { name: /Envoyer le message/ }).click();

  const phone = page.getByLabel('Téléphone (requis uniquement pour WhatsApp)');
  await expect(page.getByText('Renseignez un téléphone camerounais pour recevoir les informations sur WhatsApp.')).toBeVisible();
  await expect(phone).toHaveAttribute('aria-invalid', 'true');
  await expect(phone).toHaveAttribute('aria-describedby', 'contact-phone-error');
  expect(calls.contact).toBe(0);
});

test('VAL-01 displays structured server validation details beside the matching contact field', async ({ page }) => {
  await installApi(page, { contactError: { error: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: [{ path: 'email', message: 'Cette adresse e-mail est invalide côté serveur.' }],
  } } });
  await page.goto('/contact', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Nom complet *').fill('Alice Validation');
  await page.getByLabel('Email *').fill('alice@example.com');
  await page.getByLabel('Votre message *').fill('Je souhaite obtenir des informations complémentaires.');
  await page.getByRole('button', { name: /Envoyer le message/ }).click();

  const email = page.getByLabel('Email *');
  await expect(page.getByText('Cette adresse e-mail est invalide côté serveur.')).toBeVisible();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveValue('alice@example.com');
});
