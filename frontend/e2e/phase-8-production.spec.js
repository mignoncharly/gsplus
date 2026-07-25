import process from 'node:process';
import { expect, test } from '@playwright/test';

const productionOrigin = process.env.PLAYWRIGHT_BASE_URL;
test.skip(!productionOrigin, 'Production smoke runs only when PLAYWRIGHT_BASE_URL is explicitly provided.');

test('canonical Phase 8 routes and release assets are healthy', async ({ page }) => {
  for (const route of ['/', '/portfolio', '/a-propos']) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('script[type="module"][src^="/assets/index-"][src$=".js"]')).toHaveCount(1);
    await expect(page.locator('link[rel="stylesheet"][href^="/assets/index-"][href$=".css"]')).toHaveCount(1);
  }
});

test('canonical portfolio is curated, responsive, and has no broken media', async ({ page }) => {
  await page.goto('/portfolio', { waitUntil: 'domcontentloaded' });

  const filters = page.locator('.portfolio-filters .filter-btn');
  await expect(filters).toContainText(['Tous', 'Portrait', 'Couple', 'Maternité', 'Corporate']);
  expect((await filters.allTextContents()).join(' ')).not.toMatch(/QA_TEST|hero/i);

  const images = page.locator('.portfolio-grid .portfolio-item img');
  await expect(images).toHaveCount(23);
  for (let index = 0; index < 23; index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute('srcset', /480w.*1024w/);
    await expect(image).toHaveAttribute('loading', 'lazy');
    await expect.poll(() => image.evaluate((element) => ({
      loaded: element.complete && element.naturalWidth > 0,
      source: element.currentSrc,
      alt: element.getAttribute('alt'),
    }))).toMatchObject({
      loaded: true,
      source: /\/(?:uploads\/portfolio\/owner-approved-|images\/optimized\/).+\.webp$/,
      alt: expect.any(String),
    });
  }

  await page.getByRole('button', { name: 'Maternité', exact: true }).click();
  await expect(page.locator('.portfolio-grid .portfolio-item')).toHaveCount(5);
  await page.locator('.portfolio-grid .portfolio-item').first().click();
  const lightboxImage = page.getByRole('dialog', { name: 'Aperçu de la photographie' }).locator('img');
  await expect(lightboxImage).toHaveAttribute('src', /\/uploads\/portfolio\/owner-approved-maternite-\d+-1024\.webp$/);
  await expect.poll(() => lightboxImage.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
});

test('canonical API and responsive derivative contracts are correct', async ({ request }) => {
  const media = await request.get('/api/media');
  expect(media.status()).toBe(200);
  const payload = await media.json();
  expect(payload.data).toHaveLength(17);
  expect(payload.data.every((item) => item.url.startsWith('/uploads/portfolio/owner-approved-'))).toBe(true);
  expect(payload.data.every((item) => item.thumbnailUrl.startsWith('/uploads/portfolio/owner-approved-'))).toBe(true);
  expect(payload.data.every((item) => !JSON.stringify(item).includes('private-media'))).toBe(true);
  expect(new Set(payload.data.map((item) => item.category))).toEqual(
    new Set(['Portrait', 'Couple', 'Maternité', 'Corporate', 'Famille', 'Événementiel']),
  );

  const assets = [
    ['/images/optimized/hero-banner-640.webp', 30_000],
    ['/images/optimized/portfolio-maternity-480.webp', 25_000],
    ['/images/optimized/brand-logo-320.webp', 15_000],
  ];
  for (const [url, maximumBytes] of assets) {
    const response = await request.get(url);
    expect(response.status(), url).toBe(200);
    expect(response.headers()['content-type'], url).toContain('image/webp');
    expect((await response.body()).byteLength, url).toBeLessThanOrEqual(maximumBytes);
  }
});
