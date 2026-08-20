import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OPTIONAL_TRACKERS_ENABLED,
  TRACKER_INVENTORY,
  TRACKER_INVENTORY_VERSION,
} from '../src/content/tracker-inventory.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(process.env.PHASE10_DIST_DIR || resolve(projectRoot, 'dist'));
const sourceDir = resolve(projectRoot, 'src');

export const FORBIDDEN_TRACKER_SIGNATURES = [
  { label: 'Google Tag Manager', pattern: /googletagmanager\.com|\bgtag\s*\(/i },
  { label: 'Google Analytics', pattern: /google-analytics\.com|analytics\.google\.com/i },
  { label: 'Meta Pixel', pattern: /connect\.facebook\.net.*fbevents|\bfbq\s*\(/i },
  { label: 'Hotjar', pattern: /static\.hotjar\.com|\bhj\s*\(/i },
  { label: 'Microsoft Clarity', pattern: /clarity\.ms|\bclarity\s*\(/i },
  { label: 'Matomo', pattern: /matomo\.js|_paq\.push/i },
  { label: 'Plausible', pattern: /plausible\.io\/js\//i },
];

const BROWSER_STORAGE_SIGNATURES = [
  { label: 'document.cookie', pattern: /document\.cookie/ },
  { label: 'localStorage', pattern: /\blocalStorage\s*\./ },
  { label: 'sessionStorage', pattern: /\bsessionStorage\b/ },
  { label: 'IndexedDB', pattern: /\bindexedDB\b/ },
  { label: 'sendBeacon', pattern: /navigator\.sendBeacon/ },
];

const walkFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  }));
  return nested.flat();
};

const readableFiles = async (directory, extensions) => {
  const files = await walkFiles(directory);
  return Promise.all(
    files
      .filter((path) => extensions.has(extname(path)))
      .map(async (path) => ({ path, content: await readFile(path, 'utf8') })),
  );
};

const externalResourceOrigins = (html) => {
  const origins = new Set();
  const directResource = /<(?:script|iframe|img)\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
  const linkResource = /<link\b(?=[^>]*\brel=["'](?:stylesheet|preconnect|preload|modulepreload)["'])[^>]*\bhref=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
  for (const pattern of [directResource, linkResource]) {
    for (const match of html.matchAll(pattern)) origins.add(new URL(match[1]).origin);
  }
  return origins;
};

const sourceFiles = await readableFiles(sourceDir, new Set(['.js', '.jsx', '.css', '.html']));
const distFiles = await readableFiles(distDir, new Set(['.js', '.html']));
const findings = [];

for (const file of [...sourceFiles, ...distFiles]) {
  for (const signature of FORBIDDEN_TRACKER_SIGNATURES) {
    if (signature.pattern.test(file.content)) findings.push(`${signature.label}: ${file.path}`);
  }
}

const allowedBrowserStorage = new Set(
  TRACKER_INVENTORY
    .filter((entry) => entry.id === 'language-preference' && entry.name === 'gsp.locale')
    .map(() => `localStorage: ${resolve(sourceDir, 'lib/i18n.js')}`),
);
const storageUses = [];
for (const file of sourceFiles) {
  for (const signature of BROWSER_STORAGE_SIGNATURES) {
    if (signature.pattern.test(file.content)) storageUses.push(`${signature.label}: ${file.path}`);
  }
}

const observedExternalOrigins = new Set();
for (const file of distFiles.filter((item) => item.path.endsWith('.html'))) {
  for (const origin of externalResourceOrigins(file.content)) observedExternalOrigins.add(origin);
}

const declaredExternalOrigins = new Set(TRACKER_INVENTORY.flatMap((entry) => entry.externalOrigins));
const unexpectedOrigins = [...observedExternalOrigins].filter((origin) => !declaredExternalOrigins.has(origin));
const missingOrigins = [...declaredExternalOrigins].filter((origin) => !observedExternalOrigins.has(origin));
const optionalEntries = TRACKER_INVENTORY.filter((entry) => entry.classification === 'OPTIONAL');
const invalidOptionalEntries = optionalEntries.filter((entry) => (
  entry.consentRequired !== true ||
  entry.defaultEnabled !== false ||
  !entry.preferenceControl ||
  entry.preferenceControl.acceptLabel !== 'Accepter' ||
  entry.preferenceControl.refuseLabel !== 'Refuser' ||
  entry.preferenceControl.withdrawalAvailable !== true
));

if (OPTIONAL_TRACKERS_ENABLED !== (optionalEntries.length > 0)) {
  findings.push('OPTIONAL_TRACKERS_ENABLED ne correspond pas à l’inventaire.');
}
if (invalidOptionalEntries.length > 0) {
  findings.push(`CMP incomplète pour : ${invalidOptionalEntries.map((entry) => entry.id).join(', ')}`);
}
const unexpectedStorageUses = storageUses.filter((item) => !allowedBrowserStorage.has(item));
if (unexpectedStorageUses.length > 0) findings.push(...unexpectedStorageUses.map((item) => `Stockage navigateur non inventorié: ${item}`));
if (unexpectedOrigins.length > 0) findings.push(`Origines externes non inventoriées: ${unexpectedOrigins.join(', ')}`);
if (missingOrigins.length > 0) findings.push(`Origines déclarées non observées au build: ${missingOrigins.join(', ')}`);

const report = {
  inventoryVersion: TRACKER_INVENTORY_VERSION,
  optionalTrackersEnabled: OPTIONAL_TRACKERS_ENABLED,
  inventory: TRACKER_INVENTORY,
  observedExternalOrigins: [...observedExternalOrigins].sort(),
  browserStorageUses: storageUses,
  allowedBrowserStorage: [...allowedBrowserStorage],
  forbiddenTrackerFindings: findings.filter((item) => !item.startsWith('Stockage navigateur')),
  passed: findings.length === 0,
};

await mkdir(distDir, { recursive: true });
await writeFile(resolve(distDir, 'tracker-audit-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (findings.length > 0) {
  throw new Error(`LEG-06 tracker audit failed: ${findings.join(' | ')}`);
}

console.log(
  `LEG-06 tracker audit passed: ${TRACKER_INVENTORY.length} entries, ` +
  `${observedExternalOrigins.size} external origins, 0 optional trackers, 0 browser storage APIs.`,
);
