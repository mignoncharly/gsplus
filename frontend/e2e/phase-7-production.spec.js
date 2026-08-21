import { expect, test } from '@playwright/test';

const localizedName = (pack, locale) =>
  pack.locales.find((entry) => entry.locale === locale)?.name ?? pack.name;

for (const locale of ['fr', 'en']) {
  test(`Phase 7 exposes every ${locale.toUpperCase()} package through its contracted CTA`, async ({ page }) => {
    const response = await page.request.get('/api/catalogue');
    expect(response.status()).toBe(200);
    const catalogue = (await response.json()).data;
    const packages = catalogue.packages;
    const expected = new Map(packages.map((pack) => [localizedName(pack, locale), pack]));
    const observed = new Map();

    await page.goto(`/${locale}/services`, { waitUntil: 'domcontentloaded' });
    const categoryButtons = page.locator('.service-category-filter');
    await expect(categoryButtons).toHaveCount(9);

    await expect(categoryButtons.first()).toHaveAttribute('aria-pressed', 'true');
    const cards = page.locator('.pack-grid').first().locator('.pack-card-premium');
    await expect(cards).toHaveCount(35);
    for (let cardIndex = 0; cardIndex < await cards.count(); cardIndex += 1) {
      const card = cards.nth(cardIndex);
      const name = (await card.getByRole('heading', { level: 3 }).innerText()).trim();
      const href = await card.locator('a.pack-cta').getAttribute('href');
      observed.set(name, href);
    }

    expect([...observed.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [name, pack] of expected) {
      const href = observed.get(name);
      if (pack.bookingMode === 'DIRECT') {
        expect(href, name).toBe(`/${locale}/reservation?pack=${encodeURIComponent(pack.id)}`);
      } else {
        expect(href, name).toBe(`/${locale}/contact`);
      }
    }
    expect(packages.filter((pack) => pack.bookingMode === 'DIRECT')).toHaveLength(31);
    expect(packages.filter((pack) => pack.bookingMode === 'CONTACT')).toHaveLength(4);
  });
}

test('Phase 7 contact actions resolve to genuine channels without placeholders', async ({ page }) => {
  const routes = ['/fr/contact', '/en/contact', '/fr/corporate', '/en/corporate', '/fr/services-creatifs', '/en/services-creatifs'];
  for (const route of routes) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('a[href="#"]'), `${route} placeholder links`).toHaveCount(0);
    await expect(page.locator('a[href^="https://wa.me/"]').first(), `${route} WhatsApp action`).toHaveAttribute('href', /^https:\/\/wa\.me\/237673026654/);
    await expect(page.locator('a[href^="mailto:info@gsplus.vip"]').first(), `${route} e-mail action`).toBeVisible();
    await expect(page.locator('a[href^="tel:+237673026654"]').first(), `${route} phone action`).toBeVisible();
  }
});
