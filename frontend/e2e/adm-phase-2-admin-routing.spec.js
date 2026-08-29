import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const reservation = {
  id: 'reservation-routing', reference: 'GSP-260820-R001', version: 3,
  status: 'PENDING_CONFIRMATION', scheduleKind: 'STANDARD_HOLD',
  startAt: '2030-03-04T09:00:00.000Z', endAt: '2030-03-04T10:00:00.000Z',
  snapshot: { firstName: 'Amina', lastName: 'Routage', notificationPhoneE164: '+237640703249', notificationEmail: 'amina@example.test' },
  customer: { firstName: 'Amina', lastName: 'Routage', phone: '+237640703249', email: 'amina@example.test' },
  package: { id: 'pack-routing', name: 'Portrait Signature', price: 25000 },
  packageVersion: { version: 1 },
  payments: [], transitions: [], calendarSyncLogs: [], notifications: [],
  financialTasks: [], rescheduleRequests: [], withdrawalRequests: [], deliveries: [], imageConsentEvents: [],
};

const detailedReservation = {
  ...reservation,
  snapshot: {
    ...reservation.snapshot,
    locale: 'fr', durationMin: 60, amount: 25000,
    whatsappConsent: true, whatsappConsentAt: '2030-02-01T08:00:00.000Z', whatsappMarketingConsent: false,
  },
  payments: [{
    id: 'payment-routing', version: 2, status: 'PENDING', method: 'mtn_momo',
    amount: 25000, declaredAmount: 20000, transactionRef: 'TXN-778899', paymentPhone: '+237690000000',
    transitions: [{
      id: 'ptr-1', fromStatus: 'PENDING', toStatus: 'PAYMENT_INFO_REQUIRED',
      createdAt: '2030-02-02T09:00:00.000Z', actorType: 'ADMIN',
      internalReason: 'Capture d’écran illisible', customerReasonText: 'Merci de renvoyer votre reçu.', customerLocale: 'fr',
    }],
  }],
  transitions: [{
    id: 'rtr-1', fromStatus: null, toStatus: 'PENDING_CONFIRMATION',
    createdAt: '2030-02-01T08:00:00.000Z', actorType: 'CUSTOMER',
  }],
  notifications: [
    { id: 'nt-1', channel: 'email', type: 'booking_received_customer', recipient: 'amina@example.test', status: 'SENT', templateCode: 'E-01', templateVersion: '2026-08-20-phase4', attemptCount: 1, maxAttempts: 5, attempts: [], createdAt: '2030-02-01T08:05:00.000Z' },
    { id: 'nt-2', channel: 'whatsapp', type: 'payment_verified_customer', recipient: '+237640703249', status: 'FAILED', error: 'Provider rejected', attemptCount: 3, maxAttempts: 5, attempts: [], createdAt: '2030-02-03T08:05:00.000Z' },
  ],
  calendarSyncLogs: [
    { id: 'cs-1', provider: 'calcom', action: 'create', status: 'FAILED', attemptCount: 2, error: 'CALENDAR_PROVIDER_FAILED', createdAt: '2030-02-02T10:00:00.000Z' },
  ],
};

const installAdminApi = async (page) => {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') {
      return json(route, { data: { id: 'owner-routing', name: 'Owner', email: 'owner@example.test', role: 'OWNER' } });
    }
    if (path === '/api/admin/reservations/reservation-routing') return json(route, { data: detailedReservation });
    if (path === '/api/admin/reservations/GSP-260820-R001') return json(route, { data: detailedReservation });
    if (path === '/api/admin/reservations') return json(route, { data: [reservation] });
    if (path === '/api/admin/financial-tasks') return json(route, { data: { items: [], meta: { total: 0, limit: 25, offset: 0, operators: [] } } });
    if ([
      '/api/admin/leads', '/api/admin/packages', '/api/admin/media',
      '/api/admin/availability-blocks', '/api/admin/notifications',
      '/api/admin/catalogue-taxonomy', '/api/admin/catalogue-benefits',
    ].includes(path)) return json(route, { data: [] });
    if (path === '/api/admin/data-governance') return json(route, { data: { requests: [], policies: [] } });
    return json(route, { error: { message: 'Unexpected route ' + path } }, 500);
  });
};

const activeNav = (page) => page.locator('.admin-nav-btn.active');

test('Phase 2 gives every view its own address that survives a reload', async ({ page }) => {
  await installAdminApi(page);

  for (const [path, label] of [
    ['/admin/reservations', 'Réservations'],
    ['/admin/offres', 'Tarifs'],
    ['/admin/planning', 'Disponibilités'],
    ['/admin/messages', 'Communications'],
  ]) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.locator('.admin-layout').waitFor();
    await expect(activeNav(page)).toHaveText(new RegExp(label));

    // The report's criterion: refreshing must not return to the overview.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(activeNav(page)).toHaveText(new RegExp(label));
    expect(new URL(page.url()).pathname).toBe(path);
  }
});

