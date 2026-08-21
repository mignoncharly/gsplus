import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMPATIBILITY_ROUTE_PATHS,
  getLocalBusinessSchema,
  getRouteMetadata,
  INDEXABLE_ROUTES,
  PRIVATE_ROUTE_PATHS,
  SITE_ORIGIN,
} from '../src/content/site-metadata.js';
import { localizedPath } from '../src/lib/locale-routes.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(process.env.PHASE10_DIST_DIR || resolve(projectRoot, 'dist'));
const seoBlockPattern = /<!-- phase10-seo-start -->[\s\S]*?<!-- phase10-seo-end -->/;
const shellPattern = /<section id="phase10-static-shell"[\s\S]*?<\/section>/;
const heroPreloadPattern = /\s*<link rel="preload" as="image"[^>]*hero-banner[^>]*\/>/;

export const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const safeJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');

const alternateTags = (metadata) => metadata.alternates ? [
  `    <link rel="alternate" hreflang="fr" href="${escapeHtml(metadata.alternates.fr)}" />`,
  `    <link rel="alternate" hreflang="en" href="${escapeHtml(metadata.alternates.en)}" />`,
  `    <link rel="alternate" hreflang="x-default" href="${escapeHtml(metadata.alternates.xDefault)}" />`,
] : [];

export const renderSeoBlock = (metadata) => {
  const common = [
    '<!-- phase10-seo-start -->',
    `    <title>${escapeHtml(metadata.title)}</title>`,
    `    <meta name="description" content="${escapeHtml(metadata.description)}" />`,
    `    <meta name="robots" content="${escapeHtml(metadata.robots)}" />`,
  ];

  if (metadata.canonical) common.push(`    <link rel="canonical" href="${escapeHtml(metadata.canonical)}" />`);
  common.push(...alternateTags(metadata));

  if (metadata.indexable) {
    common.push(
      '    <meta property="og:type" content="website" />',
      `    <meta property="og:locale" content="${metadata.locale === 'en' ? 'en_US' : 'fr_FR'}" />`,
      `    <meta property="og:locale:alternate" content="${metadata.locale === 'en' ? 'fr_FR' : 'en_US'}" />`,
      '    <meta property="og:site_name" content="Golden Studio Plus" />',
      `    <meta property="og:title" content="${escapeHtml(metadata.title)}" />`,
      `    <meta property="og:description" content="${escapeHtml(metadata.description)}" />`,
      `    <meta property="og:url" content="${escapeHtml(metadata.canonical)}" />`,
      `    <meta property="og:image" content="${escapeHtml(metadata.image)}" />`,
      `    <meta property="og:image:secure_url" content="${escapeHtml(metadata.image)}" />`,
      `    <meta property="og:image:type" content="${escapeHtml(metadata.imageType)}" />`,
      `    <meta property="og:image:width" content="${metadata.imageWidth}" />`,
      `    <meta property="og:image:height" content="${metadata.imageHeight}" />`,
      `    <meta property="og:image:alt" content="${escapeHtml(metadata.imageAlt)}" />`,
      '    <meta name="twitter:card" content="summary_large_image" />',
      `    <meta name="twitter:title" content="${escapeHtml(metadata.title)}" />`,
      `    <meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`,
      `    <meta name="twitter:image" content="${escapeHtml(metadata.image)}" />`,
      `    <meta name="twitter:image:alt" content="${escapeHtml(metadata.imageAlt)}" />`,
      `    <script id="local-business-schema" type="application/ld+json">${safeJson(getLocalBusinessSchema(metadata))}</script>`,
    );
  }

  common.push('    <!-- phase10-seo-end -->');
  return common.join('\n');
};

export const renderStaticShell = (metadata) => {
  const locale = metadata.locale || 'fr';
  const links = metadata.indexable
    ? [
        [localizedPath(locale, '/'), locale === 'en' ? 'Home' : 'Accueil'],
        [localizedPath(locale, '/services'), 'Services'],
        [localizedPath(locale, '/portfolio'), 'Portfolio'],
        [localizedPath(locale, '/reservation'), locale === 'en' ? 'Booking' : 'Réservation'],
        [localizedPath(locale, '/contact'), 'Contact'],
      ]
    : [[localizedPath(locale, '/'), locale === 'en' ? 'Back to home' : 'Retour à l’accueil']];

  return [
    '<section id="phase10-static-shell" class="crawl-shell">',
    '      <div class="crawl-shell__content">',
    '        <p class="crawl-shell__brand">Golden Studio Plus</p>',
    `        <h1>${escapeHtml(metadata.heading)}</h1>`,
    `        <p>${escapeHtml(metadata.summary)}</p>`,
    `        <nav aria-label="${locale === 'en' ? 'Main pages' : 'Pages principales'}">`,
    ...links.map(([href, label]) => `          <a href="${href}">${escapeHtml(label)}</a>`),
    '        </nav>',
    '      </div>',
    '    </section>',
  ].join('\n');
};

export const renderRouteDocument = (template, pathname) => {
  const metadata = getRouteMetadata(pathname);
  if (!seoBlockPattern.test(template) || !shellPattern.test(template)) {
    throw new Error('Phase 10 HTML markers are missing from the Vite output.');
  }

  let html = template
    .replace(/<html lang="[^"]+">/, `<html lang="${metadata.locale}">`)
    .replace(seoBlockPattern, renderSeoBlock(metadata))
    .replace(shellPattern, renderStaticShell(metadata));

  if (metadata.basePath !== '/') html = html.replace(heroPreloadPattern, '');
  return html;
};

const outputPathForRoute = (pathname) => {
  if (pathname === '/') return resolve(distDir, 'index.html');
  return resolve(distDir, `${pathname.slice(1)}.html`);
};

export const renderSitemap = () => {
  const entries = INDEXABLE_ROUTES.map((route) => {
    const metadata = getRouteMetadata(route.path);
    return [
      '  <url>',
      `    <loc>${metadata.canonical}</loc>`,
      `    <xhtml:link rel="alternate" hreflang="fr" href="${metadata.alternates.fr}" />`,
      `    <xhtml:link rel="alternate" hreflang="en" href="${metadata.alternates.en}" />`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${metadata.alternates.xDefault}" />`,
      '  </url>',
    ].join('\n');
  });
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">', ...entries, '</urlset>', ''].join('\n');
};

export const prerender = async () => {
  const templatePath = resolve(distDir, 'index.html');
  const template = await readFile(templatePath, 'utf8');
  const routes = [
    ...INDEXABLE_ROUTES.map(({ path }) => path),
    ...COMPATIBILITY_ROUTE_PATHS,
    ...PRIVATE_ROUTE_PATHS,
  ];

  for (const pathname of routes) {
    const outputPath = outputPathForRoute(pathname);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, renderRouteDocument(template, pathname), 'utf8');
  }

  await writeFile(resolve(distDir, '404.html'), renderRouteDocument(template, '/__not-found__'), 'utf8');
  await writeFile(resolve(distDir, 'sitemap.xml'), renderSitemap(), 'utf8');
  await writeFile(resolve(distDir, 'route-manifest.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), routes }, null, 2)}\n`, 'utf8');
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prerender();
  console.log(`Generated ${INDEXABLE_ROUTES.length} localized indexable documents, ${COMPATIBILITY_ROUTE_PATHS.length} compatibility documents, ${PRIVATE_ROUTE_PATHS.length} private documents, sitemap.xml, and 404.html.`);
}
