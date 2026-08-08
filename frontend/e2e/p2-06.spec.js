import { expect, test } from '@playwright/test';

const publicRoutes = [
  '/',
  '/services',
  '/portfolio',
  '/reservation',
  '/services-creatifs',
  '/a-propos',
  '/contact',
  '/corporate',
  '/mentions-legales',
  '/confidentialite',
  '/cgv',
];

const responsiveMatrix = [
  { name: 'mobile-320-portrait', width: 320, height: 568 },
  { name: 'mobile-390-portrait', width: 390, height: 844 },
  { name: 'mobile-390-landscape', width: 844, height: 390 },
  { name: 'tablet-768-portrait', width: 768, height: 1024 },
  { name: 'tablet-992-landscape', width: 992, height: 768 },
  { name: 'desktop-1280', width: 1280, height: 800 },
];

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const installApi = async (page, { authenticated = false } = {}) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') {
      return authenticated
        ? json(route, { data: { id: 'owner-p2-06', name: 'Owner P2-06', role: 'OWNER' } })
        : json(route, { error: { message: 'Non authentifié' } }, 401);
    }
    if (path === '/api/availability') return json(route, { data: { days: [] } });
    return json(route, { data: [] });
  });
};

const layoutMetrics = (page) => page.evaluate(() => ({
  viewportWidth: document.documentElement.clientWidth,
  documentWidth: document.documentElement.scrollWidth,
  bodyWidth: document.body.scrollWidth,
}));

const expectNoHorizontalOverflow = async (page, context) => {
  const metrics = await layoutMetrics(page);
  expect(metrics.documentWidth, `${context}: document`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.bodyWidth, `${context}: body`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
};

test('P2-06 public routes reflow across the complete responsive matrix', async ({ page }) => {
  test.setTimeout(240_000);
  await installApi(page);

  for (const viewport of responsiveMatrix) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of publicRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible();
      await expectNoHorizontalOverflow(page, `${route} ${viewport.name}`);
    }
  }
});

test('P2-06 equivalent 200% zoom reflow stays usable', async ({ page }) => {
  test.setTimeout(90_000);
  await installApi(page);
  await page.setViewportSize({ width: 640, height: 720 });

  for (const route of publicRoutes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expectNoHorizontalOverflow(page, `${route} 200%-zoom reflow`);
  }
});

test('P2-06 protects the authenticated admin drawer and mobile keyboard reflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await installApi(page, { authenticated: true });
  await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.admin-layout')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'admin 320px closed drawer');

  const toggle = page.locator('.admin-menu-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.admin-sidebar')).toHaveClass(/is-open/);
  await expect(page.getByRole('button', { name: 'Fermer le menu', exact: true })).toBeFocused();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await expectNoHorizontalOverflow(page, 'admin 320px open drawer');
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.activeElement?.closest('.admin-sidebar') !== null)).toBe(true);
  await page.getByRole('button', { name: 'Fermer le menu', exact: true }).focus();

  await page.keyboard.press('Escape');
  await expect(page.locator('.admin-sidebar')).not.toHaveClass(/is-open/);
  await expect(toggle).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');

  await toggle.click();
  await page.getByRole('button', { name: 'Réservations' }).click();
  await expect(toggle).toBeFocused();
  const search = page.getByLabel('Rechercher par référence');
  await search.focus();
  await expect(search).toBeFocused();
  await expectNoHorizontalOverflow(page, 'admin 320px focused input');

  const visibility = await search.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
  expect(visibility).toBe(true);
});

test('P2-06 admin remains responsive at 390, 768, 992 and 1280 pixels', async ({ page }) => {
  test.setTimeout(120_000);
  await installApi(page, { authenticated: true });

  for (const viewport of responsiveMatrix.filter(({ width }) => [390, 768, 992, 1280].includes(width))) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.admin-layout')).toBeVisible();
    await expectNoHorizontalOverflow(page, `admin ${viewport.name}`);

    if (viewport.width < 992) {
      await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
      await expect(page.locator('.admin-sidebar')).toBeVisible();
    }
  }
});
