import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const reservationFixture = () => ({
  id: 'reservation-phase-2', reference: 'GSP-PHASE2', version: 4,
  status: 'PENDING_CONFIRMATION', scheduleKind: 'STANDARD_HOLD',
  startAt: '2030-01-10T09:00:00.000Z', endAt: '2030-01-10T10:00:00.000Z',
  snapshot: { firstName: 'Alice', lastName: 'Phase Deux', notificationPhoneE164: '+237640703249', notificationEmail: 'alice@example.test' },
  customer: { firstName: 'Alice', lastName: 'Phase Deux', phone: '+237640703249' },
  package: { id: 'package-phase-2', name: 'Portrait Phase 2', price: 25000 },
  packageVersion: { version: 1 }, payments: [], transitions: [], calendarSyncLogs: [],
  rescheduleRequests: [], withdrawalRequests: [], deliveries: [], imageConsentEvents: [],
});

const installStatefulAdminApi = async (page) => {
  let reservation = reservationFixture();
  let blocks = [];
  const calls = { reschedules: [], blockCreates: [], blockUpdates: [] };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') return json(route, { data: { id: 'owner-phase-2', name: 'Owner Phase 2', email: 'owner@example.test', role: 'OWNER' } });
    if (path === '/api/admin/reservations/reservation-phase-2/reschedule-requests' && request.method() === 'POST') {
      const body = request.postDataJSON();
      calls.reschedules.push(body);
      const rescheduleRequest = {
        id: 'reschedule-phase-2', version: 1, status: 'PENDING',
        oldStartAt: reservation.startAt, oldEndAt: reservation.endAt,
        requestedStartAt: body.requestedStartAt,
        requestedEndAt: new Date(new Date(body.requestedStartAt).getTime() + 3_600_000).toISOString(),
        reason: body.reason,
      };
      reservation = { ...reservation, rescheduleRequests: [rescheduleRequest] };
      return json(route, { data: { request: rescheduleRequest, replayed: false } }, 201);
    }
    if (path === '/api/admin/reservations/reservation-phase-2') return json(route, { data: reservation });
    if (path === '/api/admin/reservations') return json(route, { data: [reservation] });
    if (path === '/api/admin/availability-blocks' && request.method() === 'POST') {
      const body = request.postDataJSON();
      calls.blockCreates.push(body);
      blocks = [{ id: 'block-phase-2', ...body }];
      return json(route, { data: blocks[0] }, 201);
    }
    if (path === '/api/admin/availability-blocks/block-phase-2' && request.method() === 'PATCH') {
      const body = request.postDataJSON();
      calls.blockUpdates.push(body);
      blocks = [{ ...blocks[0], ...body }];
      return json(route, { data: blocks[0] });
    }
    if (path === '/api/admin/availability-blocks') return json(route, { data: blocks });
    if (['/api/admin/leads', '/api/admin/packages', '/api/admin/media', '/api/admin/notifications'].includes(path)) return json(route, { data: [] });
    return json(route, { error: { message: 'Route inattendue: ' + request.method() + ' ' + path } }, 500);
  });
  return calls;
};

const openAdminTab = async (page, name) => {
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
  await page.getByRole('button', { name }).click();
};

test('Phase 2 persists an admin reschedule datetime through blur, API refresh, and page reload', async ({ page }) => {
  const calls = await installStatefulAdminApi(page);
  await openAdminTab(page, 'Réservations');
  await page.getByRole('button', { name: 'Détails' }).click();
  await page.getByRole('button', { name: 'Demander un report' }).click();
  const dialog = page.getByRole('dialog', { name: 'Demander un report' });
  const requestedStart = dialog.getByLabel('Nouveau créneau à Douala *');
  const reason = dialog.getByLabel('Motif de la demande *');
  await requestedStart.fill('2030-01-12T14:45');
  await reason.focus();
  await expect(reason).toBeFocused();
  await expect(requestedStart).toHaveValue('2030-01-12T14:45');
  await reason.fill('Report Phase 2 conservé après rechargement');
  await requestedStart.focus();
  await expect(requestedStart).toBeFocused();
  await expect(reason).not.toHaveValue('');
  await dialog.getByRole('button', { name: 'Créer la demande' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Report Phase 2 conservé après rechargement')).toBeVisible();
  expect(calls.reschedules[0].requestedStartAt).toBe('2030-01-12T13:45:00.000Z');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Réservations' }).click();
  await page.getByRole('button', { name: 'Détails' }).click();
  await expect(page.getByText('Report Phase 2 conservé après rechargement')).toBeVisible();
  await expect(page.getByText(/12 janv\. 2030.*14:45/)).toBeVisible();
});

test('Phase 2 persists created and edited calendar blocks through full page reloads', async ({ page }) => {
  const calls = await installStatefulAdminApi(page);
  await openAdminTab(page, 'Disponibilités');
  const start = page.getByLabel('Début (heure de Douala) *');
  const end = page.getByLabel('Fin (heure de Douala) *');
  const reason = page.getByLabel('Raison / Motif');
  await start.fill('2030-02-04T08:15');
  await end.focus();
  await expect(end).toBeFocused();
  await expect(start).toHaveValue('2030-02-04T08:15');
  await end.fill('2030-02-04T11:45');
  await reason.focus();
  await expect(reason).toBeFocused();
  await expect(end).toHaveValue('2030-02-04T11:45');
  await reason.fill('Maintenance Phase 2');
  await page.getByRole('button', { name: 'Bloquer ces créneaux' }).click();
  await expect(page.getByText('Motif : Maintenance Phase 2')).toBeVisible();
  expect(calls.blockCreates[0]).toEqual({ startAt: '2030-02-04T07:15:00.000Z', endAt: '2030-02-04T10:45:00.000Z', reason: 'Maintenance Phase 2' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Disponibilités' }).click();
  await page.getByRole('button', { name: 'Modifier' }).evaluate((button) => button.click());
  const dialog = page.getByRole('dialog', { name: 'Modifier le blocage calendrier' });
  await expect(dialog).toBeVisible();
  const editStart = dialog.getByLabel('Début à Douala *');
  const editEnd = dialog.getByLabel('Fin à Douala *');
  const editReason = dialog.getByLabel('Raison / motif');
  await editStart.fill('2030-02-05T09:30');
  await editEnd.focus();
  await expect(editEnd).toBeFocused();
  await expect(editStart).toHaveValue('2030-02-05T09:30');
  await editEnd.fill('2030-02-05T12:15');
  await editReason.focus();
  await expect(editReason).toBeFocused();
  await expect(editEnd).toHaveValue('2030-02-05T12:15');
  await editReason.fill('Maintenance Phase 2 modifiée');
  await dialog.getByRole('button', { name: 'Enregistrer le blocage' }).click();
  expect(calls.blockUpdates[0]).toEqual({ startAt: '2030-02-05T08:30:00.000Z', endAt: '2030-02-05T11:15:00.000Z', reason: 'Maintenance Phase 2 modifiée' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Disponibilités' }).click();
  await expect(page.getByText('Motif : Maintenance Phase 2 modifiée')).toBeVisible();
  await expect(page.getByText(/5 févr\. 2030.*09:30.*12:15/)).toBeVisible();
});
