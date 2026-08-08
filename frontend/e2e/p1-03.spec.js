import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const reservationFixture = () => ({
  id: 'reservation-p1-03',
  reference: 'GSP-P103',
  version: 3,
  status: 'PENDING_CONFIRMATION',
  startAt: '2030-01-10T09:00:00.000Z',
  endAt: '2030-01-10T10:00:00.000Z',
  consentImage: false,
  snapshot: { firstName: 'Alice', lastName: 'P103', notificationPhoneE164: '+237640703249', notificationEmail: 'alice@example.test', email: 'alice@example.test' },
  customer: { firstName: 'Alice', lastName: 'P103', phone: '+237640703249' },
  package: { id: 'package-p1-03', name: 'Portrait', price: 25000 },
  payments: [{ id: 'payment-p1-03', version: 2, status: 'PENDING', method: 'MTN_MOMO', transactionRef: 'MTN-P1-03', paymentPhone: '+237640703249', amount: 25000, transitions: [] }],
  transitions: [],
  calendarSyncLogs: [],
});

const installAdminApi = async (page, options = {}) => {
  let reservation = reservationFixture();
  if (options.noPayment) reservation = { ...reservation, payments: [] };
  const calls = { atomic: 0 };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') return json(route, { data: { id: 'owner-p1-03', name: 'Owner Test', role: 'OWNER' } });
    if (path === '/api/admin/reservations/reservation-p1-03/verify-and-confirm' && request.method() === 'POST') {
      calls.atomic += 1;
      if (calls.atomic === 1) {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        return json(route, { error: { message: 'Référence refusée par le serveur.' } }, 409);
      }
      reservation = { ...reservation, version: 4, status: 'CONFIRMED', payments: [{ ...reservation.payments[0], version: 3, status: 'VERIFIED' }] };
      return json(route, { data: { reservation, payment: reservation.payments[0], replayed: false } });
    }
    if (path === '/api/admin/reservations/reservation-p1-03') return json(route, { data: reservation });
    if (path === '/api/admin/reservations') return json(route, { data: [reservation] });
    if (['/api/admin/leads', '/api/admin/packages', '/api/admin/media', '/api/admin/availability-blocks', '/api/admin/notifications'].includes(path)) return json(route, { data: [] });
    return json(route, { error: { message: 'Route inattendue: ' + request.method() + ' ' + path } }, 500);
  });
  return calls;
};

const openReservation = async (page) => {
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
  if ((page.viewportSize()?.width || 1280) < 992) await page.locator('.admin-menu-toggle').click();
  await page.getByRole('button', { name: 'Réservations' }).click();
  await page.getByRole('button', { name: 'Détails' }).click();
};

test('P1-03 action dialog traps focus, closes with Escape and restores its trigger', async ({ page }) => {
  await installAdminApi(page);
  await openReservation(page);
  const trigger = page.getByRole('button', { name: 'Vérifier et confirmer' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Vérifier le paiement et confirmer' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Référence de transaction *')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('P1-03 keeps real server errors and blocks double submission', async ({ page }) => {
  const calls = await installAdminApi(page);
  await openReservation(page);
  await page.getByRole('button', { name: 'Vérifier et confirmer' }).click();
  const dialog = page.getByRole('dialog', { name: 'Vérifier le paiement et confirmer' });
  const confirm = dialog.getByRole('button', { name: 'Vérifier et confirmer' });
  await confirm.evaluate((button) => { button.click(); button.click(); });
  await expect(dialog).toHaveAttribute('aria-busy', 'true');
  await expect(dialog.getByText('Référence refusée par le serveur.')).toBeVisible();
  await expect(dialog.getByLabel('Référence de transaction *')).toHaveValue('MTN-P1-03');
  expect(calls.atomic).toBe(1);
  await confirm.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Confirmée', { exact: true }).last()).toBeVisible();
  expect(calls.atomic).toBe(2);
});

test('P1-03 renders structured actions without horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAdminApi(page, { noPayment: true });
  await openReservation(page);
  await page.getByRole('button', { name: 'Ajouter un paiement' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter un paiement' });
  await expect(dialog.getByLabel('Opérateur *')).toBeVisible();
  await expect(dialog.getByLabel('Téléphone de paiement *')).toBeVisible();
  await expect(dialog.getByLabel('Référence de transaction *')).toBeVisible();
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
});
