import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const packageFixture = (id, name, publicationStatus, reservations, reservationIntents) => ({
  id,
  name,
  slug: id,
  category: 'Portraits & identité',
  taxonomyKey: 'portraits-identite',
  price: 25000,
  currency: 'XAF',
  bookingMode: 'DIRECT',
  durationMin: 60,
  version: 1,
  sortOrder: 10,
  isArchived: publicationStatus === 'ARCHIVED',
  publicationStatus,
  locales: [],
  _count: { reservations, reservationIntents },
});

// One notification per audience, plus a code that is deliberately absent from the
// registry, to prove an unregistered type still degrades to something readable.
const notificationFixture = (id, type, channel, templateCode) => ({
  id,
  channel,
  type,
  recipient: channel === 'whatsapp' ? '+237640703249' : 'client@example.test',
  status: 'SENT',
  attemptCount: 1,
  maxAttempts: 5,
  templateCode,
  templateVersion: '2026-08-20-phase4',
  attempts: [],
  createdAt: '2026-08-20T09:00:00.000Z',
  reservation: { id: 'reservation-labels', reference: 'GSP-260820-0001' },
  lead: null,
});

const installAdminApi = async (page) => {
  const packages = [
    packageFixture('pack-published', 'Portrait Signature', 'PUBLISHED', 3, 1),
    packageFixture('pack-draft', 'Portrait Découverte', 'DRAFT', 0, 0),
    packageFixture('pack-archived', 'Portrait Héritage', 'ARCHIVED', 1, 0),
  ];
  const notifications = [
    notificationFixture('n-1', 'booking_received_customer', 'email', 'E-01'),
    notificationFixture('n-2', 'booking_received_admin', 'email', 'I-01'),
    notificationFixture('n-3', 'refund_action_required_admin', 'email', 'I-06'),
    notificationFixture('n-4', 'payment_verified_customer', 'whatsapp', 'E-03'),
    notificationFixture('n-5', 'a_future_backend_message_customer', 'email', null),
  ];

  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') {
      return json(route, { data: { id: 'owner-labels', name: 'Owner', email: 'owner@example.test', role: 'OWNER' } });
    }
    if (path === '/api/admin/packages') return json(route, { data: packages });
    if (path === '/api/admin/notifications') {
      return json(route, { data: notifications, meta: { total: notifications.length, limit: 50, offset: 0, hiddenChannels: [] } });
    }
    if (path === '/api/admin/messages') return json(route, { data: [], meta: { overrides: { count: 0 } } });
    if (path === '/api/admin/catalogue-taxonomy') return json(route, { data: [] });
    if (path === '/api/admin/catalogue-benefits') return json(route, { data: [] });
    if ([
      '/api/admin/reservations',
      '/api/admin/leads',
      '/api/admin/media',
      '/api/admin/availability-blocks',
    ].includes(path)) return json(route, { data: [] });
    return json(route, { error: { message: 'Unexpected route ' + path } }, 500);
  });
};

const openAdminTab = async (page, name) => {
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.locator('.admin-layout').waitFor();
  await page.getByRole('button', { name }).click();
};

test('ADM-07 — offer carries exactly one comprehensible status', async ({ page }) => {
  await installAdminApi(page);
  await openAdminTab(page, 'Tarifs');

  await expect(page.getByText('Portrait Signature')).toBeVisible();

  // The report's symptom: PUBLIÉ and STATUT NON RECONNU on the same card.
  await expect(page.getByText('Statut non reconnu')).toHaveCount(0);

  await expect(page.locator('.admin-pill.pill-published')).toHaveCount(1);
  await expect(page.locator('.admin-pill.pill-draft')).toHaveCount(1);
  await expect(page.locator('.admin-pill.pill-archived')).toHaveCount(1);

  // The reference count is present, but as a measurement rather than a status.
  const counts = page.locator('.admin-pill--count');
  await expect(counts).toHaveCount(3);
  await expect(counts.nth(0)).toHaveText('4 références');
  await expect(counts.nth(1)).toHaveText('0 référence');
  await expect(counts.nth(2)).toHaveText('1 référence');
});

test('ADM-08 — journal row is readable without knowing the template code', async ({ page }) => {
  await installAdminApi(page);
  await openAdminTab(page, 'Communications');

  // Phase 7 moved the journal into its own panel and put the codes behind a toggle.
  // The guarantee this test protects is unchanged: a row must read as business
  // language, never as an unrecognised status.
  await expect(page.getByRole('heading', { level: 1, name: /Messages/ })).toBeVisible();
  await expect(page.getByText('Statut non reconnu')).toHaveCount(0);

  await expect(page.getByText('Demande de réservation reçue')).toBeVisible();
  await expect(page.getByText('Nouvelle réservation à traiter')).toBeVisible();
  await expect(page.getByText('Remboursement à traiter').first()).toBeVisible();
  await expect(page.getByText('Paiement vérifié')).toBeVisible();

  // Audience separates client, internal and financial traffic.
  await expect(page.locator('.admin-pill--audience.audience-client')).toHaveCount(3);
  await expect(page.locator('.admin-pill--audience.audience-internal')).toHaveCount(1);
  await expect(page.locator('.admin-pill--audience.audience-financial')).toHaveCount(1);

  // The trigger explains why the message exists.
  await expect(page.getByText('Le client vient d’envoyer sa demande.')).toBeVisible();

  // An unregistered backend code still reads as language, not as a broken status.
  await expect(page.getByText('A future backend message customer')).toBeVisible();

  // Technical detail stays available, now behind an explicit toggle.
  await expect(page.getByText('E-01')).toHaveCount(0);
  await page.locator('.admin-journal-row').first().getByRole('button', { name: 'Détail technique' }).click();
  await expect(page.getByText(/E-01/).first()).toBeVisible();
});
