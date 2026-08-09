import { AdminRole, PackageVersionStatus } from '../src/generated/prisma/client.js';
import { OFFICIAL_CATALOGUE_OFFERS, assertOfficialCatalogue } from '../src/catalogue/golden-studio-plus-2026-08-04.js';
import { prisma } from '../src/db/prisma.js';
import { publishPackageVersion, validatePackageVersion } from '../src/services/packages.js';

const apply = process.argv.includes('--apply');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--apply');
if (unknownArguments.length > 0) throw new Error(`Arguments inconnus : ${unknownArguments.join(', ')}`);

const loadTargets = () => prisma.package.findMany({
  where: { slug: { in: OFFICIAL_CATALOGUE_OFFERS.map((offer) => offer.slug) } },
  select: {
    id: true,
    slug: true,
    versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true, status: true } },
  },
});

const main = async () => {
  assertOfficialCatalogue();
  const targets = await loadTargets();
  const bySlug = new Map(targets.map((pack) => [pack.slug, pack]));
  const invalid = OFFICIAL_CATALOGUE_OFFERS.flatMap((offer) => {
    const pack = bySlug.get(offer.slug);
    const current = pack?.versions[0];
    return !pack || !current || current.status !== PackageVersionStatus.DRAFT
      ? [{ slug: offer.slug, status: current?.status ?? 'MISSING' }]
      : [];
  });

  console.log(JSON.stringify({
    mode: apply ? 'VALIDATE_AND_PUBLISH' : 'CHECK_ONLY',
    targets: OFFICIAL_CATALOGUE_OFFERS.length,
    draftTargets: OFFICIAL_CATALOGUE_OFFERS.length - invalid.length,
    invalid,
  }, null, 2));
  if (invalid.length > 0) throw new Error('OFFICIAL_CATALOGUE_DRAFT_GATE_FAILED');
  if (!apply) return;

  const owner = await prisma.adminUser.findFirst({
    where: { role: AdminRole.OWNER, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!owner) throw new Error('ACTIVE_OWNER_REQUIRED');

  for (const offer of OFFICIAL_CATALOGUE_OFFERS) {
    const pack = bySlug.get(offer.slug)!;
    await validatePackageVersion(pack.id, { expectedVersion: pack.versions[0].version, mentionsApproved: true }, owner.id);
  }

  const validatedCount = await prisma.packageVersion.count({
    where: {
      packageId: { in: targets.map((pack) => pack.id) },
      status: PackageVersionStatus.VALIDATED,
    },
  });
  if (validatedCount !== OFFICIAL_CATALOGUE_OFFERS.length) throw new Error('OFFICIAL_CATALOGUE_VALIDATION_GATE_FAILED');

  for (const offer of OFFICIAL_CATALOGUE_OFFERS) {
    const pack = bySlug.get(offer.slug)!;
    await publishPackageVersion(pack.id, pack.versions[0].version, owner.id);
  }

  const [published, drafts, validated] = await Promise.all([
    prisma.packageVersion.count({ where: { packageId: { in: targets.map((pack) => pack.id) }, status: PackageVersionStatus.PUBLISHED } }),
    prisma.packageVersion.count({ where: { packageId: { in: targets.map((pack) => pack.id) }, status: PackageVersionStatus.DRAFT } }),
    prisma.packageVersion.count({ where: { packageId: { in: targets.map((pack) => pack.id) }, status: PackageVersionStatus.VALIDATED } }),
  ]);
  console.log(JSON.stringify({ published, drafts, validated }, null, 2));
  if (published !== 35 || drafts !== 0 || validated !== 0) throw new Error('OFFICIAL_CATALOGUE_PUBLICATION_POSTCONDITION_FAILED');
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
