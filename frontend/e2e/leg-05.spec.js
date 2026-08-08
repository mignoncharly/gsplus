import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const emptyAdminPaths = ['/api/admin/reservations', '/api/admin/leads', '/api/admin/packages', '/api/admin/media', '/api/admin/availability-blocks', '/api/admin/notifications'];

const policy = {
  id: 'retention-rights-v1',
  category: 'RIGHTS_REQUESTS',
  label: 'Demandes d’exercice des droits',
  version: '2026-07-31',
  status: 'PUBLISHED',
  triggerRule: 'Clôture et preuve de la réponse administrative',
  activeRule: 'Conserver pendant l’instruction, les actions et la réponse',
  archiveRule: 'Archive à accès restreint pour prouver le traitement',
  dispositionRule: 'Réviser avant anonymisation',
  backupRule: 'Copies isolées jusqu’à rotation normale',
  automaticExecution: false,
};

const installAdminApi = async (page, role = 'OWNER') => {
  let requests = [];
  let governanceCalls = 0;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') return json(route, { data: { id: `admin-${role}`, name: `Admin ${role}`, role } });
    if (emptyAdminPaths.includes(path)) return json(route, { data: [] });
    if (path === '/api/admin/data-governance' && request.method() === 'GET') {
      governanceCalls += 1;
      return json(route, { data: { policies: [policy], requests } });
    }
    if (path === '/api/admin/data-rights-requests' && request.method() === 'POST') {
      const payload = request.postDataJSON();
      requests = [{
        id: 'rights-leg-05',
        reference: 'DR-20260808-ABCDEF123456',
        ...payload,
        status: 'RECEIVED',
        version: 1,
        processingRestricted: false,
        retentionAction: 'NONE',
        responseEvidence: null,
        retentionPolicy: policy,
        createdBy: { id: `admin-${role}`, name: `Admin ${role}` },
        events: [{ id: 'event-leg-05', commandId: payload.commandId, eventType: 'CREATED', toStatus: 'RECEIVED', reason: payload.requestSummary, effectiveAt: payload.receivedAt, recordedBy: { name: `Admin ${role}` } }],
      }];
      return json(route, { data: { request: requests[0], commandId: payload.commandId, replayed: false } }, 201);
    }
    return json(route, { error: { message: `Route inattendue ${request.method()} ${path}` } }, 404);
  });
  return { governanceCalls: () => governanceCalls };
};

test('LEG-05 affiche les politiques et enregistre une demande sans délai légal inventé', async ({ page }) => {
  const api = await installAdminApi(page, 'OWNER');
  await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.admin-layout')).toBeVisible();
  await page.getByRole('button', { name: 'Données & droits' }).click();
  await expect(page.getByRole('heading', { name: /Données, droits & conservation/ })).toBeVisible();
  await expect(page.getByText('Aucune suppression automatique.')).toBeVisible();
  await expect(page.getByText(/pas un délai légal inventé/)).toBeVisible();

  await page.getByLabel('Nom du demandeur').fill('Cliente LEG-05');
  await page.getByLabel('Courriel').fill('cliente@example.test');
  await page.getByLabel('Échéance interne à confirmer').fill('2026-08-09T12:00');
  await page.getByLabel('Demande reçue').fill('Je souhaite recevoir une copie structurée de mes données personnelles.');
  await page.getByRole('button', { name: 'Créer la demande' }).click();

  await expect(page.getByText('DR-20260808-ABCDEF123456')).toBeVisible();
  await expect(page.getByText(/Création de la demande de droits terminé avec succès/)).toBeVisible();
  expect(api.governanceCalls()).toBeGreaterThanOrEqual(2);
  await page.getByText(/Politiques de conservation publiées/).click();
  await expect(page.getByText('Archivage restreint :')).toBeVisible();
});

test('LEG-05 masque le registre confidentiel pour le personnel', async ({ page }) => {
  await installAdminApi(page, 'STAFF');
  await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.admin-layout')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Données & droits' })).toHaveCount(0);
  await expect(page.getByText('Registre confidentiel réservé au propriétaire.')).toHaveCount(0);
});
