import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const settingGroups = [
  {
    key: 'identity', label: 'Identité', description: 'Nom public, coordonnées, réseaux sociaux et bouton WhatsApp.',
    fields: [
      { key: 'publicName', label: 'Nom public', kind: 'text', default: 'Golden Studio Plus' },
      { key: 'phoneE164', label: 'Téléphone (format +237…)', kind: 'phone', default: '+237673026654' },
      { key: 'phoneDisplay', label: 'Téléphone affiché', kind: 'text', default: '+237 673 026 654' },
      { key: 'whatsappEnabled', label: 'Afficher le bouton WhatsApp', kind: 'boolean', default: true },
    ],
    values: { publicName: 'Golden Studio Plus', phoneE164: '+237673026654', phoneDisplay: '+237 673 026 654', whatsappEnabled: true },
    isCustomised: false, updatedAt: null, updatedBy: null,
  },
  {
    key: 'integrations', label: 'Intégrations', description: 'Activation et état. Les secrets restent dans l’environnement du serveur.',
    fields: [{ key: 'whatsappEnabled', label: 'Envoi WhatsApp actif', kind: 'boolean', default: false }],
    values: { whatsappEnabled: false }, isCustomised: false, updatedAt: null, updatedBy: null,
  },
];

const contentEntries = [{
  key: 'contact.hours', label: 'Contact — horaires affichés', description: 'Bloc « Horaires d’ouverture » de la page Contact.',
  locale: 'fr',
  fields: [
    { key: 'weekdaysLabel', label: 'Libellé jours ouvrés', kind: 'text', default: 'Du lundi au samedi :' },
    { key: 'weekdaysValue', label: 'Horaires jours ouvrés', kind: 'text', default: '9 h - 18 h' },
  ],
  effective: { weekdaysLabel: 'Du lundi au samedi :', weekdaysValue: '9 h - 18 h' },
  published: null, draft: null, history: [],
}];

const installAdminApi = async (page, { withDraft = false } = {}) => {
  const calls = { settingSaves: [], draftSaves: [], publishes: [] };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') return json(route, { data: { id: 'a', name: 'Owner', email: 'o@e.test', role: 'OWNER' } });
    if (path === '/api/admin/settings' && request.method() === 'GET') return json(route, { data: settingGroups });
    if (path.startsWith('/api/admin/settings/') && request.method() === 'PUT') {
      calls.settingSaves.push({ group: path.split('/').pop(), body: request.postDataJSON() });
      return json(route, { data: { ...settingGroups[0], isCustomised: true } });
    }
    if (path === '/api/admin/content' && request.method() === 'GET') {
      return json(route, { data: withDraft
        ? [{ ...contentEntries[0], draft: { version: 2, body: { weekdaysLabel: 'Du lundi au samedi :', weekdaysValue: '10 h - 17 h' } }, history: [{ id: 'v2', version: 2, status: 'DRAFT' }] }]
        : contentEntries });
    }
    if (path.endsWith('/publish') && request.method() === 'POST') {
      calls.publishes.push(path);
      return json(route, { data: { status: 'PUBLISHED' } });
    }
    if (path.startsWith('/api/admin/content/') && request.method() === 'POST') {
      calls.draftSaves.push(request.postDataJSON());
      return json(route, { data: { version: 1, body: request.postDataJSON().body } });
    }
    return json(route, { data: [] });
  });
  return calls;
};

const open = async (page, path) => {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
};

test('ADM-09 settings are readable and say where secrets live', async ({ page }) => {
  await installAdminApi(page);
  await open(page, '/admin/parametres');

  await expect(page.getByRole('heading', { level: 1, name: /Paramètres/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Identité' })).toBeVisible();
  await expect(page.getByText('+237 673 026 654')).toBeVisible();
  // The owner is told plainly that provider credentials are not editable here.
  await expect(page.getByText(/restent dans la configuration du serveur/)).toBeVisible();
  // An untouched group says so rather than pretending to be configured.
  await expect(page.getByText(/Valeurs par défaut de l’application/).first()).toBeVisible();
});

test('ADM-09 the owner changes a public phone number from the interface', async ({ page }) => {
  const calls = await installAdminApi(page);
  await open(page, '/admin/parametres');

  await page.getByRole('button', { name: 'Modifier les paramètres Identité' }).click();
  const dialog = page.locator('.admin-action-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Téléphone affiché/).fill('+237 690 000 000');
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();

  await expect.poll(() => calls.settingSaves.length).toBe(1);
  expect(calls.settingSaves[0].group).toBe('identity');
  expect(calls.settingSaves[0].body.values.phoneDisplay).toBe('+237 690 000 000');
  // A boolean field round-trips as a boolean, not the string "true".
  expect(calls.settingSaves[0].body.values.whatsappEnabled).toBe(true);
});

test('ADM-09 content is drafted before the public sees it', async ({ page }) => {
  const calls = await installAdminApi(page);
  await open(page, '/admin/parametres');

  // With no draft, publishing is unavailable rather than silently failing.
  await expect(page.getByRole('button', { name: /Publier le contenu/ })).toBeDisabled();

  await page.getByRole('button', { name: /Modifier le contenu/ }).click();
  const dialog = page.locator('.admin-action-dialog');
  await dialog.getByLabel(/Horaires jours ouvrés/).fill('10 h - 17 h');
  await dialog.getByRole('button', { name: 'Enregistrer le brouillon' }).click();

  await expect.poll(() => calls.draftSaves.length).toBe(1);
  expect(calls.draftSaves[0]).toMatchObject({ locale: 'fr', body: { weekdaysValue: '10 h - 17 h' } });
});

test('ADM-09 a draft is shown apart from what the public sees, then published', async ({ page }) => {
  const calls = await installAdminApi(page, { withDraft: true });
  await open(page, '/admin/parametres');

  await expect(page.getByText(/Version visible du public/)).toBeVisible();
  await expect(page.getByText(/Brouillon non publié — version 2/)).toBeVisible();
  // The two values are visible at once, so the difference is obvious before publishing.
  const section = page.locator('section').filter({ hasText: 'Contact — horaires affichés' });
  await expect(section.locator('.admin-settings-grid:not(.admin-settings-grid--draft)')).toContainText('9 h - 18 h');
  await expect(section.locator('.admin-settings-grid--draft')).toContainText('10 h - 17 h');

  await page.getByRole('button', { name: /Publier le contenu/ }).click();
  await page.locator('.admin-action-dialog').getByRole('button', { name: 'Publier' }).click();
  await expect.poll(() => calls.publishes.length).toBe(1);
});
