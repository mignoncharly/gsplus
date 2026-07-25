import { gzipSync } from 'node:zlib';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(process.env.PHASE10_DIST_DIR || resolve(projectRoot, 'dist'));
const assetsDir = resolve(distDir, 'assets');
const baselineEntryBytes = 540_821;

const limits = {
  entryJsBytes: 400_000,
  entryJsGzipBytes: 125_000,
  publicRouteChunkBytes: 40_000,
  privateAdminChunkBytes: 50_000,
  largestCssChunkBytes: 15_000,
  totalCssBytes: 85_000,
  hero640Bytes: 30_000,
  hero1024Bytes: 70_000,
  socialImageBytes: 200_000,
};

const fileBytes = async (path) => (await stat(path)).size;
const assetFiles = await readdir(assetsDir);
const indexHtml = await readFile(resolve(distDir, 'index.html'), 'utf8');
const entryMatch = indexHtml.match(/<script type="module" crossorigin src="\/assets\/([^"]+\.js)"/);

if (!entryMatch) throw new Error('Unable to locate the Vite entry script in dist/index.html.');

const entryFile = entryMatch[1];
const entryBuffer = await readFile(resolve(assetsDir, entryFile));
const jsFiles = assetFiles.filter((name) => name.endsWith('.js'));
const cssFiles = assetFiles.filter((name) => name.endsWith('.css'));
const publicRouteFiles = jsFiles.filter((name) => /^(About|Contact|Corporate|CreativeServices|Home|Legal|Portfolio|Privacy|Reservation|Services|Terms)-/.test(name));
const adminFile = jsFiles.find((name) => name.startsWith('AdminDashboard-'));

if (!adminFile) throw new Error('The admin route was not emitted as a separate chunk.');
if (indexHtml.includes(adminFile)) throw new Error('The public entry document eagerly references the admin chunk.');

const sizes = Object.fromEntries(
  await Promise.all(assetFiles.map(async (name) => [name, await fileBytes(resolve(assetsDir, name))])),
);
const largestPublicRoute = publicRouteFiles
  .map((name) => ({ name, bytes: sizes[name] }))
  .sort((a, b) => b.bytes - a.bytes)[0];
const largestCss = cssFiles
  .map((name) => ({ name, bytes: sizes[name] }))
  .sort((a, b) => b.bytes - a.bytes)[0];
const totalCssBytes = cssFiles.reduce((total, name) => total + sizes[name], 0);
const entryJsGzipBytes = gzipSync(entryBuffer).byteLength;
const hero640Bytes = await fileBytes(resolve(distDir, 'images/optimized/hero-banner-640.webp'));
const hero1024Bytes = await fileBytes(resolve(distDir, 'images/optimized/hero-banner-1024.webp'));
const socialImageBytes = await fileBytes(resolve(distDir, 'images/og-golden-studio-plus-2026.jpg'));
const entryReductionPercent = Number(((1 - entryBuffer.byteLength / baselineEntryBytes) * 100).toFixed(1));

const checks = [
  ['entryJsBytes', entryBuffer.byteLength, limits.entryJsBytes],
  ['entryJsGzipBytes', entryJsGzipBytes, limits.entryJsGzipBytes],
  ['publicRouteChunkBytes', largestPublicRoute.bytes, limits.publicRouteChunkBytes],
  ['privateAdminChunkBytes', sizes[adminFile], limits.privateAdminChunkBytes],
  ['largestCssChunkBytes', largestCss.bytes, limits.largestCssChunkBytes],
  ['totalCssBytes', totalCssBytes, limits.totalCssBytes],
  ['hero640Bytes', hero640Bytes, limits.hero640Bytes],
  ['hero1024Bytes', hero1024Bytes, limits.hero1024Bytes],
  ['socialImageBytes', socialImageBytes, limits.socialImageBytes],
];

const failures = checks.filter(([, actual, limit]) => actual > limit);
const report = {
  baselineEntryBytes,
  entryFile,
  entryReductionPercent,
  limits,
  measurements: {
    entryJsBytes: entryBuffer.byteLength,
    entryJsGzipBytes,
    largestPublicRoute,
    adminChunk: { name: adminFile, bytes: sizes[adminFile] },
    largestCss,
    totalCssBytes,
    hero640Bytes,
    hero1024Bytes,
    socialImageBytes,
    jsChunkCount: jsFiles.length,
    cssChunkCount: cssFiles.length,
  },
  passed: failures.length === 0,
};

await writeFile(resolve(distDir, 'performance-budget-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (failures.length > 0) {
  const details = failures.map(([name, actual, limit]) => `${name}: ${actual} > ${limit}`).join(', ');
  throw new Error(`Phase 10 performance budget exceeded: ${details}`);
}

console.log(
  `Performance budgets passed: entry ${entryBuffer.byteLength} B (${entryJsGzipBytes} B gzip, ${entryReductionPercent}% below Phase 9), ` +
  `largest public route ${largestPublicRoute.bytes} B, admin ${sizes[adminFile]} B, CSS ${totalCssBytes} B total.`,
);
