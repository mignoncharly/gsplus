import { expect, test } from '@playwright/test';

const databaseMedia = {
  id: 'phase8-family',
  title: 'Portrait de famille',
  altText: 'Portrait de famille en studio à Douala',
  category: 'Famille',
  url: '/images/optimized/engagement-1024.webp',
  thumbnailUrl: '/images/optimized/engagement-480.webp',
  width: 1024,
  height: 1024,
  thumbnailWidth: 480,
  thumbnailHeight: 480,
  mimeType: 'image/webp',
  fileSize: 234004,
  thumbnailFileSize: 64384,
  objectPosition: 'center top',
};

const apiPayload = async (route) => {
  const url = new URL(route.request().url());
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
  if (url.pathname === '/api/media') {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [databaseMedia] }),
    });
  }
  if (url.pathname === '/api/packages') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  }
  if (url.pathname === '/api/admin/me') {
    return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UNAUTHORIZED' } }) });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', apiPayload);
});

test('portfolio augments curated database media with responsive local coverage', async ({ page }) => {
  await page.goto('/portfolio', { waitUntil: 'domcontentloaded' });

  const items = page.locator('.portfolio-grid .portfolio-item');
  await expect(items).toHaveCount(7);
  await expect(page.getByRole('button', { name: 'Famille', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /QA_TEST|hero/i })).toHaveCount(0);

  const galleryImages = items.locator('img');
  await expect(galleryImages).toHaveCount(7);
  for (let index = 0; index < 7; index += 1) {
    const image = galleryImages.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute('srcset', /480w.*1024w|640w.*\d+w/);
    await expect(image).toHaveAttribute('loading', 'lazy');
    await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
  }

  await page.getByRole('button', { name: 'Maternité', exact: true }).click();
  await expect(items).toHaveCount(1);
  await expect(items.locator('img')).toHaveAttribute('alt', /maternité/i);

  await items.first().click();
  const dialog = page.getByRole('dialog', { name: 'Aperçu de la photographie' });
  await expect(dialog.locator('img')).toHaveAttribute('src', /portfolio-maternity-1024\.webp$/);
  await expect.poll(() => dialog.locator('img').evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
});

test('public image routes load optimized assets without broken responses', async ({ page }) => {
  const failures = [];
  page.on('response', (response) => {
    if (response.request().resourceType() === 'image' && response.status() >= 400) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });

  for (const route of ['/', '/portfolio', '/a-propos']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    if (route === '/portfolio') {
      await expect(page.locator('.portfolio-grid .portfolio-item')).toHaveCount(7);
    }
    const images = page.locator('main img');
    const count = await images.count();
    for (let index = 0; index < count; index += 1) {
      const image = images.nth(index);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
    }
    const states = await images.evaluateAll((elements) => elements.map((image) => ({
      src: image.currentSrc || image.src,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      alt: image.getAttribute('alt'),
    })));
    expect(states.every((image) => image.alt !== null), `${route}: ${JSON.stringify(states)}`).toBe(true);
    expect(states.filter((image) => image.src).every((image) => image.src.includes('/images/optimized/'))).toBe(true);
  }

  expect(failures).toEqual([]);
});
