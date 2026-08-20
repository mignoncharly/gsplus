import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { AdminRole, PackageVersionStatus, Prisma } from '../src/generated/prisma/client.js';
import { CATALOGUE_BENEFITS, CATALOGUE_TAXONOMY, packageLocalesForOffer, taxonomyKeyForCategory } from '../src/catalogue/catalogue-model.js';
import { OFFICIAL_CATALOGUE_OFFERS, OFFICIAL_CATALOGUE_SOURCE, assertOfficialCatalogue } from '../src/catalogue/golden-studio-plus-2026-08-04.js';
import { prisma } from '../src/db/prisma.js';

const apply = process.argv.includes('--apply');
const approveLocales = process.argv.includes('--approve-locales');
if (apply && approveLocales) throw new Error('Choose either --apply or --approve-locales');
const args = process.argv.slice(2).filter((value) => value !== '--apply' && value !== '--approve-locales');
if (args.length) throw new Error(`Unknown arguments: ${args.join(', ')}`);
const root = fileURLToPath(new URL('../../', import.meta.url));

const normalize = (value: unknown): unknown => Array.isArray(value) ? value.map(normalize) : value && typeof value === 'object' && !(value instanceof Date) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item)])) : value;
const same = (left: unknown, right: unknown) => JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
const localeData = (locale: ReturnType<typeof packageLocalesForOffer>[number]) => ({ ...locale, inclusions: locale.inclusions as Prisma.InputJsonValue, options: locale.options ?? Prisma.JsonNull });
const localeUpdateData = (locale: ReturnType<typeof packageLocalesForOffer>[number]) => {
  const { approvedAt, ...data } = localeData(locale);
  void approvedAt;
  return data;
};

