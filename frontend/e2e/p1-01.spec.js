import { expect, test } from '@playwright/test';

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const reservation = (id, consent) => ({
  id,
  reference: `GSP-${id}`,
  version: 1,
  status: 'PENDING_CONFIRMATION',
  startAt: '2030-02-04T09:00:00.000Z',
  endAt: '2030-02-04T10:00:00.000Z',
  consentImage: false,
  snapshot: {
    firstName: consent ? 'Aline' : 'Brice',
    lastName: 'WhatsApp',
    notificationPhoneE164: consent ? '+237699333333' : '+237688222222',
    notificationEmail: `${id}@example.test`,
    email: `${id}@example.test`,
    packageName: 'Portrait WhatsApp',
    whatsappConsent: consent,
    whatsappConsentAt: consent ? '2026-08-01T16:00:00.000Z' : null,
  },
  customer: { firstName: consent ? 'Aline' : 'Brice', lastName: 'WhatsApp' },
  package: { id: 'package-p1-01', name: 'Portrait WhatsApp', price: 25000 },
  payments: [],
  transitions: [],
  calendarSyncLogs: [],
});

test('P1-01 admin exposes consent and only enables the prefilled WhatsApp action when authorized', async ({ page }) => {
  const allowed = reservation('WA-ALLOWED', true);
  const denied = reservation('WA-DENIED', false);
  const reservations = [allowed, denied];

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/health') return json(route, { status: 'ok' });
    if (path === '/api/admin/me') return json(route, { data: { id: 'owner-p1-01', name: 'Owner Test', role: 'OWNER' } });
    if (path === '/api/admin/reservations') return json(route, { data: reservations });
    if (path.startsWith('/api/admin/reservations/')) {
      const id = decodeURIComponent(path.split('/').at(-1));
      return json(route, { data: reservations.find((item) => item.id === id) });
    }
    if (['/api/admin/leads', '/api/admin/packages', '/api/admin/media', '/api/admin/availability-blocks', '/api/admin/notifications'].includes(path)) {
      return json(route, { data: [] });
    }
    return json(route, { error: { message: `Route de test inattendue: ${request.method()} ${path}` } }, 500);
  });

  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Réservations' }).click();
  await page.getByRole('button', { name: 'Détails' }).first().click();

  await expect(page.getByText(/Consentement WhatsApp/)).toBeVisible();
  await expect(page.getByText(/Accordé le/)).toBeVisible();
  const action = page.getByRole('link', { name: /Écrire au client sur WhatsApp/ });
  await expect(action).toHaveAttribute('href', /wa\.me\/237699333333\?text=/);
  expect(decodeURIComponent(await action.getAttribute('href'))).toContain('GSP-WA-ALLOWED (Portrait WhatsApp)');

  await page.getByRole('button', { name: 'Fermer la fenêtre' }).click();
  await page.getByRole('button', { name: 'Détails' }).nth(1).click();
  await expect(page.getByText('Non accordé — aucun message client autorisé')).toBeVisible();
  await expect(page.getByRole('button', { name: 'WhatsApp non autorisé' })).toBeDisabled();
  await expect(page.getByRole('link', { name: /Écrire au client sur WhatsApp/ })).toHaveCount(0);
});
