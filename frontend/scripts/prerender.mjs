import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getRouteMetadata,
  INDEXABLE_ROUTES,
  LOCAL_BUSINESS_SCHEMA,
  PRIVATE_ROUTE_PATHS,
} from '../src/content/site-metadata.js';

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

export const renderSeoBlock = (metadata) => {
  const common = [
    '<!-- phase10-seo-start -->',
    `    <title>${escapeHtml(metadata.title)}</title>`,
    `    <meta name="description" content="${escapeHtml(metadata.description)}" />`,
    `    <meta name="robots" content="${escapeHtml(metadata.robots)}" />`,
  ];

  if (metadata.indexable) {
    common.push(
      `    <link rel="canonical" href="${escapeHtml(metadata.canonical)}" />`,
      '    <meta property="og:type" content="website" />',
      '    <meta property="og:locale" content="fr_FR" />',
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
      `    <script id="local-business-schema" type="application/ld+json">${safeJson(LOCAL_BUSINESS_SCHEMA)}</script>`,
    );
  }

  common.push('    <!-- phase10-seo-end -->');
  return common.join('\n');
};

export const renderStaticShell = (metadata) => {
  const links = metadata.indexable
    ? [
        ['/', 'Accueil'],
        ['/services', 'Services'],
        ['/portfolio', 'Portfolio'],
        ['/reservation', 'Réservation'],
        ['/contact', 'Contact'],
      ]
    : [['/', 'Retour à l’accueil']];

  return [
    '<section id="phase10-static-shell" class="crawl-shell">',
    '      <div class="crawl-shell__content">',
    '        <p class="crawl-shell__brand">Golden Studio Plus</p>',
    `        <h1>${escapeHtml(metadata.heading)}</h1>`,
    `        <p>${escapeHtml(metadata.summary)}</p>`,
    '        <nav aria-label="Pages principales">',
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
    .replace(seoBlockPattern, renderSeoBlock(metadata))
    .replace(shellPattern, renderStaticShell(metadata));

  if (pathname !== '/') html = html.replace(heroPreloadPattern, '');
  return html;
};

const outputPathForRoute = (pathname) => {
  if (pathname === '/') return resolve(distDir, 'index.html');
  return resolve(distDir, `${pathname.slice(1)}.html`);
};

export const prerender = async () => {
  const templatePath = resolve(distDir, 'index.html');
  const template = await readFile(templatePath, 'utf8');
  const routes = [
    ...INDEXABLE_ROUTES.map(({ path }) => path),
    ...PRIVATE_ROUTE_PATHS,
  ];

  for (const pathname of routes) {
    const outputPath = outputPathForRoute(pathname);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, renderRouteDocument(template, pathname), 'utf8');
  }

  await writeFile(resolve(distDir, '404.html'), renderRouteDocument(template, '/__not-found__'), 'utf8');
  await writeFile(
    resolve(distDir, 'route-manifest.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), routes }, null, 2)}\n`,
    'utf8',
  );
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prerender();
  console.log(`Generated ${INDEXABLE_ROUTES.length} indexable documents, ${PRIVATE_ROUTE_PATHS.length} private documents, and 404.html.`);
}
