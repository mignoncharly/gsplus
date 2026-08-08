import fs from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const futureDate = '2026-08-03';
const packageFixture = {
  id: 'phase7-pack',
  slug: 'phase7-pack',
  name: 'Pack Phase 7',
  category: 'Portrait',
  price: 50000,
  durationMin: 60,
  isRange: false,
  isPromo: false,
  sortOrder: 10,
};
const slotFixture = {
  time: '10:00',
  endTime: '11:00',
  startAt: '2026-08-03T09:00:00.000Z',
  endAt: '2026-08-03T10:00:00.000Z',
  available: true,
};

const apiPayload = async (route) => {
  const request = route.request();
  const url = new URL(request.url());

  if (request.method() === 'OPTIONS') {
    return route.fulfill({ status: 204 });
  }
  if (url.pathname === '/api/packages') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [packageFixture] }) });
  }
  if (url.pathname === '/api/media') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  }
  if (url.pathname === '/api/availability') {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { days: [{ date: futureDate, isClosed: false, slots: [slotFixture] }] } }),
    });
  }
  if (url.pathname === '/api/reservation-intents') {
    const body = request.postDataJSON();
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'phase7-intent',
          reference: 'GSP-PHASE7',
          startAt: body.startAt,
          endAt: slotFixture.endAt,
          expiresAt: '2026-08-03T09:15:00.000Z',
        },
      }),
    });
  }
  if (url.pathname === '/api/admin/me') {
    return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Non authentifié' } }) });
  }
  if (url.pathname === '/api/health') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
  }

  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
};

const assertNoAxeViolations = async (page, context) => {
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  }));
  expect(results.violations, `${context}: ${results.violations.map((violation) => `${violation.id} (${violation.nodes.length})`).join(', ')}`).toEqual([]);
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', apiPayload);
});

test('public routes and forms pass axe', async ({ page }) => {
  const routes = ['/', '/services', '/portfolio', '/contact', '/corporate', '/services-creatifs', '/a-propos', '/cgv', '/confidentialite', '/mentions-legales', '/admin/login'];

  for (const route of routes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1_000);
    await assertNoAxeViolations(page, route);
  }
});

