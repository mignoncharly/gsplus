import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { AdminRole } from '../src/generated/prisma/client.js';
import {
  OFFICIAL_CATALOGUE_OFFERS,
  OFFICIAL_CATALOGUE_SOURCE,
  assertOfficialCatalogue,
  type OfficialCatalogueOffer,
} from '../src/catalogue/golden-studio-plus-2026-08-04.js';
import { prisma } from '../src/db/prisma.js';
import { createPackageWithVersion, updatePackageWithVersion } from '../src/services/packages.js';

const apply = process.argv.includes('--apply');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--apply');
if (unknownArguments.length > 0) throw new Error(`Arguments inconnus : ${unknownArguments.join(', ')}`);

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const sourcePath = `${repositoryRoot}${OFFICIAL_CATALOGUE_SOURCE.file}`;

const loadExisting = () => prisma.package.findMany({
  where: { slug: { in: OFFICIAL_CATALOGUE_OFFERS.map((offer) => offer.slug) } },
  select: {
    id: true,
    slug: true,
    isPromo: true,
    isRange: true,
    sortOrder: true,
    versions: { orderBy: { version: 'desc' }, take: 1 },
  },
});

type ExistingPackage = Awaited<ReturnType<typeof loadExisting>>[number];

const normalizeJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, normalizeJson(item)]),
    );
  }
  return value;
};

const equalJson = (left: unknown, right: unknown) =>
  JSON.stringify(normalizeJson(left)) === JSON.stringify(normalizeJson(right));

const isCurrentOfficial = (pack: ExistingPackage, offer: OfficialCatalogueOffer) => {
  const version = pack.versions[0];
  return Boolean(version
    && version.name === offer.name
    && version.category === offer.category
    && version.description === offer.description
    && version.content === offer.content
    && equalJson(version.inclusions, offer.inclusions)
    && version.conditions === offer.conditions
    && version.price === offer.price
    && version.currency === offer.currency
    && version.durationMin === offer.durationMin
    && version.bookingMode === offer.bookingMode
    && version.deliveryLabel === offer.deliveryLabel
    && equalJson(version.options, offer.options)
    && version.legalText === offer.legalText
    && version.effectiveAt?.toISOString() === offer.effectiveAt.toISOString()
    && pack.isPromo === offer.isPromo
    && pack.isRange === offer.isRange
    && pack.sortOrder === offer.sortOrder);
};

const main = async () => {
  assertOfficialCatalogue();
  const source = await readFile(sourcePath);
  const sha256 = createHash('sha256').update(source).digest('hex');
  if (sha256 !== OFFICIAL_CATALOGUE_SOURCE.sha256) throw new Error('OFFICIAL_CATALOGUE_SOURCE_HASH_MISMATCH');

  const existing = await loadExisting();
  const packagesBySlug = new Map(existing.map((pack) => [pack.slug, pack]));
  const additions = OFFICIAL_CATALOGUE_OFFERS.filter((offer) => !packagesBySlug.has(offer.slug));
  const current = OFFICIAL_CATALOGUE_OFFERS.filter((offer) => {
    const pack = packagesBySlug.get(offer.slug);
    return pack ? isCurrentOfficial(pack, offer) : false;
  });
  const updates = OFFICIAL_CATALOGUE_OFFERS.filter((offer) => {
    const pack = packagesBySlug.get(offer.slug);
    return pack ? !isCurrentOfficial(pack, offer) : false;
  });

  console.log(JSON.stringify({
    mode: apply ? 'APPLY_DRAFTS' : 'CHECK_ONLY',
    source: OFFICIAL_CATALOGUE_SOURCE,
    targetOffers: OFFICIAL_CATALOGUE_OFFERS.length,
    alreadyCurrent: current.length,
    existingUpdates: updates.length,
    newDrafts: additions.length,
    publications: 0,
  }, null, 2));
  if (!apply) return;

  const owner = await prisma.adminUser.findFirst({
    where: { role: AdminRole.OWNER, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!owner) throw new Error('ACTIVE_OWNER_REQUIRED');

  for (const offer of OFFICIAL_CATALOGUE_OFFERS) {
    const pack = packagesBySlug.get(offer.slug);
    if (pack && isCurrentOfficial(pack, offer)) continue;
    if (pack) {
      await updatePackageWithVersion(pack.id, offer, owner.id);
    } else {
      await createPackageWithVersion(offer, owner.id);
    }
  }

  console.log(JSON.stringify({
    preparedDrafts: additions.length + updates.length,
    alreadyCurrent: current.length,
    publications: 0,
  }, null, 2));
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
