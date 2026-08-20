import fs from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const routes = ['/services', '/corporate', '/contact', '/services-creatifs'];
const variants = [
  { name: 'desktop', viewport: { width: 1280, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } },
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }));
});

const contrastRatio = async (locator) => locator.evaluate((element) => {
  const rgb = (value) => (value.match(/[\d.]+/g) || []).map(Number);
  const luminance = ([r, g, b]) => {
    const channels = [r, g, b].map((part) => {
      const value = part / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const foreground = rgb(getComputedStyle(element).color);
  const label = element.closest('.transactional-whatsapp-consent__label');
  const overlay = rgb(getComputedStyle(label).backgroundColor);
  const base = [22, 31, 29];
  const alpha = overlay[3] ?? 1;
  const background = overlay.slice(0, 3).map((part, index) => part * alpha + base[index] * (1 - alpha));
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
});

for (const locale of ['fr', 'en']) {
  for (const variant of variants) {
    test(`Phase 1 consent is accessible in ${locale} on ${variant.name}`, async ({ page }) => {
      await page.setViewportSize(variant.viewport);
      await page.addInitScript((language) => localStorage.setItem('gsp.locale', language), locale);
      for (const route of routes) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        const consent = page.locator('.transactional-whatsapp-consent').first();
        await expect(consent).toBeVisible();
        const label = consent.locator('.transactional-whatsapp-consent__label');
        const box = await label.boundingBox();
        expect(box.height, `${route} ${locale} ${variant.name} target`).toBeGreaterThanOrEqual(44);
        expect(await contrastRatio(label.locator('span')), `${route} ${locale} ${variant.name} contrast`).toBeGreaterThanOrEqual(4.5);
        const checkbox = consent.locator('input[type="checkbox"]');
        await checkbox.focus();
        await expect(checkbox).toBeFocused();
        await page.addScriptTag({ content: axeSource });
        const violations = await consent.evaluate(async (element) => (await window.axe.run(element, {
          runOnly: { type: 'rule', values: ['color-contrast', 'label', 'focus-order-semantics'] },
        })).violations);
        expect(violations, `${route} ${locale} ${variant.name}: ${violations.map((item) => item.id).join(', ')}`).toEqual([]);
      }
    });
  }
}
