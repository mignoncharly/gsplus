import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const adminReservation = () => ({
  id: 'reservation-leg-03',
  reference: 'GSP-LEG03',
  version: 1,
  status: 'PENDING_CONFIRMATION',
  startAt: '2030-01-10T09:00:00.000Z',
  endAt: '2030-01-10T10:00:00.000Z',
  consentImage: false,
  snapshot: { firstName: 'Alice', lastName: 'LEG03', notificationPhoneE164: '+237640703249', notificationEmail: 'alice@example.test', email: 'alice@example.test' },
  customer: { firstName: 'Alice', lastName: 'LEG03', phone: '+237640703249' },
  package: { id: 'package-leg-03', name: 'Portrait', price: 25000 },
  payments: [{ id: 'payment-leg-03', version: 1, status: 'PENDING', method: 'MTN_MOMO', transactionRef: 'MTN-LEG-03', paymentPhone: '+237640703249', amount: 25000, transitions: [] }],
  transitions: [],
  calendarSyncLogs: [],
  rescheduleRequests: [],
  withdrawalRequests: [],
  deliveries: [],
});

const installWithdrawalAdminApi = async (page) => {
  let reservation = adminReservation();
  const calls = { create: [], decide: [] };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') return json(route, { data: { id: 'owner-leg-03', name: 'Owner LEG-03', role: 'OWNER' } });
    if (path === '/api/admin/reservations/reservation-leg-03/withdrawal-requests' && request.method() === 'POST') {
      const body = request.postDataJSON();
      calls.create.push(body);
      const withdrawal = {
        id: 'withdrawal-leg-03',
        version: 1,
        status: 'PENDING',
        contractConcludedAt: '2026-08-08T09:00:00.000Z',
        legalDeadlineAt: '2026-08-23T09:00:00.000Z',
        receivedAt: body.receivedAt,
        receivedWithinLegalWindow: true,
        requestChannel: body.requestChannel,
        requestText: body.requestText,
        requestEvidence: body.requestEvidence,
        serviceStatus: body.serviceStatus,
        executionStartedAt: body.executionStartedAt,
      };
      reservation = { ...reservation, withdrawalRequests: [withdrawal] };
      return json(route, { data: { request: withdrawal, reservation, replayed: false } }, 201);
    }
    if (path === '/api/admin/withdrawal-requests/withdrawal-leg-03/decision' && request.method() === 'PATCH') {
      const body = request.postDataJSON();
      calls.decide.push(body);
      const withdrawal = { ...reservation.withdrawalRequests[0], version: 2, status: body.decision, decisionReason: body.reason };
      reservation = { ...reservation, withdrawalRequests: [withdrawal] };
      return json(route, { data: { request: withdrawal, reservation, replayed: false } });
    }
    if (path === '/api/admin/reservations/reservation-leg-03') return json(route, { data: reservation });
    if (path === '/api/admin/reservations') return json(route, { data: [reservation] });
    if (['/api/admin/leads', '/api/admin/packages', '/api/admin/media', '/api/admin/availability-blocks', '/api/admin/notifications'].includes(path)) return json(route, { data: [] });
    return json(route, { error: { message: `Route inattendue: ${request.method()} ${path}` } }, 500);
  });
  return calls;
};

const openAdminReservation = async (page) => {
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
  if ((page.viewportSize()?.width || 1280) < 992) await page.locator('.admin-menu-toggle').click();
  await page.getByRole('button', { name: 'Réservations' }).click();
  await page.getByRole('button', { name: 'Détails' }).click();
};

test('LEG-03 publie les huit sections et la date du 11 août 2026', async ({ page }) => {
  await page.goto('/cgv', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Dernière mise à jour : 11 août 2026')).toBeVisible();
  await expect(page.locator('.legal-content-wrap > .legal-section > h2')).toHaveText([
    '1. Réservation, prix et paiement',
    '2. Retards, annulations et report',
    '3. Droit de rétractation applicable aux réservations en ligne',
    '4. Droit à l’image et droits d’auteur',
    '5. Traitement numérique de l’image',
    '6. Exécution, livraison et responsabilité',
    '7. Réclamations et litiges',
    '8. Documents associés et mise à jour',
  ]);
  await expect(page.getByText(/quinze \(15\) jours à compter de la conclusion du contrat/)).toBeVisible();
  await expect(page.getByText(/Un remboursement n’est réputé effectué qu’après exécution et confirmation effectives/)).toBeVisible();
  await expect(page.getByText(/Les délais sont calculés selon l’heure locale de Douala/)).toBeVisible();
});

test('LEG-03 reste lisible à 320 pixels et relie les documents associés', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/cgv', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('link', { name: 'mentions légales' })).toHaveAttribute('href', '/mentions-legales');
  await expect(page.getByRole('link', { name: 'Confidentialité' }).last()).toHaveAttribute('href', '/confidentialite');
  await expect(page.getByText(/fichiers bruts, essais, réglages et autres éléments de travail intermédiaires/)).toBeVisible();
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
});

test('LEG-03 enregistre le contexte puis exige une décision propriétaire motivée', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const calls = await installWithdrawalAdminApi(page);
  await openAdminReservation(page);

  await page.getByRole('button', { name: 'Enregistrer une rétractation' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Enregistrer une demande de rétractation' });
  await expect(createDialog.getByLabel('Date de réception à Douala *')).toBeVisible();
  await expect(createDialog.getByLabel('Canal de réception *')).toHaveValue('EMAIL');
  await createDialog.getByLabel('Demande explicite reçue *').fill('Je demande explicitement la rétractation de la réservation.');
  await createDialog.getByLabel('Preuve conservée *').fill('Message-ID archivé dans la boîte info@gsplus.vip.');
  await expect(createDialog.getByLabel('État du service à la réception *')).toHaveValue('NOT_STARTED');
  await createDialog.getByRole('button', { name: 'Enregistrer la demande' }).click();

  await expect(page.getByText('Demandes de rétractation')).toBeVisible();
  await expect(page.getByText(/reçue dans la fenêtre de 15 jours/)).toBeVisible();
  await expect(page.getByText(/ne marque aucun remboursement comme effectué/)).toBeVisible();
  expect(calls.create).toHaveLength(1);
  expect(calls.create[0]).toMatchObject({
    expectedReservationVersion: 1,
    requestChannel: 'EMAIL',
    serviceStatus: 'NOT_STARTED',
    executionStartedAt: null,
  });

  await page.getByRole('button', { name: 'Accepter la rétractation' }).click();
  const decisionDialog = page.getByRole('dialog', { name: 'Accepter la demande de rétractation' });
  await decisionDialog.getByLabel('Analyse et motif de la décision *').fill('Délai respecté, service non commencé et preuve vérifiée.');
  await decisionDialog.getByRole('button', { name: 'Accepter la rétractation' }).click();

  await expect(page.getByText(/Décision motivée : Délai respecté/)).toBeVisible();
  await expect(page.getByText('En attente', { exact: true }).last()).toBeVisible();
  expect(calls.decide).toHaveLength(1);
  expect(calls.decide[0]).toMatchObject({ expectedVersion: 1, decision: 'ACCEPTED' });
});
