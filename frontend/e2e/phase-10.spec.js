import { expect, test } from '@playwright/test';

const indexableRoutes = [
  ['/', 'https://gsplus.vip'],
  ['/services', 'https://gsplus.vip/services'],
  ['/portfolio', 'https://gsplus.vip/portfolio'],
  ['/reservation', 'https://gsplus.vip/reservation'],
  ['/services-creatifs', 'https://gsplus.vip/services-creatifs'],
  ['/a-propos', 'https://gsplus.vip/a-propos'],
  ['/contact', 'https://gsplus.vip/contact'],
  ['/corporate', 'https://gsplus.vip/corporate'],
  ['/mentions-legales', 'https://gsplus.vip/mentions-legales'],
  ['/confidentialite', 'https://gsplus.vip/confidentialite'],
  ['/cgv', 'https://gsplus.vip/cgv'],
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (url.pathname === '/api/admin/me') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UNAUTHORIZED' } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });
});

test('indexable routes expose unique browser metadata and valid LocalBusiness data', async ({ page }) => {
  const titles = new Set();
  const descriptions = new Set();

  for (const [route, canonical] of indexableRoutes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');

    const metadata = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content,
      schema: JSON.parse(document.getElementById('local-business-schema')?.textContent || '{}'),
    }));
    expect(metadata.schema['@type']).toBe('LocalBusiness');
    expect(metadata.schema.address.addressLocality).toBe('Douala');
    titles.add(metadata.title);
    descriptions.add(metadata.description);
  }

  expect(titles.size).toBe(indexableRoutes.length);
  expect(descriptions.size).toBe(indexableRoutes.length);
});

test('admin and missing routes are noindex and admin stays out of public route requests', async ({ page }) => {
  const pageScripts = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') pageScripts.push(request.url());
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  expect(pageScripts.join('\n')).not.toMatch(/AdminDashboard/);

  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('#local-business-schema')).toHaveCount(0);
  await expect.poll(() => pageScripts.join('\n')).toMatch(/AdminDashboard/);

  await page.goto('/route-qui-nexiste-pas', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.getByRole('heading', { name: 'Page Introuvable' })).toBeVisible();
});

test('reduced-motion preference removes smooth scrolling and backdrop blur', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.header')).toBeVisible();

  const styles = await page.evaluate(() => {
    const header = document.querySelector('.header');
    return {
      mediaMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      backdropFilter: getComputedStyle(header).backdropFilter,
      webkitBackdropFilter: getComputedStyle(header).webkitBackdropFilter,
    };
  });

  expect(styles.mediaMatches).toBe(true);
  expect(styles.scrollBehavior).toBe('auto');
  expect([styles.backdropFilter, styles.webkitBackdropFilter]).not.toContain('blur(15px)');
});
