import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ADMIN_VIEWS,
  DEFAULT_ADMIN_TAB,
  adminRecordPath,
  adminTabFromPath,
  adminViewPath,
  parseAdminDestination,
} from '../src/lib/admin-deep-links.js';

const adminLinks = readFileSync(new URL('../../backend/src/utils/admin-links.ts', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/pages/AdminDashboard.jsx', import.meta.url), 'utf8');

test('Phase 2 gives every administration view its own address', () => {
  const navTabs = [...dashboard.matchAll(/\['([a-z]+)', '[^']*', [A-Za-z]+\]/g)].map((match) => match[1]);
  assert.ok(navTabs.length >= 10, `expected the navigation to be discovered, found ${navTabs.length}`);

  const routed = new Set(ADMIN_VIEWS.map((view) => view.tab));
  const unrouted = navTabs.filter((tab) => !routed.has(tab));
  assert.deepEqual(unrouted, [], `these navigation entries have no URL: ${unrouted.join(', ')}`);

  // Slugs are the public contract and must be unique.
  const slugs = ADMIN_VIEWS.map((view) => view.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'two views share a slug');

  for (const view of ADMIN_VIEWS) {
    assert.equal(adminTabFromPath(adminViewPath(view.tab)), view.tab, `${view.tab} must round-trip through its URL`);
  }
});

test('Phase 2 never breaks a URL that a delivered e-mail already contains', () => {
  // These builders are the source of the links inside sent e-mails and Cal.com events.
  const published = [...adminLinks.matchAll(/\/admin\/([a-z-]+)\/\$\{encodeURIComponent/g)].map((match) => match[1]);
  assert.deepEqual(published.sort(), ['finance', 'leads', 'reservations'], 'the published admin link shapes changed');

  for (const [segment, expectedArea] of [['reservations', 'reservations'], ['leads', 'leads'], ['finance', 'finance']]) {
    const destination = parseAdminDestination(`/admin/${segment}/REF-1`);
    assert.equal(destination.area, expectedArea, `/admin/${segment}/:reference must still resolve`);
    assert.equal(destination.reference, 'REF-1');
  }

  // Every internal tab key also resolves, so no previously constructed link 404s.
  for (const view of ADMIN_VIEWS) {
    assert.equal(adminTabFromPath(`/admin/${view.tab}`), view.tab);
  }
});

test('Phase 2 resolves records, views and unknown paths without stranding the administrator', () => {
  assert.equal(adminTabFromPath('/admin'), DEFAULT_ADMIN_TAB);
  assert.equal(adminTabFromPath('/admin/'), DEFAULT_ADMIN_TAB);
  assert.equal(adminTabFromPath('/admin/une-vue-inconnue'), DEFAULT_ADMIN_TAB);
  assert.equal(parseAdminDestination('/fr/services'), null, 'public routes are not admin destinations');

  // A record segment only counts for views that actually hold records.
  assert.equal(parseAdminDestination('/admin/offres/anything').reference, null);
  assert.equal(parseAdminDestination('/admin/offres/anything').tab, 'tarifs');

  assert.equal(adminRecordPath('reservations', 'GSP-260820-0001'), '/admin/reservations/GSP-260820-0001');
  assert.equal(adminRecordPath('finance', 'task 1'), '/admin/paiements/task%201');
});

test('Phase 2 drives the dashboard view from the URL rather than component state', () => {
  assert.doesNotMatch(dashboard, /useState\('overview'\)/, 'the active view must not be component state');
  assert.match(dashboard, /adminTabFromPath\(location\.pathname, location\.search\)/);
  assert.match(dashboard, /navigate\(adminViewPath\(tab\)\)/);

  // Login returns to the requested address instead of the dashboard.
  assert.doesNotMatch(dashboard, /refreshAdminTab\('overview'\)/);
  assert.match(dashboard, /refreshAdminTab\(adminTabFromPath\(location\.pathname, location\.search\)\)/);

  // The open record is derived from the URL, so Back closes it.
  assert.match(dashboard, /const selectedRes = isReservationRecordRoute \? loadedRes : null;/);
  assert.match(dashboard, /adminRecordPath\('reservations', record\.reference\)/);
});
