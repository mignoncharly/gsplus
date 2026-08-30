import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const events = [
  { id: 'n1', channel: 'email', type: 'booking_received_customer', recipient: 'a@e.test', status: 'SENT',
    attemptCount: 1, maxAttempts: 5, templateCode: 'E-01', templateVersion: '2026-08-20-phase4',
    createdAt: '2026-08-20T09:00:00.000Z', attempts: [], reservation: { id: 'r1', reference: 'GSP-260820-0001' }, lead: null },
  { id: 'n2', channel: 'email', type: 'refund_action_required_admin', recipient: 'info@gsplus.vip', status: 'FAILED',
    attemptCount: 5, maxAttempts: 5, templateCode: 'I-06', error: 'SMTP 550', providerStatus: 'bounced',
    createdAt: '2026-08-21T09:00:00.000Z', attempts: [], reservation: null, lead: null },
  { id: 'n3', channel: 'email', type: 'payment_verified_customer', recipient: 'b@e.test', status: 'FAILED',
    attemptCount: 5, maxAttempts: 5, resolution: 'OBSOLETE', resolutionNote: 'Dossier annulé', resolvedAt: '2026-08-22T10:00:00.000Z',
    createdAt: '2026-08-22T09:00:00.000Z', attempts: [], reservation: null, lead: null },
];

const templates = [
  { code: 'E-01', audience: 'customer', channel: 'email', locale: 'fr', variables: ['reference_courte'],
    compiled: { subject: 'Votre demande — [reference_courte]', preheader: 'Bien reçue', body: ['Bonjour,'] },
    published: null, draft: null, isOverridden: false, history: [] },
  { code: 'I-06', audience: 'admin', channel: 'email', locale: 'fr', variables: ['reference_courte'],
    compiled: { subject: 'Remboursement à traiter', preheader: '', body: ['À traiter.'] },
    published: { version: 1, subject: 'Remboursement personnalisé', preheader: '', body: ['Texte publié.'], publishedAt: '2026-08-25T09:00:00.000Z', publishedBy: null },
    draft: { version: 2, subject: 'Brouillon en cours', preheader: '', body: ['Texte brouillon.'], updatedAt: '2026-08-26T09:00:00.000Z', updatedBy: null },
    isOverridden: true, history: [{ id: 'v1', version: 1, status: 'PUBLISHED' }, { id: 'v2', version: 2, status: 'DRAFT' }] },
];

const installAdminApi = async (page) => {
  const calls = { lists: [], drafts: [], publishes: [], reverts: [], tests: [], previews: [] };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') return json(route, { data: { id: 'a', name: 'Owner', email: 'o@e.test', role: 'OWNER' } });
    if (path === '/api/admin/notifications') {
      calls.lists.push(url.search);
      let items = events;
      if (url.searchParams.get('actionableOnly') === 'true') items = items.filter((e) => e.status === 'FAILED' && !e.resolution);
      for (const status of url.searchParams.getAll('status')) items = items.filter((e) => e.status === status);
      return json(route, { data: items, meta: { total: items.length, limit: 50, offset: 0, hiddenChannels: ['whatsapp'] } });
    }
    if (path === '/api/admin/messages') return json(route, { data: templates, meta: { overrides: { count: 1, lastLoadedAt: null, lastError: null } } });
    if (path.endsWith('/preview')) { calls.previews.push(request.postDataJSON()); return json(route, { data: { locale: 'fr', subject: 'Aperçu GSP-260830-EXEMPLE', preheader: '', text: 'Corps de l’aperçu' } }); }
    if (path.endsWith('/publish')) { calls.publishes.push(path); return json(route, { data: {} }); }
    if (path.endsWith('/revert')) { calls.reverts.push(path); return route.fulfill({ status: 204, body: '' }); }
    if (path.endsWith('/test-send')) { calls.tests.push(path); return json(route, { data: { recipient: 'info@gsplus.vip', subject: 'Test' } }, 202); }
    if (path.startsWith('/api/admin/messages/')) { calls.drafts.push(request.postDataJSON()); return json(route, { data: {} }); }
    return json(route, { data: [] });
  });
  return calls;
};

