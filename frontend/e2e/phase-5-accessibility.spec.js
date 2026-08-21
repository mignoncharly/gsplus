import fs from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const json = (route, body, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

const installApi = async (page) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/packages' || path === '/api/media') return json(route, { data: [] });
    if (path === '/api/admin/me') return json(route, { data: { id: 'phase-5-owner', name: 'Owner Phase 5', role: 'OWNER' } });
    if (path === '/api/admin/data-governance') return json(route, {
      data: {
        policies: [{ id: 'policy-1', entityType: 'Reservation', retentionDays: 365, legalBasis: 'Contrat', action: 'Anonymisation', isActive: true }],
        requests: [],
      },
    });
    if (path.startsWith('/api/admin/')) return json(route, { data: [] });
    return json(route, { data: [] });
  });
};

const seriousAxeViolations = async (page) => {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const results = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return results.violations
      .filter((violation) => ['serious', 'critical'].includes(violation.impact))
      .map((violation) => ({ id: violation.id, impact: violation.impact, targets: violation.nodes.map((node) => node.target) }));
  });
};

const contrastRatio = (foreground, background) => {
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const luminance = ([red, green, blue]) => 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
  const lighter = luminance(foreground);
  const darker = luminance(background);
  return (Math.max(lighter, darker) + 0.05) / (Math.min(lighter, darker) + 0.05);
};

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installApi(page);
});

test('Phase 5 public and authenticated admin views have no serious or critical axe violations', async ({ page }) => {
  const publicRoutes = ['/', '/services', '/portfolio', '/corporate', '/contact', '/services-creatifs', '/a-propos', '/reservation', '/mentions-legales', '/confidentialite', '/cgv'];
  for (const route of publicRoutes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
    await page.waitForTimeout(250);
    expect(await seriousAxeViolations(page), route).toEqual([]);
  }

  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Vue d'ensemble/ })).toBeVisible();
  expect(await seriousAxeViolations(page), 'admin overview').toEqual([]);

  await page.getByRole('button', { name: 'Données & droits' }).click();
  await expect(page.getByRole('heading', { name: /Données/ })).toBeVisible();
  expect(await seriousAxeViolations(page), 'admin governance').toEqual([]);
});

test('Phase 5 direct and client-side navigation use identical route heading styles', async ({ browser }) => {
  const direct = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await installApi(direct);
  await direct.goto('/services', { waitUntil: 'domcontentloaded' });
  const directStyle = await direct.locator('.services-page .home-section-label').evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, display: style.display, fontWeight: style.fontWeight, letterSpacing: style.letterSpacing };
  });

  const client = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await installApi(client);
  await client.goto('/', { waitUntil: 'domcontentloaded' });
  await client.getByRole('link', { name: 'Services', exact: true }).click();
  await expect(client).toHaveURL(/\/services$/);
  const clientStyle = await client.locator('.services-page .home-section-label').evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, display: style.display, fontWeight: style.fontWeight, letterSpacing: style.letterSpacing };
  });

  expect(directStyle).toEqual(clientStyle);
  expect(directStyle.color).toBe('rgb(244, 200, 106)');
  await direct.close();
  await client.close();
});

test('Phase 5 public card groups have a complete heading hierarchy', async ({ page }) => {
  for (const route of ['/services', '/portfolio', '/corporate', '/contact', '/services-creatifs']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toBeVisible();
    await page.waitForTimeout(250);
    const headings = await page.locator('h1, h2, h3').evaluateAll((elements) => elements
      .map((element) => ({ level: Number(element.tagName.slice(1)), text: element.textContent.trim() })));
    expect(headings[0]?.level, route).toBe(1);
    for (let index = 1; index < headings.length; index += 1) {
      expect(headings[index].level - headings[index - 1].level, `${route}: ${headings[index - 1].text} -> ${headings[index].text}`).toBeLessThanOrEqual(1);
    }
  }
});

test('Phase 5 compact controls and maintained dark tokens meet their size and contrast contracts', async ({ page }) => {
  for (const route of ['/services', '/portfolio', '/corporate', '/contact', '/services-creatifs']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    const undersized = await page.locator('button, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea, summary').evaluateAll((elements) => elements.flatMap((element) => {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || element.getClientRects().length === 0) return [];
      const box = element.getBoundingClientRect();
      return box.width + 0.01 < 44 || box.height + 0.01 < 44
        ? [{ tag: element.tagName, text: element.getAttribute('aria-label') || element.textContent.trim().slice(0, 60), width: box.width, height: box.height }]
        : [];
    }));
    expect(undersized, route).toEqual([]);
  }

  await page.goto('/services-creatifs', { waitUntil: 'domcontentloaded' });
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const rgb = (name) => style.getPropertyValue(name).trim().match(/[0-9a-f]{2}/gi).map((part) => Number.parseInt(part, 16));
    return {
      background: rgb('--c-surface-dark'),
      primary: rgb('--dark-primary'),
      secondary: rgb('--dark-secondary'),
      muted: rgb('--dark-muted'),
      accent: rgb('--dark-accent'),
      disabled: rgb('--dark-disabled'),
    };
  });
  for (const name of ['primary', 'secondary', 'muted', 'accent', 'disabled']) {
    expect(contrastRatio(tokens[name], tokens.background), name).toBeGreaterThanOrEqual(4.5);
  }
});
