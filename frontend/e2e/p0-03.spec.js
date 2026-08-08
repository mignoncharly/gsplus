import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test('P0-03 disables normal early closure and records an explicit owner override', async ({ page }) => {
  let submittedOverride;
  let reservation = {
    id: 'reservation-p0-03',
    reference: 'GSP-260801-P003',
    version: 7,
    status: 'CONFIRMED',
    startAt: '2030-01-10T09:00:00.000Z',
    endAt: '2030-01-10T10:00:00.000Z',
    consentImage: false,
    snapshot: {
      firstName: 'Alice',
      lastName: 'P003',
      notificationPhoneE164: '+237640703249',
      notificationEmail: 'alice@example.test',
      email: 'alice@example.test',
    },
    customer: { firstName: 'Alice', lastName: 'P003', phone: '+237640703249' },
    package: { id: 'package-p0-03', name: 'Portrait', price: 25000 },
    payments: [{
      id: 'payment-p0-03',
      version: 2,
      status: 'VERIFIED',
      method: 'MTN_MOMO',
      transactionRef: 'MTN-P0-03-UI',
      paymentPhone: '+237640703249',
      amount: 25000,
      transitions: [],
    }],
    transitions: [],
    calendarSyncLogs: [],
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') {
      return json(route, { data: { id: 'owner-p0-03', name: 'Owner Test', role: 'OWNER' } });
    }
    if (path === '/api/admin/reservations/reservation-p0-03' && request.method() === 'PATCH') {
      submittedOverride = request.postDataJSON();
      reservation = {
        ...reservation,
        version: 8,
        status: submittedOverride.status,
        transitions: [{
          id: 'transition-p0-03',
          fromStatus: 'CONFIRMED',
          toStatus: submittedOverride.status,
          reason: submittedOverride.reason,
          actorType: 'ADMIN',
          createdAt: '2026-08-01T12:00:00.000Z',
          adminUser: { id: 'owner-p0-03', name: 'Owner Test' },
          metadata: {
            temporalOverride: {
              applied: true,
              confirmed: true,
              reason: submittedOverride.reason,
              authorizedAt: '2026-08-01T12:00:00.000Z',
              scheduledEndAt: '2030-01-10T10:00:00.000Z',
            },
          },
        }],
      };
      return json(route, { data: { ...reservation, replayed: false, calendarSync: null } });
    }
    if (path === '/api/admin/reservations/reservation-p0-03') return json(route, { data: reservation });
    if (path === '/api/admin/reservations') return json(route, { data: [reservation] });
    if (['/api/admin/leads', '/api/admin/packages', '/api/admin/media', '/api/admin/availability-blocks', '/api/admin/notifications'].includes(path)) {
      return json(route, { data: [] });
    }
    return json(route, { error: { message: `Route de test inattendue: ${request.method()} ${path}` } }, 500);
  });

  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Réservations' }).click();
  await page.getByRole('button', { name: 'Détails' }).click();

  await expect(page.getByRole('button', { name: 'Marquer terminée', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Client absent', exact: true })).toBeDisabled();
  const overrideButton = page.getByRole('button', { name: 'Dérogation : marquer terminée', exact: true });
  await expect(overrideButton).toBeEnabled();

  await overrideButton.click();
  const dialog = page.getByRole('dialog', { name: 'Confirmer une dérogation temporelle' });
  await dialog.getByLabel('Motif *').fill('Incident studio contrôlé');
  await dialog.getByRole('button', { name: 'Dérogation : marquer terminée' }).click();

  await expect(page.getByText('Dérogation temporelle — clôture avant la fin programmée')).toBeVisible();
  expect(submittedOverride).toMatchObject({
    status: 'COMPLETED',
    expectedVersion: 7,
    temporalOverride: true,
    overrideConfirmed: true,
    reason: 'Incident studio contrôlé',
  });
});