test('reservation steps expose associated fields and pass axe', async ({ page }) => {
  await page.goto('/reservation', { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Formule de réservation')).toBeEnabled();
  await assertNoAxeViolations(page, 'reservation step 1');

  await expect(page.getByRole('button', { name: /Continuer/ })).toBeEnabled();
  await page.getByRole('button', { name: /Continuer/ }).click();
  await expect(page.getByRole('heading', { name: 'Choisissez votre créneau' })).toBeVisible();
  await page.locator('.date-card-btn').first().click();
  await page.locator('.slot-available').first().click();
  await expect(page.getByRole('button', { name: /Continuer/ })).toBeEnabled();
  await page.getByRole('button', { name: /Continuer/ }).evaluate((button) => button.click());

  await expect(page.getByRole('heading', { name: 'Création de votre Profil' })).toBeVisible();
  await expect(page.getByLabel('Nom *', { exact: true })).toBeVisible();
  await page.getByLabel('Nom *', { exact: true }).fill('Test');
  await page.getByLabel('Prénom *').fill('Phase Sept');
  await page.getByLabel('Téléphone (WhatsApp) *').fill('+237673026654');
  await page.getByLabel('Adresse email *').fill('phase7@example.com');
  await page.getByLabel('Genre *').selectOption('Feminin');
  await page.getByLabel(/J'accepte et certifie/).check();
  await assertNoAxeViolations(page, 'reservation step 3');

  await page.getByRole('button', { name: /Continuer/ }).click();
  await expect(page.getByLabel('Opérateur Mobile utilisé')).toBeVisible();
  await assertNoAxeViolations(page, 'reservation step 4');
});

test('mobile menu manages focus, Escape, inert background and scroll lock', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const toggle = page.getByRole('button', { name: 'Ouvrir le menu' });
  await toggle.click();
  const dialog = page.getByRole('dialog', { name: 'Navigation' });
  const close = dialog.getByRole('button', { name: 'Fermer le menu' });

  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();
  await expect(page.locator('#main-content')).toHaveAttribute('inert', '');
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await expect(page.locator('.mobile-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.mobile-toggle')).toHaveAttribute('aria-label', 'Fermer le menu');

  await close.press('Shift+Tab');
  await expect(dialog.getByRole('link', { name: 'Réserver' })).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Ouvrir le menu' })).toBeFocused();
  await expect(page.locator('#main-content')).not.toHaveAttribute('inert', '');
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('skip link and portfolio lightbox are keyboard operable', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Aller au contenu principal' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();
  await skipLink.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  await page.goto('/portfolio', { waitUntil: 'domcontentloaded' });
  const firstPhoto = page.getByRole('button', { name: /Agrandir/ }).first();
  await firstPhoto.focus();
  await firstPhoto.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Aperçu de la photographie' });
  await expect(dialog.getByRole('button', { name: 'Fermer l’aperçu' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(firstPhoto).toBeFocused();
});

test('forward navigation resets scroll and browser back restores it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('footer').waitFor();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);

  await page.getByRole('link', { name: 'Contact', exact: true }).first().click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
});

test('all contracted viewport widths are free of horizontal overflow', async ({ page }) => {
  test.setTimeout(120_000);
  const widths = [375, 390, 412, 414, 768, 1280, 1440];
  const routes = ['/', '/services', '/portfolio', '/reservation', '/contact'];

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(100);
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(dimensions.scrollWidth, `${route} at ${width}px`).toBeLessThanOrEqual(dimensions.clientWidth);
    }
  }
});

test('footer exposes only genuine contact, business and official social actions', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value) => { window.__copiedSiteUrl = value; } },
    });
  });
  await page.goto('/services?tracking=phase14', { waitUntil: 'domcontentloaded' });

  const footer = page.locator('footer');
  await expect(footer.locator('a[href="#"]')).toHaveCount(0);
  await expect(footer.locator('a[href^="https://wa.me/"]')).toHaveCount(1);
  await expect(footer.getByRole('link', { name: 'Suivre Golden Studio Plus sur Instagram' })).toHaveAttribute('href', 'https://www.instagram.com/goldenstudioplus/');
  await expect(footer.getByRole('link', { name: 'Suivre Golden Studio Plus sur Facebook' })).toHaveAttribute('href', 'https://www.facebook.com/people/Golden-Studio-Plus/61574353412752/');
  await expect(footer.getByRole('link', { name: /LinkedIn/ })).toHaveCount(0);
  await expect(footer.getByRole('link', { name: 'Voir le portfolio Golden Studio Plus' })).toHaveAttribute('href', '/portfolio');
  await expect(footer.getByRole('link', { name: 'Demander un devis pour un service créatif' })).toHaveAttribute('href', '/services-creatifs#devis-creatif');

  await footer.getByRole('button', { name: 'Partager le site Golden Studio Plus' }).click();
  await expect(footer.getByRole('status')).toHaveText('Lien copié dans le presse-papiers.');
  await expect.poll(() => page.evaluate(() => window.__copiedSiteUrl)).toBe('https://gsplus.vip/services');
});

test('Design and Impression galleries show every approved responsive realization', async ({ page }) => {
  await page.goto('/services', { waitUntil: 'domcontentloaded' });

  await page.getByRole('tab', { name: 'Services de design' }).click();
  const designGallery = page.locator('.service-realizations');
  await expect(designGallery.locator('figure')).toHaveCount(9);
  await expect(designGallery.getByRole('heading', { level: 3 })).toHaveText([
    'Retouche photo',
    'Flyers et affiches',
    'Identité visuelle',
    'Objets personnalisés',
  ]);
  await expect(designGallery.locator('img')).toHaveCount(9);

  await page.getByRole('tab', { name: 'Impression et produits' }).click();
  const printGallery = page.locator('.service-realizations');
  await expect(printGallery.locator('figure')).toHaveCount(3);
  await expect(printGallery.getByRole('heading', { level: 3 })).toHaveText(['Albums', 'Cadres et tirages']);

  const printImages = printGallery.locator('img');
  for (let index = 0; index < await printImages.count(); index += 1) {
    const image = printImages.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
  }

  const imageState = await printGallery.locator('img').evaluateAll((images) => images.map((image) => ({
    complete: image.complete,
    naturalWidth: image.naturalWidth,
    src: image.currentSrc,
    width: image.getAttribute('width'),
    height: image.getAttribute('height'),
  })));
  expect(imageState).toHaveLength(3);
  expect(imageState.every((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(imageState.every((image) => image.src.includes('/images/services/'))).toBe(true);
  expect(imageState.every((image) => image.width === '1024' && image.height === '1024')).toBe(true);
});
