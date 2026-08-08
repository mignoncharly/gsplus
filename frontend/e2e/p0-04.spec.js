import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test('P0-04 admin disables premature confirmation and sends one versioned atomic command', async ({ page }) => {
  let submittedCommand;
  let reservation = {
    id: 'reservation-p0-04',
    reference: 'GSP-260801-P004',
    version: 3,
    status: 'PENDING_CONFIRMATION',
    startAt: '2030-01-10T09:00:00.000Z',
    endAt: '2030-01-10T10:00:00.000Z',
    consentImage: false,
    snapshot: {
      firstName: 'Alice',
      lastName: 'P004',
      notificationPhoneE164: '+237640703249',
      notificationEmail: 'alice@example.test',
      email: 'alice@example.test',
    },
    customer: { firstName: 'Alice', lastName: 'P004', phone: '+237640703249' },
    package: { id: 'package-p0-04', name: 'Portrait', price: 25000 },
    payments: [{
      id: 'payment-p0-04',
      version: 2,
      status: 'PENDING',
      method: 'MTN_MOMO',
      transactionRef: 'MTN-P0-04-UI',
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
      return json(route, { data: { id: 'owner-p0-04', name: 'Owner Test', role: 'OWNER' } });
    }
    if (path === '/api/admin/reservations/reservation-p0-04/verify-and-confirm' && request.method() === 'POST') {
      submittedCommand = request.postDataJSON();
      reservation = {
        ...reservation,
        version: 4,
        status: 'CONFIRMED',
        payments: [{ ...reservation.payments[0], version: 3, status: 'VERIFIED' }],
      };
      return json(route, {
        data: {
          commandId: submittedCommand.commandId,
          replayed: false,
          payment: reservation.payments[0],
          reservation,
          calendarSync: null,
        },
      });
    }
    if (path === '/api/admin/reservations/reservation-p0-04') return json(route, { data: reservation });
    if (path === '/api/admin/reservations') return json(route, { data: [reservation] });
    if (['/api/admin/leads', '/api/admin/packages', '/api/admin/media', '/api/admin/availability-blocks', '/api/admin/notifications'].includes(path)) {
      return json(route, { data: [] });
    }
    return json(route, { error: { message: `Route de test inattendue: ${request.method()} ${path}` } }, 500);
  });

  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Réservations' }).click();
  await page.getByRole('button', { name: 'Détails' }).click();

  const confirmButton = page.getByRole('button', { name: 'Confirmer', exact: true });
  await expect(confirmButton).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Demander une information' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Marquer la vérification bloquée' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Rejeter le paiement' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Vérifier et confirmer' })).toBeEnabled();

  await page.getByRole('button', { name: 'Vérifier et confirmer' }).click();
  const dialog = page.getByRole('dialog', { name: 'Vérifier le paiement et confirmer' });
  await expect(dialog.getByLabel('Référence de transaction *')).toHaveValue('MTN-P0-04-UI');
  await dialog.getByRole('button', { name: 'Vérifier et confirmer' }).click();
  await expect(page.getByText('Confirmée', { exact: true }).last()).toBeVisible();

  expect(submittedCommand).toMatchObject({
    paymentId: 'payment-p0-04',
    expectedPaymentVersion: 2,
    expectedReservationVersion: 3,
    transactionRef: 'MTN-P0-04-UI',
  });
  expect(submittedCommand.commandId).toMatch(/^[0-9a-f-]{36}$/i);
});
