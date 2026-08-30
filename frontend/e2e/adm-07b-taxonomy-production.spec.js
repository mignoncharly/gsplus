import { expect, test } from '@playwright/test';

/**
 * ADM-07b asks that the public page carry the administration's eight sections, in both
 * languages, with no code change needed to publish or move one. The filters are compared
 * case-insensitively because the stylesheet uppercases them — the assertion is about
 * where the labels come from, not how they are painted.
 */
const SECTIONS = {
  fr: ['Toutes', 'Portraits & identité', 'Couples, familles & groupes', 'Maternité, bébé & enfant',
    'Anniversaires', 'Fiançailles & pré-mariage', 'Événements', 'Créateurs & entreprises',
    'Privilèges Golden — Promotion'],
  en: ['All', 'Portraits & identity', 'Couples, families & groups', 'Maternity, baby & children',
    'Birthdays', 'Engagements & pre-wedding', 'Events', 'Creators & businesses',
    'Golden privileges — Promotion'],
};

for (const [locale, path] of [['fr', '/services'], ['en', '/en/services']]) {
  test(`ADM-07b the public catalogue carries the eight administered sections in ${locale}`, async ({ page }) => {
    const catalogue = page.waitForResponse((response) => response.url().includes('/api/catalogue') && response.ok());
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const served = (await (await catalogue).json()).data.taxonomy;

    const filters = page.locator('.service-category-filter');
    await expect(filters.first()).toBeVisible({ timeout: 20000 });
    const rendered = (await filters.allInnerTexts()).map((item) => item.trim().toLocaleUpperCase(locale));

    expect(rendered).toEqual(SECTIONS[locale].map((item) => item.toLocaleUpperCase(locale)));
    // The filters are the administered taxonomy, not a list kept in the page's own code:
    // every section the API served appears, in the order the administration gave it.
    const administered = served.map((item) => {
      const labels = Array.isArray(item.locales)
        ? Object.fromEntries(item.locales.map((entry) => [entry.locale, entry.label]))
        : item.locales;
      return String(labels[locale]).toLocaleUpperCase(locale);
    });
    expect(rendered.slice(1)).toEqual(administered);
  });
}
