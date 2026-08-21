import { expect, test } from '@playwright/test';

const json = (route, data, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(data),
});

const desktopPathGroups = [
  ['/', '/a-propos', '/services', '/portfolio'],
  ['/corporate', '/contact', '/reservation'],
];
const footerPathGroups = [
  ['/', '/portfolio', '/services-creatifs#devis-creatif', '/a-propos', '/services'],
  ['/corporate'],
  ['/cgv'],
  ['/confidentialite'],
  ['/mentions-legales'],
  ['/admin'],
];
const mobilePathGroups = [
  ['/', '/a-propos', '/services', '/portfolio'],
  ['/corporate', '/contact', '/reservation'],
];

const localizedHref = (href) => href.startsWith('/admin') ? href : href === '/' ? '/fr' : `/fr${href}`;

const pathWithHash = (url) => {
  const parsed = new URL(url);
  return parsed.pathname + parsed.hash;
};

const expectTopAndMainFocus = async (page) => {
  await expect(page.locator('#main-content')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
};

const activateDesktopLinks = async (page, paths) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/fr/cgv', { waitUntil: 'domcontentloaded' });
  for (const href of paths) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.locator(`.nav-desktop a[href="${localizedHref(href)}"]`).click();
    await expect.poll(() => pathWithHash(page.url())).toBe(localizedHref(href));
    await expectTopAndMainFocus(page);
  }
};

const activateFooterLinks = async (page, paths) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/fr/contact', { waitUntil: 'domcontentloaded' });
  for (const href of paths) {
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    await footer.locator(`a[href="${localizedHref(href)}"]`).first().click();
    await expect.poll(() => pathWithHash(page.url())).toBe(localizedHref(href));

    if (href.includes('#')) {
      await expect(page.locator('#devis-creatif')).toBeFocused();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    } else {
      await expectTopAndMainFocus(page);
    }
  }
};

const activateMobileLinks = async (page, paths) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/fr/cgv', { waitUntil: 'domcontentloaded' });
  for (const href of paths) {
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await page.getByRole('navigation', { name: 'Navigation mobile' })
      .locator(`a[href="${localizedHref(href)}"]`).click();
    await expect.poll(() => pathWithHash(page.url())).toBe(localizedHref(href));
    await expectTopAndMainFocus(page);
  }
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/admin/me') return json(route, { error: { message: 'Non authentifié' } }, 401);
    if (path === '/api/health') return json(route, { status: 'ok' });
    return json(route, { data: [] });
  });
});

test('P2-05 remet en haut, restaure le retour et focalise le contenu', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/fr', { waitUntil: 'domcontentloaded' });
  await page.locator('footer').waitFor();
  await page.locator('footer').scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);

  await page.locator('.nav-desktop').getByRole('link', { name: 'Contact', exact: true }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await expectTopAndMainFocus(page);

  await page.goBack();
  await expect(page).toHaveURL(/\/fr$/);
  await expect(page.locator('#main-content')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
});

for (const [index, paths] of desktopPathGroups.entries()) {
  test(`P2-05 active tous les liens du header bureau — lot ${index + 1}`, async ({ page }) => {
    await activateDesktopLinks(page, paths);
  });
}

for (const [index, paths] of footerPathGroups.entries()) {
  test(`P2-05 active les liens internes du footer — lot ${index + 1}`, async ({ page }) => {
    await activateFooterLinks(page, paths);
  });
}

for (const [index, paths] of mobilePathGroups.entries()) {
  test(`P2-05 active tous les liens du menu mobile — lot ${index + 1}`, async ({ page }) => {
    await activateMobileLinks(page, paths);
  });
}
