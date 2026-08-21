import fs from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const json = (route, data, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(data),
});

test('P2-03 makes disabled progression and unavailable slots explicit on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/packages') return json(route, { data: [{
      id: 'p2-03-pack', slug: 'p2-03-pack', name: 'Pack P2-03', category: 'Portrait',
      price: 50000, durationMin: 60, bookingMode: 'DIRECT', isRange: false, isPromo: false, sortOrder: 1,
    }] });
    if (path === '/api/availability') return json(route, { data: { days: [{
      date: '2027-08-10', isClosed: false, slots: [
        { time: '10:00', endTime: '11:00', available: false, reason: 'reservation' },
        { time: '11:00', endTime: '12:00', available: true, reason: null },
      ],
    }] } });
    if (path === '/api/reservation-intents') return json(route, { data: {
      id: 'p2-03-intent', reference: 'GSP-P203-TEST',
      startAt: '2027-08-10T10:00:00.000Z', endAt: '2027-08-10T11:00:00.000Z',
      expiresAt: '2030-01-01T00:15:00.000Z',
    } }, 201);
    if (path === '/api/admin/me') return json(route, { error: { message: 'Non authentifié' } }, 401);
    return json(route, { data: [] });
  });

  await page.goto('/reservation', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /Continuer/ })).toBeEnabled();
  await page.getByRole('button', { name: /Continuer/ }).evaluate((button) => button.click());

  await expect(page.getByRole('heading', { name: 'Choisissez votre créneau' })).toBeVisible();
  const continueButton = page.getByRole('button', { name: /Continuer/ });
  await expect(continueButton).toBeDisabled();
  await expect(continueButton).toHaveAttribute('aria-describedby', 'booking-slot-disabled-help');
  await expect(page.getByText('Action indisponible : Choisissez un jour.')).toBeVisible();
  await expect(continueButton).toHaveCSS('box-shadow', 'none');
  await expect(continueButton).toHaveCSS('border-style', 'dashed');

  await page.locator('.date-card-btn').first().click();
  const unavailable = page.getByRole('button', { name: /10:00 — .*déjà réservé/i });
  await expect(unavailable).toHaveAttribute('aria-disabled', 'true');
  await unavailable.focus();
  await expect(unavailable).toBeFocused();
  await unavailable.press('Enter');
  await expect(continueButton).toBeDisabled();

  const available = page.locator('.slot-available');
  await expect(available).toBeEnabled();
  await available.evaluate((button) => button.click());
  await expect(continueButton).toBeEnabled();
  await expect(page.locator('#booking-slot-disabled-help')).toHaveCount(0);

  if (new URL(page.url()).hostname === '127.0.0.1') {
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  }));
  expect(results.violations).toEqual([]);
  }
});