const main = async () => {
  assertOfficialCatalogue();
  const source = await readFile(`${root}${OFFICIAL_CATALOGUE_SOURCE.file}`);
  if (createHash('sha256').update(source).digest('hex') !== OFFICIAL_CATALOGUE_SOURCE.sha256) throw new Error('OFFICIAL_CATALOGUE_SOURCE_HASH_MISMATCH');
  const rows = await prisma.package.findMany({
    where: { slug: { in: OFFICIAL_CATALOGUE_OFFERS.map((item) => item.slug) } },
    include: { versions: { where: { status: PackageVersionStatus.PUBLISHED }, orderBy: { version: 'desc' }, take: 1, include: { locales: true } } },
  });
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const comparisons = OFFICIAL_CATALOGUE_OFFERS.map((offer) => {
    const row = bySlug.get(offer.slug); const version = row?.versions[0]; const locales = version?.locales ?? []; const expectedLocales = packageLocalesForOffer(offer);
    const coreMatches = Boolean(version && version.name === offer.name && version.category === offer.category && version.description === offer.description && version.content === offer.content && same(version.inclusions, offer.inclusions) && version.conditions === offer.conditions && version.price === offer.price && version.currency === offer.currency && version.bookingMode === offer.bookingMode && version.durationMin === offer.durationMin && version.deliveryLabel === offer.deliveryLabel && same(version.options, offer.options) && version.legalText === offer.legalText && row?.isPromo === offer.isPromo && row?.isRange === offer.isRange && row?.sortOrder === offer.sortOrder);
    const localeMatches = expectedLocales.every((expected) => { const actual = locales.find((item) => item.locale === expected.locale); return Boolean(actual && actual.name === expected.name && actual.description === expected.description && actual.content === expected.content && same(actual.inclusions, expected.inclusions) && actual.conditions === expected.conditions && actual.deliveryLabel === expected.deliveryLabel && actual.mandatoryWording === expected.mandatoryWording && same(actual.options, expected.options)); });
    return { slug: offer.slug, exists: Boolean(version), coreMatches, taxonomyMatches: version?.taxonomyKey === taxonomyKeyForCategory(offer.category), localeMatches };
  });
  const currentBenefits = await prisma.catalogueBenefit.findMany({ include: { versions: { include: { locales: true } } } });
  const benefitComparisons = CATALOGUE_BENEFITS.map((expected) => {
    const identity = currentBenefits.find((item) => item.code === expected.code);
    const version = identity?.versions.find((item) => item.version === identity.publishedVersion && item.status === PackageVersionStatus.PUBLISHED);
    const localeMatches = (['fr', 'en'] as const).every((locale) => {
      const actual = version?.locales.find((item) => item.locale === locale);
      const copy = expected.locales[locale];
      return Boolean(actual && actual.name === copy.name && actual.advantage === copy.advantage && actual.conditions === copy.conditions && actual.applicationLabel === copy.applicationLabel && actual.mandatoryWording === copy.mandatoryWording && actual.isEnabled);
    });
    return { code: expected.code, identity, version, localeMatches };
  });
  const packageVersions = comparisons.map((item) => bySlug.get(item.slug)?.versions[0]).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const benefitVersions = benefitComparisons.map((item) => item.version).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const pendingPackageLocales = packageVersions.flatMap((version) => version.locales).filter((locale) => ['fr', 'en'].includes(locale.locale) && locale.isEnabled && locale.approvedAt === null).length;
  const pendingBenefitLocales = benefitVersions.flatMap((version) => version.locales).filter((locale) => ['fr', 'en'].includes(locale.locale) && locale.isEnabled && locale.approvedAt === null).length;
  const summary = {
    mode: apply ? 'MIGRATE_EXISTING_PUBLIC_CONTENT' : approveLocales ? 'OWNER_APPROVE_MIGRATED_LOCALES' : 'REVIEW_ONLY', source: OFFICIAL_CATALOGUE_SOURCE,
    offers: { expected: 35, found: comparisons.filter((item) => item.exists).length, coreMismatches: comparisons.filter((item) => !item.coreMatches).map((item) => item.slug), taxonomyPending: comparisons.filter((item) => !item.taxonomyMatches).map((item) => item.slug), localePending: comparisons.filter((item) => !item.localeMatches).map((item) => item.slug) },
    taxonomy: { expected: 8, keys: CATALOGUE_TAXONOMY.map((item) => item.key) },
    benefits: { expected: 2, existing: currentBenefits.length, codes: CATALOGUE_BENEFITS.map((item) => item.code), mismatches: benefitComparisons.filter((item) => !item.version || !item.localeMatches).map((item) => item.code) },
    approval: { expectedPackageLocales: 70, pendingPackageLocales, expectedBenefitLocales: 4, pendingBenefitLocales, ownerSignOff: pendingPackageLocales === 0 && pendingBenefitLocales === 0 ? 'APPROVED' : 'PENDING' },
    createsDrafts: 0, validatesVersions: 0, publishesVersions: 0,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!apply && !approveLocales) return;
  if (summary.offers.found !== 35 || summary.offers.coreMismatches.length) throw new Error('OWNER_SOURCE_REVIEW_REQUIRED_FOR_CORE_MISMATCHES');
  if (approveLocales && (summary.offers.taxonomyPending.length || summary.offers.localePending.length || summary.benefits.existing !== 2 || summary.benefits.mismatches.length)) throw new Error('CATALOGUE_RECONCILIATION_MUST_BE_EXACT');
  const owner = await prisma.adminUser.findFirst({ where: { role: AdminRole.OWNER, isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!owner) throw new Error('ACTIVE_OWNER_REQUIRED');
  if (approveLocales) {
    if (pendingPackageLocales === 0 && pendingBenefitLocales === 0) {
      console.log(JSON.stringify({ approval: 'ALREADY_APPROVED', publicationsPerformed: 0 }, null, 2));
      return;
    }
    const approvedAt = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const packageLocales = await tx.packageVersionLocale.updateMany({ where: { packageVersionId: { in: packageVersions.map((item) => item.id) }, locale: { in: ['fr', 'en'] }, isEnabled: true, approvedAt: null }, data: { approvedAt } });
      const benefitLocales = await tx.catalogueBenefitVersionLocale.updateMany({ where: { benefitVersionId: { in: benefitVersions.map((item) => item.id) }, locale: { in: ['fr', 'en'] }, isEnabled: true, approvedAt: null }, data: { approvedAt } });
      await tx.auditLog.create({ data: { adminUserId: owner.id, action: 'catalogue.phase3.owner_approve', entityType: 'CatalogueRelease', entityId: 'PHASE3_OWNER_APPROVAL_2026-08-20', metadata: { approvalBasis: 'OWNER_EXPLICIT_CHAT_2026-08-20', sourceSha256: OFFICIAL_CATALOGUE_SOURCE.sha256, locales: ['fr', 'en'], packageVersions: packageVersions.length, packageLocales: packageLocales.count, benefitVersions: benefitVersions.length, benefitLocales: benefitLocales.count, approvedAt: approvedAt.toISOString(), publicationsPerformed: 0 } } });
      return { packageLocales: packageLocales.count, benefitLocales: benefitLocales.count };
    });
    console.log(JSON.stringify({ approval: 'APPROVED', approvedAt: approvedAt.toISOString(), approvedById: owner.id, ...result, publicationsPerformed: 0 }, null, 2));
    return;
  }
  const effectiveAt = new Date('2026-08-20T00:00:00.000Z');
  await prisma.$transaction(async (tx) => {
    for (const taxonomy of CATALOGUE_TAXONOMY) {
      await tx.catalogueTaxonomy.upsert({ where: { key: taxonomy.key }, update: { sortOrder: taxonomy.sortOrder, isActive: true }, create: { key: taxonomy.key, sortOrder: taxonomy.sortOrder } });
      for (const locale of ['fr', 'en'] as const) await tx.catalogueTaxonomyLocale.upsert({ where: { taxonomyKey_locale: { taxonomyKey: taxonomy.key, locale } }, update: { label: taxonomy.labels[locale] }, create: { taxonomyKey: taxonomy.key, locale, label: taxonomy.labels[locale] } });
    }
    for (const offer of OFFICIAL_CATALOGUE_OFFERS) {
      const version = bySlug.get(offer.slug)?.versions[0]; if (!version) throw new Error(`PUBLISHED_VERSION_MISSING:${offer.slug}`);
      await tx.packageVersion.update({ where: { id: version.id }, data: { taxonomyKey: taxonomyKeyForCategory(offer.category), englishEnabled: true } });
      for (const locale of packageLocalesForOffer(offer)) await tx.packageVersionLocale.upsert({ where: { packageVersionId_locale: { packageVersionId: version.id, locale: locale.locale } }, update: localeUpdateData(locale), create: { packageVersionId: version.id, ...localeData(locale) } });
    }
    for (const benefit of CATALOGUE_BENEFITS) {
      const identity = await tx.catalogueBenefit.upsert({ where: { code: benefit.code }, update: { isActive: true, publishedVersion: 1 }, create: { code: benefit.code, isActive: true, publishedVersion: 1 } });
      const version = await tx.catalogueBenefitVersion.upsert({ where: { benefitId_version: { benefitId: identity.id, version: 1 } }, update: { taxonomyKey: benefit.taxonomyKey, applicationMode: benefit.applicationMode, sortOrder: benefit.sortOrder, status: PackageVersionStatus.PUBLISHED, effectiveAt, publishedAt: effectiveAt, publishedById: owner.id }, create: { benefitId: identity.id, version: 1, taxonomyKey: benefit.taxonomyKey, applicationMode: benefit.applicationMode, sortOrder: benefit.sortOrder, status: PackageVersionStatus.PUBLISHED, effectiveAt, validatedAt: effectiveAt, validatedById: owner.id, publishedAt: effectiveAt, publishedById: owner.id, createdById: owner.id } });
      for (const locale of ['fr', 'en'] as const) { const copy=benefit.locales[locale]; await tx.catalogueBenefitVersionLocale.upsert({ where: { benefitVersionId_locale: { benefitVersionId: version.id, locale } }, update: { ...copy, sourceReference: 'MIGRATION:catalogue-promotions:2026-08-20', isEnabled: true }, create: { benefitVersionId: version.id, locale, ...copy, sourceReference: 'MIGRATION:catalogue-promotions:2026-08-20', approvedAt: null, isEnabled: true } }); }
    }
  });
  console.log(JSON.stringify({ migratedPackageVersions: 35, migratedBenefits: 2, publicationsPerformed: 0 }, null, 2));
};
main().catch((error) => { console.error(error); process.exitCode=1; }).finally(async()=>prisma.$disconnect());
