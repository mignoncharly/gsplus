import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  getRouteMetadata,
  INDEXABLE_ROUTES,
  SOCIAL_IMAGE_ALT,
  SOCIAL_IMAGE_HEIGHT,
  SOCIAL_IMAGE_PATH,
  SOCIAL_IMAGE_WIDTH,
  LOCAL_BUSINESS_SCHEMA,
  SITE_ORIGIN,
} from '../src/content/site-metadata.js';
import { renderRouteDocument } from '../scripts/prerender.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (path) => readFileSync(`${root}${path}`, 'utf8');

test('every indexable route has unique metadata on the canonical origin', () => {
  const titles = new Set();
  const descriptions = new Set();

  assert.equal(INDEXABLE_ROUTES.length, 11);
  for (const route of INDEXABLE_ROUTES) {
    const metadata = getRouteMetadata(route.path);
    assert.equal(metadata.indexable, true);
    assert.equal(metadata.canonical, `${SITE_ORIGIN}${route.path === '/' ? '' : route.path}`);
    assert.match(metadata.robots, /^index, follow/);
    assert.equal(metadata.image, SITE_ORIGIN + SOCIAL_IMAGE_PATH);
    assert.equal(metadata.imageAlt, SOCIAL_IMAGE_ALT);
    assert.equal(metadata.imageWidth, SOCIAL_IMAGE_WIDTH);
    assert.equal(metadata.imageHeight, SOCIAL_IMAGE_HEIGHT);
    assert.ok(metadata.title.length >= 30 && metadata.title.length <= 70, route.path);
    assert.ok(metadata.description.length >= 100 && metadata.description.length <= 170, route.path);
    assert.ok(metadata.heading);
    assert.ok(metadata.summary);
    titles.add(metadata.title);
    descriptions.add(metadata.description);
  }

  assert.equal(titles.size, INDEXABLE_ROUTES.length);
  assert.equal(descriptions.size, INDEXABLE_ROUTES.length);
});

test('LocalBusiness data contains only published studio particulars', () => {
  assert.equal(LOCAL_BUSINESS_SCHEMA['@type'], 'LocalBusiness');
  assert.equal(LOCAL_BUSINESS_SCHEMA.url, SITE_ORIGIN);
  assert.equal(LOCAL_BUSINESS_SCHEMA.telephone, '+237673026654');
  assert.equal(LOCAL_BUSINESS_SCHEMA.email, 'info@gsplus.vip');
  assert.equal(LOCAL_BUSINESS_SCHEMA.address.streetAddress, 'Cité des Palmiers');
  assert.equal(LOCAL_BUSINESS_SCHEMA.address.addressLocality, 'Douala');
  assert.equal(LOCAL_BUSINESS_SCHEMA.address.addressCountry, 'CM');
  assert.deepEqual(
    LOCAL_BUSINESS_SCHEMA.openingHoursSpecification[0],
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'https://schema.org/Monday',
        'https://schema.org/Tuesday',
        'https://schema.org/Wednesday',
        'https://schema.org/Thursday',
        'https://schema.org/Friday',
        'https://schema.org/Saturday',
      ],
      opens: '09:00',
      closes: '18:00',
    },
  );
  assert.equal('sameAs' in LOCAL_BUSINESS_SCHEMA, false);
  assert.equal('aggregateRating' in LOCAL_BUSINESS_SCHEMA, false);
});

test('build generator emits crawlable route HTML and noindex private HTML', () => {
  const template = source('index.html');
  const services = renderRouteDocument(template, '/services');
  assert.match(services, /<title>Séances photo et packs à Douala/);
  assert.match(services, /<link rel="canonical" href="https:\/\/gsplus\.vip\/services"/);
  assert.match(services, /<meta property="og:url" content="https:\/\/gsplus\.vip\/services"/);
  assert.match(services, /<meta property="og:image" content="https:\/\/gsplus\.vip\/images\/og-golden-studio-plus-2026\.jpg"/);
  assert.match(services, /<meta property="og:image:width" content="1200"/);
  assert.match(services, /<meta property="og:image:height" content="630"/);
  assert.match(services, /<meta name="twitter:image:alt" content="Golden Studio Plus/);
  assert.match(services, /<script id="local-business-schema" type="application\/ld\+json">/);
  assert.match(services, /<h1>Séances photo et packs<\/h1>/);
  assert.doesNotMatch(services, /rel="preload" as="image"[^>]+hero-banner/);

  const home = renderRouteDocument(template, '/');
  assert.match(home, /rel="preload" as="image"[^>]+hero-banner/);

  const admin = renderRouteDocument(template, '/admin');
  assert.match(admin, /<meta name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(admin, /rel="canonical"/);
  assert.doesNotMatch(admin, /local-business-schema/);
  assert.match(admin, /<h1>Espace privé<\/h1>/);
});

test('route splitting, font loading, social image, and reduced-motion safeguards are source-controlled', () => {
  const app = source('src/App.jsx');
  const main = source('src/main.jsx');
  const css = source('src/index.css');
  const html = source('index.html');

  for (const page of ['Home', 'Services', 'Portfolio', 'Reservation', 'AdminDashboard', 'Privacy']) {
    assert.match(app, new RegExp(`const ${page} = lazy\\(\\(\\) => import\\(`));
  }
  assert.match(app, /<MotionConfig reducedMotion="user">/);
  assert.match(main, /phase10-static-shell/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /backdrop-filter: none !important/);
  assert.doesNotMatch(css, /@import url\(['"]https:\/\/fonts\.googleapis\.com/);
  assert.match(html, /rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/);
  assert.match(html, /fetchpriority="high"/);

  const socialImage = `${root}public/images/og-golden-studio-plus-2026.jpg`;
  const bytes = readFileSync(socialImage);
  assert.ok(statSync(socialImage).size <= 200_000);
  assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff');
});

test('static masters stay private while only responsive derivatives remain public', () => {
  const masterPaths = [
    'hero_banner.png',
    'logo.png',
    'portfolio_portrait_1.png',
    'portfolio_portrait_2.png',
    'portfolio_portrait_3.png',
    'images/engagement.png',
    'images/hero.png',
    'images/portfolio/corporate.png',
    'images/portfolio/couple.png',
    'images/portfolio/maternity.png',
  ];

  for (const relativePath of masterPaths) {
    const privatePath = `${root}../private-media/static-masters/${relativePath}`;
    const publicPath = `${root}public/${relativePath}`;
    assert.equal(existsSync(privatePath), true, relativePath);
    assert.equal(statSync(privatePath).mode & 0o777, 0o600, relativePath);
    assert.equal(existsSync(publicPath), false, relativePath);
  }

  assert.equal(statSync(`${root}../private-media/static-masters`).mode & 0o777, 0o700);
  assert.match(source('../backend/scripts/optimize-static-media.mjs'), /private-media.+static-masters/);
});
