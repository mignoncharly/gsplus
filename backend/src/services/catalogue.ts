import { PackageVersionStatus } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';
import { listPublishedPackages } from './packages.js';

export const listCatalogueTaxonomy = async () => {
  const rows = await prisma.catalogueTaxonomy.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: { locales: { orderBy: { locale: 'asc' } } },
  });
  return rows.map((row) => ({ key: row.key, sortOrder: row.sortOrder, locales: Object.fromEntries(row.locales.map((item) => [item.locale, item.label])) }));
};

export const listPublishedCatalogueBenefits = async () => {
  const benefits = await prisma.catalogueBenefit.findMany({
    where: { isActive: true, publishedVersion: { not: null } },
    orderBy: { code: 'asc' },
    include: {
      versions: {
        where: { status: PackageVersionStatus.PUBLISHED },
        orderBy: [{ sortOrder: 'asc' }, { version: 'desc' }],
        include: {
          taxonomy: { include: { locales: true } },
          locales: { where: { isEnabled: true }, orderBy: { locale: 'asc' } },
        },
      },
    },
  });
  return benefits.flatMap((benefit) => {
    const version = benefit.versions.find((item) => item.version === benefit.publishedVersion);
    return version ? [{ code: benefit.code, version: version.version, taxonomyKey: version.taxonomyKey, applicationMode: version.applicationMode, sortOrder: version.sortOrder, effectiveAt: version.effectiveAt, taxonomy: version.taxonomy, locales: version.locales }] : [];
  }).sort((left, right) => left.sortOrder - right.sortOrder);
};

export const listPublicCatalogue = async () => {
  const [packages, taxonomy, benefits] = await Promise.all([
    listPublishedPackages(),
    listCatalogueTaxonomy(),
    listPublishedCatalogueBenefits(),
  ]);
  return { packages, taxonomy, benefits };
};


export type TaxonomyUpdate = { sortOrder: number; isActive: boolean; labels: { fr: string; en: string } };
export const updateCatalogueTaxonomy = async (key: string, input: TaxonomyUpdate) => prisma.$transaction(async (tx) => {
  const existing = await tx.catalogueTaxonomy.findUnique({ where: { key } });
  if (!existing) throw new Error('CATALOGUE_TAXONOMY_NOT_FOUND');
  const row = await tx.catalogueTaxonomy.update({ where: { key }, data: { sortOrder: input.sortOrder, isActive: input.isActive } });
  for (const locale of ['fr', 'en'] as const) await tx.catalogueTaxonomyLocale.upsert({ where: { taxonomyKey_locale: { taxonomyKey: key, locale } }, update: { label: input.labels[locale] }, create: { taxonomyKey: key, locale, label: input.labels[locale] } });
  return row;
});

const benefitInclude = { versions: { orderBy: { version: 'desc' as const }, include: { locales: { orderBy: { locale: 'asc' as const } }, taxonomy: { include: { locales: true } }, createdBy: { select: { id: true, name: true, email: true } }, validatedBy: { select: { id: true, name: true, email: true } }, publishedBy: { select: { id: true, name: true, email: true } } } } } as const;
export const listAdminCatalogueBenefits = () => prisma.catalogueBenefit.findMany({ orderBy: { code: 'asc' }, include: benefitInclude });

