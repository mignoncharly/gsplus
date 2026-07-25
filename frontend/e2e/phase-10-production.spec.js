import process from 'node:process';
import { expect, test } from '@playwright/test';

const productionOrigin = process.env.PLAYWRIGHT_BASE_URL;
test.skip(!productionOrigin, 'Production smoke runs only when PLAYWRIGHT_BASE_URL is explicitly provided.');

const routes = [
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

const tagContent = (html, pattern) => html.match(pattern)?.[1];

test('all indexable routes return unique crawlable metadata in raw HTML', async ({ request }) => {
  const titles = new Set();
  const descriptions = new Set();

  for (const route of routes) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
    expect(response.headers()['content-type'], route).toContain('text/html');
    const html = await response.text();
    const canonical = `${productionOrigin}${route === '/' ? '' : route}`;
    const title = tagContent(html, /<title>([^<]+)<\/title>/);
    const description = tagContent(html, /<meta name="description" content="([^"]+)"/);

    expect(html, route).toContain(`<link rel="canonical" href="${canonical}"`);
    expect(html, route).toContain(`<meta property="og:url" content="${canonical}"`);
    expect(html, route).toContain('<script id="local-business-schema" type="application/ld+json">');
    expect(html, route).toMatch(/<h1>[^<]+<\/h1>/);
    expect(html, route).toContain('index, follow, max-image-preview:large');
    expect(title, route).toBeTruthy();
    expect(description, route).toBeTruthy();
    titles.add(title);
    descriptions.add(description);
  }

  expect(titles.size).toBe(routes.length);
  expect(descriptions.size).toBe(routes.length);
});

test('private, missing, redirect, asset, and master privacy contracts hold in production', async ({ request }) => {
  const admin = await request.get('/admin');
  expect(admin.status()).toBe(200);
  const adminHtml = await admin.text();
  expect(adminHtml).toContain('<meta name="robots" content="noindex, nofollow"');
  expect(adminHtml).not.toContain('rel="canonical"');
  expect(adminHtml).not.toContain('local-business-schema');

  const missing = await request.get('/phase10-missing-route');
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain('<meta name="robots" content="noindex, nofollow"');

  const www = await request.get('https://www.gsplus.vip/services', { maxRedirects: 0 });
  expect(www.status()).toBe(301);
  expect(www.headers().location).toBe('https://gsplus.vip/services');

  const social = await request.get('/images/og-golden-studio-plus-2026.jpg');
  expect(social.status()).toBe(200);
  expect(social.headers()['content-type']).toContain('image/jpeg');
  expect((await social.body()).byteLength).toBeLessThanOrEqual(200_000);

  for (const master of ['/hero_banner.png', '/images/hero.png', '/images/portfolio/maternity.png']) {
    const response = await request.get(master);
    expect(response.status(), master).toBe(404);
  }
});
