import { expect, test } from '@playwright/test';

const PUBLIC_ROUTES = [
  '/', '/a-propos', '/services', '/services-creatifs', '/portfolio', '/reservation',
  '/corporate', '/contact', '/mentions-legales', '/confidentialite', '/cgv',
];
const ALLOWED_EXTERNAL_ORIGINS = new Set([
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
]);

const json = (route, body, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

const installRuntimeAuditRoutes = async (page) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/css',
    body: "@font-face{font-family:'Montserrat';font-style:normal;font-weight:100 900;src:url('https://fonts.gstatic.com/s/leg06-audit.woff2') format('woff2')}",
  }));
  await page.route('https://fonts.gstatic.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'font/woff2',
    body: 'wOF2LEG06',
  }));
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/packages' || path === '/api/media') return json(route, { data: [] });
    if (path === '/api/admin/me') return json(route, { error: { message: 'Non authentifié' } }, 401);
    return json(route, { data: [] });
  });
};

test('LEG-06 inventorie le réseau public sans cookie ni stockage navigateur', async ({ page, context, baseURL }) => {
  const firstPartyOrigin = new URL(baseURL).origin;
  const externalOrigins = new Set();
  page.on('request', (request) => {
    const origin = new URL(request.url()).origin;
    if (origin !== firstPartyOrigin) externalOrigins.add(origin);
  });
  await installRuntimeAuditRoutes(page);

  for (const route of PUBLIC_ROUTES) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    const storage = await page.evaluate(() => ({
      localStorage: Object.keys(window.localStorage),
      sessionStorage: Object.keys(window.sessionStorage),
      documentCookie: document.cookie,
    }));
    expect(storage).toEqual({ localStorage: [], sessionStorage: [], documentCookie: '' });
    expect((await context.cookies()).filter((cookie) => cookie.domain.includes(new URL(firstPartyOrigin).hostname))).toEqual([]);
  }

  expect([...externalOrigins].sort()).toEqual([...ALLOWED_EXTERNAL_ORIGINS].sort());
});

test('LEG-06 publie l’inventaire et n’affiche aucune fausse préférence facultative', async ({ page }) => {
  await installRuntimeAuditRoutes(page);
  await page.goto('/confidentialite', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Inventaire opérationnel vérifié' })).toBeVisible();
  await expect(page.getByText('Aucun traceur facultatif actif.')).toBeVisible();
  await expect(page.getByRole('row', { name: /__Host-gsp_admin_session/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Google Fonts/ })).toBeVisible();
  await expect(page.getByText(/aucune bannière de consentement n’est affichée/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Tout accepter|Accepter tous|Tout refuser|Refuser tous|Modifier mes préférences/i })).toHaveCount(0);
});