test('Phase 2 keeps a record addressable, and Back closes it instead of leaving the view', async ({ page }) => {
  await installAdminApi(page);
  await page.goto('/admin/reservations', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();

  await page.getByRole('button', { name: 'Détails' }).first().click();
  await expect(page.locator('.admin-modal-content')).toBeVisible();
  // Opening a record moves the address to that record.
  await expect(page).toHaveURL(/\/admin\/reservations\/GSP-260820-R001$/);

  // Reloading the record address reopens the record, not the dashboard.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.admin-modal-content')).toBeVisible();
  await expect(activeNav(page)).toHaveText(/Réservations/);

  // Back dismisses the record and returns to its list, never to the overview.
  await page.goBack();
  await expect(page.locator('.admin-modal-content')).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin\/reservations$/);
  await expect(activeNav(page)).toHaveText(/Réservations/);
});

test('Phase 2 still resolves the record URLs printed in delivered e-mails', async ({ page }) => {
  await installAdminApi(page);

  // backend/src/utils/admin-links.ts builds exactly this shape.
  await page.goto('/admin/reservations/GSP-260820-R001', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
  await expect(page.locator('.admin-modal-content')).toBeVisible();
  await expect(page.getByText('GSP-260820-R001').first()).toBeVisible();
});

test('Phase 2 sends an unknown admin path to the dashboard rather than a blank view', async ({ page }) => {
  await installAdminApi(page);
  await page.goto('/admin/une-vue-inconnue', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
  await expect(activeNav(page)).toHaveText(/Vue ensemble/);
});

test('Phase 2 returns to the requested record after signing in, not to the dashboard', async ({ page }) => {
  let authenticated = false;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/login' && request.method() === 'POST') {
      authenticated = true;
      return json(route, { data: { id: 'owner-routing', name: 'Owner', email: 'owner@example.test', role: 'OWNER' } });
    }
    if (path === '/api/admin/me') {
      return authenticated
        ? json(route, { data: { id: 'owner-routing', name: 'Owner', email: 'owner@example.test', role: 'OWNER' } })
        : json(route, { error: { message: 'Authentication required.' } }, 401);
    }
    if (path === '/api/admin/reservations/GSP-260820-R001') return json(route, { data: reservation });
    if (path === '/api/admin/reservations') return json(route, { data: [reservation] });
    if ([
      '/api/admin/leads', '/api/admin/packages', '/api/admin/media',
      '/api/admin/availability-blocks', '/api/admin/notifications',
    ].includes(path)) return json(route, { data: [] });
    return json(route, { error: { message: 'Unexpected route ' + path } }, 500);
  });

  // An administrator follows a record link from an e-mail while signed out.
  await page.goto('/admin/reservations/GSP-260820-R001', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.admin-login-wrapper')).toBeVisible();

  await page.getByLabel('Adresse email administrateur').fill('owner@example.test');
  await page.getByLabel('Mot de passe').fill('correct-horse');
  await page.getByRole('button', { name: 'Se Connecter' }).click();

  // They land on the record they asked for, not on the overview.
  await expect(page.locator('.admin-modal-content')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/reservations\/GSP-260820-R001$/);
  await expect(activeNav(page)).toHaveText(/Réservations/);
});

test('Phase 3.1 presents the record as a header, two independent blocks and one chronology', async ({ page }) => {
  await installAdminApi(page);
  await page.goto('/admin/reservations/GSP-260820-R001', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
  const record = page.locator('.admin-modal-content');
  await expect(record).toBeVisible();

  // Header answers which booking this is, at a glance.
  await expect(record.locator('.admin-record-header')).toContainText('GSP-260820-R001');
  await expect(record.locator('.admin-record-header')).toContainText('Amina Routage');
  await expect(record.locator('.admin-record-header')).toContainText('Portrait Signature');
  await expect(record.locator('.admin-record-header')).toContainText('1 h');

  // Payment and reservation are independent blocks, each with its own history.
  await expect(record.getByRole('heading', { name: 'Réservation', exact: true })).toBeVisible();
  await expect(record.getByRole('heading', { name: 'Paiement', exact: true })).toBeVisible();
  await expect(record.locator('.admin-record-columns .admin-record-block')).toHaveCount(2);

  // The transaction block carries the code, the operator and the amount comparison.
  await expect(record.getByText('TXN-778899')).toBeVisible();
  await expect(record.getByText('MTN MoMo')).toBeVisible();
  await expect(record.getByText(/Écart /)).toBeVisible();
  // An expected amount is never relabelled as a received one.
  await expect(record.getByText('Montant reçu')).toBeVisible();

  // Internal notes and customer wording stay visibly separate.
  await expect(record.getByText(/Note interne/)).toBeVisible();
  await expect(record.getByText(/Capture d’écran illisible/)).toBeVisible();
  await expect(record.getByText(/Communiqué au client/)).toBeVisible();
  await expect(record.getByText(/Merci de renvoyer votre reçu/)).toBeVisible();

  // Frozen contact details are labelled as frozen.
  await expect(record.getByText(/Enregistrées au moment de la réservation/)).toBeVisible();

  // One chronology merges e-mail, WhatsApp and calendar, newest first.
  const chronology = record.locator('.admin-record-chronology li');
  await expect(chronology).toHaveCount(3);
  await expect(chronology.nth(0)).toContainText('Paiement vérifié');
  await expect(chronology.nth(1)).toContainText('Synchronisation calendrier');
  await expect(chronology.nth(2)).toContainText('Demande de réservation reçue');
  await expect(chronology.nth(0).getByRole('button', { name: /Réessayer l’envoi/ })).toBeVisible();
});
