import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getRouteMetadata, INDEXABLE_ROUTES, SITE_ORIGIN } from '../src/content/site-metadata.js';
import {
  businessMonthLabels,
  doualaLocalDateTimeToIso,
  formatBusinessDateKey,
} from '../src/lib/business-time.js';
import { alternatePaths, baseRoutePath, localizedPath, routeLocale } from '../src/lib/locale-routes.js';
import { renderRouteDocument, renderSitemap } from '../scripts/prerender.mjs';

const source = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('Phase 6 exposes stable locale paths and reciprocal alternates', () => {
  assert.equal(routeLocale('/en/services'), 'en');
  assert.equal(routeLocale('/services'), null);
  assert.equal(baseRoutePath('/fr/services'), '/services');
  assert.equal(localizedPath('en', '/fr/services?pack=portrait#booking'), '/en/services?pack=portrait#booking');
  assert.deepEqual(alternatePaths('/services'), {
    fr: '/fr/services',
    en: '/en/services',
    xDefault: '/fr/services',
  });

  assert.equal(INDEXABLE_ROUTES.length, 22);
  for (const route of INDEXABLE_ROUTES) {
    const metadata = getRouteMetadata(route.path);
    assert.equal(metadata.locale, route.locale);
    assert.equal(metadata.canonical, SITE_ORIGIN + route.path);
    assert.equal(metadata.alternates.fr, SITE_ORIGIN + localizedPath('fr', route.basePath));
    assert.equal(metadata.alternates.en, SITE_ORIGIN + localizedPath('en', route.basePath));
    assert.equal(metadata.alternates.xDefault, SITE_ORIGIN + localizedPath('fr', route.basePath));
  }

  const compatibility = getRouteMetadata('/services');
  assert.equal(compatibility.indexable, false);
  assert.equal(compatibility.robots, 'noindex, follow');
  assert.equal(compatibility.canonical, SITE_ORIGIN + '/fr/services');
});

test('Phase 6 legal translation notice is source-driven and hides editorial vocabulary', () => {
  const legalSource = source('../src/content/owner-legal-documents.js');
  const approvedNotice = 'This English translation is provided for convenience. The French version remains authoritative.';
  assert.ok(legalSource.includes(approvedNotice));
  assert.doesNotMatch(approvedNotice, /OWNER/);
  for (const page of ['Legal.jsx', 'Privacy.jsx', 'Terms.jsx']) {
    const contents = source('../src/pages/' + page);
    assert.match(contents, /ENGLISH_AUTHORITY_NOTICE/);
    assert.doesNotMatch(contents, /translation is provided for convenience/);
  }
});

test('Phase 6 dates use locale-controlled labels and preserve the Douala instant', () => {
  assert.equal(businessMonthLabels('en')[0], 'January');
  assert.equal(businessMonthLabels('fr')[0], 'janvier');
  assert.match(formatBusinessDateKey('2026-08-22', 'en'), /August/);
  assert.equal(doualaLocalDateTimeToIso('2026-08-22T10:00'), '2026-08-22T09:00:00.000Z');

  const reservation = source('../src/pages/Reservation.jsx');
  const dateFields = source('../src/components/LocalizedDateFields.jsx');
  assert.doesNotMatch(reservation, /type=["']date["']/);
  assert.match(reservation, /LocalizedDateFields/);
  assert.match(dateFields, /type="hidden"/);
  assert.match(dateFields, /Month/);
  assert.match(dateFields, /required=\{required\}/);
});

test('Phase 6 prerender and sitemap expose both locale documents', () => {
  const template = source('../index.html');
  const french = renderRouteDocument(template, '/fr/services');
  const english = renderRouteDocument(template, '/en/services');
  const compatibility = renderRouteDocument(template, '/services');
  const sitemap = renderSitemap();

  assert.match(french, /<html lang="fr">/);
  assert.match(french, /canonical" href="https:\/\/gsplus\.vip\/fr\/services"/);
  assert.match(english, /<html lang="en">/);
  assert.match(english, /Photo sessions and packages/);
  assert.match(english, /canonical" href="https:\/\/gsplus\.vip\/en\/services"/);
  for (const html of [french, english]) {
    assert.match(html, /hreflang="fr"/);
    assert.match(html, /hreflang="en"/);
    assert.match(html, /hreflang="x-default"/);
  }
  assert.match(compatibility, /content="noindex, follow"/);
  assert.doesNotMatch(compatibility, /local-business-schema/);
  assert.match(sitemap, /<loc>https:\/\/gsplus\.vip\/fr\/services<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/gsplus\.vip\/en\/services<\/loc>/);
  assert.equal((sitemap.match(/<url>/g) ?? []).length, 22);
});
