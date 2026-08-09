import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { AdminRole } from '../src/generated/prisma/client.js';
import {
  OFFICIAL_CATALOGUE_OFFERS,
  OFFICIAL_CATALOGUE_SOURCE,
  assertOfficialCatalogue,
} from '../src/catalogue/golden-studio-plus-2026-08-04.js';
import { prisma } from '../src/db/prisma.js';
import { createPackageWithVersion, updatePackageWithVersion } from '../src/services/packages.js';

const apply = process.argv.includes('--apply');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--apply');
if (unknownArguments.length > 0) throw new Error(`Arguments inconnus : ${unknownArguments.join(', ')}`);

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const sourcePath = `${repositoryRoot}${OFFICIAL_CATALOGUE_SOURCE.file}`;

const main = async () => {
  assertOfficialCatalogue();
  const source = await readFile(sourcePath);
  const sha256 = createHash('sha256').update(source).digest('hex');
  if (sha256 !== OFFICIAL_CATALOGUE_SOURCE.sha256) throw new Error('OFFICIAL_CATALOGUE_SOURCE_HASH_MISMATCH');

  const existing = await prisma.package.findMany({
    where: { slug: { in: OFFICIAL_CATALOGUE_OFFERS.map((offer) => offer.slug) } },
    select: { id: true, slug: true },
  });
  const packagesBySlug = new Map(existing.map((pack) => [pack.slug, pack]));
  const additions = OFFICIAL_CATALOGUE_OFFERS.filter((offer) => !packagesBySlug.has(offer.slug));
  const updates = OFFICIAL_CATALOGUE_OFFERS.filter((offer) => packagesBySlug.has(offer.slug));

  console.log(JSON.stringify({
    mode: apply ? 'APPLY_DRAFTS' : 'CHECK_ONLY',
    source: OFFICIAL_CATALOGUE_SOURCE,
    targetOffers: OFFICIAL_CATALOGUE_OFFERS.length,
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
    const current = packagesBySlug.get(offer.slug);
    if (current) {
      await updatePackageWithVersion(current.id, offer, owner.id);
    } else {
      await createPackageWithVersion(offer, owner.id);
    }
  }

  console.log(JSON.stringify({ preparedDrafts: OFFICIAL_CATALOGUE_OFFERS.length, publications: 0 }, null, 2));
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
