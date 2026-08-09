import { PackageVersionStatus } from '../src/generated/prisma/client.js';
import { OFFICIAL_CATALOGUE_OFFERS, assertOfficialCatalogue } from '../src/catalogue/golden-studio-plus-2026-08-04.js';
import { prisma } from '../src/db/prisma.js';

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

const main = async () => {
  assertOfficialCatalogue();
  const packages = await prisma.package.findMany({
    where: { slug: { in: OFFICIAL_CATALOGUE_OFFERS.map((offer) => offer.slug) } },
    select: {
      slug: true,
      isPromo: true,
      isRange: true,
      sortOrder: true,
      versions: {
        where: { status: PackageVersionStatus.DRAFT },
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });
  const packagesBySlug = new Map(packages.map((pack) => [pack.slug, pack]));
  const mismatches: Array<{ slug: string; fields: string[] }> = [];

  for (const offer of OFFICIAL_CATALOGUE_OFFERS) {
    const pack = packagesBySlug.get(offer.slug);
    const draft = pack?.versions[0];
    const fields: string[] = [];
    if (!pack) fields.push('package');
    if (!draft) fields.push('draft');
    if (pack && draft) {
      const scalarChecks = {
        name: draft.name === offer.name,
        category: draft.category === offer.category,
        description: draft.description === offer.description,
        content: draft.content === offer.content,
        conditions: draft.conditions === offer.conditions,
        price: draft.price === offer.price,
        currency: draft.currency === offer.currency,
        durationMin: draft.durationMin === offer.durationMin,
        bookingMode: draft.bookingMode === offer.bookingMode,
        deliveryLabel: draft.deliveryLabel === offer.deliveryLabel,
        legalText: draft.legalText === offer.legalText,
        effectiveAt: draft.effectiveAt?.toISOString() === offer.effectiveAt.toISOString(),
        isPromo: pack.isPromo === offer.isPromo,
        isRange: pack.isRange === offer.isRange,
        sortOrder: pack.sortOrder === offer.sortOrder,
      };
      for (const [field, matches] of Object.entries(scalarChecks)) if (!matches) fields.push(field);
      if (!equalJson(draft.inclusions, offer.inclusions)) fields.push('inclusions');
      if (!equalJson(draft.options, offer.options)) fields.push('options');
    }
    if (fields.length > 0) mismatches.push({ slug: offer.slug, fields });
  }

  const publicCount = await prisma.package.count({
    where: { isActive: true, isArchived: false, publishedVersion: { not: null } },
  });
  console.log(JSON.stringify({
    targetOffers: OFFICIAL_CATALOGUE_OFFERS.length,
    matchingDrafts: OFFICIAL_CATALOGUE_OFFERS.length - mismatches.length,
    mismatches,
    publicPackages: publicCount,
    publicationsPerformedByVerifier: 0,
  }, null, 2));
  if (mismatches.length > 0) process.exitCode = 1;
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
