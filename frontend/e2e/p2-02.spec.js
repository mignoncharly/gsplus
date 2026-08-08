import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const lead = (id, company) => ({
  id, company, name: company, email: id + '@example.test', phone: '+237640703249',
  type: 'B2B', status: 'NEW', subject: 'Projet studio', message: 'Demande ' + company,
});

test('P2-02 revalidates an opened admin tab and refreshes new leads without page reload', async ({ page }) => {
  let leadReads = 0;
  const navigations = [];
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations.push(frame.url()); });

  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') return json(route, { data: { id: 'owner-p2-02', name: 'Owner P2-02', role: 'OWNER' } });
    if (path === '/api/admin/leads') {
      leadReads += 1;
      const data = leadReads === 1
        ? []
        : leadReads === 2
          ? [lead('lead-one', 'Nouvelle demande P2-02')]
          : [lead('lead-one', 'Nouvelle demande P2-02'), lead('lead-two', 'Deuxième demande P2-02')];
      return json(route, { data });
    }
    return json(route, { data: [] });
  });

  await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
  await page.getByRole('button', { name: 'Leads' }).click();

  await expect(page.getByText('Nouvelle demande P2-02', { exact: true })).toBeVisible();
  await expect(page.getByText(/Dernière actualisation : .*Douala/)).toBeVisible();
  const navigationCountBeforeRefresh = navigations.length;
  await page.getByRole('button', { name: 'Actualiser' }).click();
  await expect(page.getByText('Deuxième demande P2-02', { exact: true })).toBeVisible();
  await expect.poll(() => leadReads).toBeGreaterThanOrEqual(3);
  expect(navigations).toHaveLength(navigationCountBeforeRefresh);
  expect(page.url()).toContain('/admin/dashboard');
});
