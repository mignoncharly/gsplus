import process from 'node:process';
import { expect, test } from '@playwright/test';

const productionOrigin = process.env.PLAYWRIGHT_BASE_URL;
test.skip(!productionOrigin, 'Production smoke runs only when PLAYWRIGHT_BASE_URL is explicitly provided.');

const assertSecurityHeaders = (headers) => {
  expect(headers.server).toBe('nginx');
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['content-security-policy']).toContain("object-src 'none'");
  expect(headers['content-security-policy'].match(/script-src ([^;]+)/)?.[1]).not.toContain("'unsafe-inline'");
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['cross-origin-resource-policy']).toBe('same-origin');
  expect(headers['permissions-policy']).toBe('camera=(), geolocation=(), microphone=(), payment=(), usb=()');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['strict-transport-security']).toContain('max-age=31536000');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
};

test('production serves one consistent security policy on static, API, and error responses', async ({ request }) => {
  for (const [route, expectedStatus] of [['/', 200], ['/api/health', 200], ['/api/admin/me', 401], ['/phase11-missing', 404]]) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(expectedStatus);
    assertSecurityHeaders(response.headers());
  }

  const staticWrite = await request.post('/');
  expect(staticWrite.status()).toBe(403);
  assertSecurityHeaders(staticWrite.headers());

  const uploadIndex = await request.get('/uploads/');
  expect(uploadIndex.status()).toBe(403);
  const privateMaster = await request.get('/private-media/portfolio/example.png');
  expect(privateMaster.status()).toBe(404);
});

test('production overwrites spoofed forwarding headers and enforces exact CORS origins', async ({ request }) => {
  const first = await request.get('/api/health', { headers: { 'X-Forwarded-For': '198.51.100.10' } });
  const second = await request.get('/api/health', { headers: { 'X-Forwarded-For': '203.0.113.20' } });
  expect(first.status()).toBe(200);
  expect(second.status()).toBe(200);
  const firstPartition = first.headers()['ratelimit-policy'].match(/pk=(:[^;]+:)/)?.[1];
  const secondPartition = second.headers()['ratelimit-policy'].match(/pk=(:[^;]+:)/)?.[1];
  expect(firstPartition).toBeTruthy();
  expect(secondPartition).toBe(firstPartition);

  const allowed = await request.get('/api/health', { headers: { Origin: 'https://www.gsplus.vip' } });
  expect(allowed.status()).toBe(200);
  expect(allowed.headers()['access-control-allow-origin']).toBe('https://www.gsplus.vip');
  expect(allowed.headers()['access-control-allow-credentials']).toBe('true');

  const blocked = await request.get('/api/health', { headers: { Origin: 'https://attacker.example' } });
  expect(blocked.status()).toBe(403);
  expect(blocked.headers()['access-control-allow-origin']).toBeUndefined();
  expect(await blocked.json()).toEqual({
    error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Request origin is not allowed.' },
  });
});

test('production pages execute under the strict CSP without browser violations', async ({ page }) => {
  const violations = [];
  page.on('pageerror', (error) => violations.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && /content security policy|refused to/i.test(message.text())) {
      violations.push(message.text());
    }
  });

  for (const route of ['/', '/portfolio', '/contact', '/admin/login']) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('main')).toBeVisible();
  }

  expect(violations).toEqual([]);
});