export type BenefitLocaleInput = { locale: 'fr' | 'en'; name: string; advantage: string; conditions: string; applicationLabel: string; mandatoryWording: string; sourceReference: string; approvedAt?: Date | null; isEnabled?: boolean };
export type BenefitDraftInput = { code: string; taxonomyKey: string; applicationMode: string; sortOrder: number; effectiveAt: Date | null; locales: BenefitLocaleInput[] };
const benefitLocaleData = (item: BenefitLocaleInput) => ({ ...item, approvedAt: item.approvedAt ?? null, isEnabled: item.isEnabled ?? true });
const assertBenefitLocales = (locales: BenefitLocaleInput[]) => {
  for (const locale of ['fr', 'en']) {
    const item = locales.find((entry) => entry.locale === locale && entry.isEnabled !== false);
    if (!item || !item.name.trim() || !item.advantage.trim() || !item.conditions.trim() || !item.applicationLabel.trim() || !item.mandatoryWording.trim()) throw new Error(`CATALOGUE_BENEFIT_LOCALE_INCOMPLETE:${locale}`);
  }
};
export const createCatalogueBenefitDraft = async (input: BenefitDraftInput, adminUserId: string) => {
  const id = await prisma.$transaction(async (tx) => {
    if (await tx.catalogueBenefit.findUnique({ where: { code: input.code } })) throw new Error('CATALOGUE_BENEFIT_CODE_EXISTS');
    const benefit = await tx.catalogueBenefit.create({ data: { code: input.code, isActive: false } });
    const version = await tx.catalogueBenefitVersion.create({ data: { benefitId: benefit.id, version: 1, taxonomyKey: input.taxonomyKey, applicationMode: input.applicationMode, sortOrder: input.sortOrder, effectiveAt: input.effectiveAt, createdById: adminUserId } });
    await tx.catalogueBenefitVersionLocale.createMany({ data: input.locales.map((item) => ({ benefitVersionId: version.id, ...benefitLocaleData(item) })) });
    return benefit.id;
  });
  return prisma.catalogueBenefit.findUniqueOrThrow({ where: { id }, include: benefitInclude });
};
export const updateCatalogueBenefitDraft = async (benefitId: string, expectedVersion: number, input: Omit<BenefitDraftInput, 'code'>, adminUserId: string) => {
  await prisma.$transaction(async (tx) => {
    const benefit = await tx.catalogueBenefit.findUnique({ where: { id: benefitId }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
    if (!benefit) throw new Error('CATALOGUE_BENEFIT_NOT_FOUND');
    const current = benefit.versions[0]; if (!current || current.version !== expectedVersion) throw new Error('CATALOGUE_BENEFIT_VERSION_CONFLICT');
    let version = current;
    if (current.status === PackageVersionStatus.PUBLISHED || current.status === PackageVersionStatus.ARCHIVED) version = await tx.catalogueBenefitVersion.create({ data: { benefitId, version: current.version + 1, taxonomyKey: input.taxonomyKey, applicationMode: input.applicationMode, sortOrder: input.sortOrder, effectiveAt: input.effectiveAt, createdById: adminUserId } });
    else version = await tx.catalogueBenefitVersion.update({ where: { id: current.id }, data: { taxonomyKey: input.taxonomyKey, applicationMode: input.applicationMode, sortOrder: input.sortOrder, effectiveAt: input.effectiveAt, status: PackageVersionStatus.DRAFT, validatedAt: null, validatedById: null } });
    await tx.catalogueBenefitVersionLocale.deleteMany({ where: { benefitVersionId: version.id } });
    await tx.catalogueBenefitVersionLocale.createMany({ data: input.locales.map((item) => ({ benefitVersionId: version.id, ...benefitLocaleData(item), approvedAt: null })) });
  });
  return prisma.catalogueBenefit.findUniqueOrThrow({ where: { id: benefitId }, include: benefitInclude });
};
export const validateCatalogueBenefitVersion = async (benefitId: string, expectedVersion: number, adminUserId: string) => {
  const current = await prisma.catalogueBenefitVersion.findUnique({ where: { benefitId_version: { benefitId, version: expectedVersion } }, include: { locales: true, taxonomy: true } });
  if (!current || current.status !== PackageVersionStatus.DRAFT || !current.taxonomy.isActive || !current.effectiveAt) throw new Error('CATALOGUE_BENEFIT_NOT_PUBLISHABLE');
  assertBenefitLocales(current.locales as BenefitLocaleInput[]);
  const now = new Date(); await prisma.catalogueBenefitVersion.update({ where: { id: current.id }, data: { status: PackageVersionStatus.VALIDATED, validatedAt: now, validatedById: adminUserId } });
};
export const publishCatalogueBenefitVersion = async (benefitId: string, expectedVersion: number, adminUserId: string) => prisma.$transaction(async (tx) => {
  const current = await tx.catalogueBenefitVersion.findUnique({ where: { benefitId_version: { benefitId, version: expectedVersion } }, include: { locales: true, taxonomy: true } });
  if (!current || current.status !== PackageVersionStatus.VALIDATED || !current.effectiveAt || current.effectiveAt > new Date()) throw new Error('CATALOGUE_BENEFIT_NOT_VALIDATED');
  assertBenefitLocales(current.locales as BenefitLocaleInput[]);
  const now = new Date(); await tx.catalogueBenefitVersion.updateMany({ where: { benefitId, status: PackageVersionStatus.PUBLISHED }, data: { status: PackageVersionStatus.ARCHIVED, archivedAt: now } });
  await tx.catalogueBenefitVersion.update({ where: { id: current.id }, data: { status: PackageVersionStatus.PUBLISHED, publishedAt: now, publishedById: adminUserId, archivedAt: null } });
  return tx.catalogueBenefit.update({ where: { id: benefitId }, data: { publishedVersion: expectedVersion, isActive: true } });
});