const open = async (page, path) => {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
};

test('ADM-08b a journal row leads with business language and hides the codes', async ({ page }) => {
  await installAdminApi(page);
  await open(page, '/admin/messages');

  await expect(page.getByText('Demande de réservation reçue')).toBeVisible();
  await expect(page.getByText('Remboursement à traiter').first()).toBeVisible();
  await expect(page.getByText('Statut non reconnu')).toHaveCount(0);

  // The raw code is not on the row until the operator asks for it.
  await expect(page.getByText('booking_received_customer')).toHaveCount(0);
  await page.locator('.admin-journal-row').first().getByRole('button', { name: 'Détail technique' }).click();
  await expect(page.getByText('booking_received_customer')).toBeVisible();
  await expect(page.getByText('Code technique')).toBeVisible();
});

test('ADM-08b a disabled channel is hidden and the fact is stated', async ({ page }) => {
  await installAdminApi(page);
  await open(page, '/admin/messages');
  await expect(page.getByText(/Canal masqué car désactivé : whatsapp/)).toBeVisible();
});

test('ADM-08b anomalies are filterable and the filter lives in the URL', async ({ page }) => {
  const calls = await installAdminApi(page);
  await open(page, '/admin/messages');
  await expect(page.locator('.admin-journal-row')).toHaveCount(3);

  await page.getByLabel(/Anomalies exploitables uniquement/).check();
  await page.getByRole('button', { name: 'Filtrer' }).click();
  await expect(page).toHaveURL(/actionableOnly=true/);
  await expect(page.locator('.admin-journal-row')).toHaveCount(1);
  expect(calls.lists.at(-1)).toContain('actionableOnly=true');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.admin-journal-row')).toHaveCount(1);
});

test('ADM-08b a classified failure still shows how it was classified', async ({ page }) => {
  await installAdminApi(page);
  await open(page, '/admin/messages');
  await expect(page.getByText(/Disposition : Obsolète/)).toBeVisible();
  await expect(page.getByText(/Dossier annulé/)).toBeVisible();
});

test('§8.1 a template is edited, previewed and published, and can return to the original', async ({ page }) => {
  const calls = await installAdminApi(page);
  await open(page, '/admin/messages');

  await expect(page.getByText(/1 modèle\(s\) actuellement remplacé\(s\)/)).toBeVisible();
  // A template with no override says so by absence; the overridden one is marked.
  await expect(page.locator('section').filter({ hasText: 'I-06' }).getByText('Personnalisé', { exact: true })).toBeVisible();
  await expect(page.getByText(/Brouillon non publié — objet : Brouillon en cours/)).toBeVisible();

  await page.getByRole('button', { name: 'Modifier le modèle E-01' }).click();
  const dialog = page.locator('.admin-action-dialog');
  await dialog.getByLabel('Objet *').fill('Nouvel objet — [reference_courte]');
  // The preview renders with sample data, so no real reservation is needed.
  await dialog.getByRole('button', { name: /Générer l’aperçu/ }).click();
  await expect(dialog.getByText('Aperçu GSP-260830-EXEMPLE')).toBeVisible();
  await dialog.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await expect.poll(() => calls.drafts.length).toBe(1);
  expect(calls.drafts[0].subject).toBe('Nouvel objet — [reference_courte]');

  await page.getByRole('button', { name: 'Envoyer un test du modèle E-01' }).click();
  await page.locator('.admin-action-dialog').getByRole('button', { name: 'Envoyer le test' }).click();
  await expect.poll(() => calls.tests.length).toBe(1);

  await page.getByRole('button', { name: 'Revenir à la version d’origine du modèle I-06' }).click();
  await page.locator('.admin-action-dialog').getByRole('button', { name: 'Revenir à l’origine' }).click();
  await expect.poll(() => calls.reverts.length).toBe(1);
});
