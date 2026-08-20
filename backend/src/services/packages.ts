import { deliveryLabelOrigin } from '../catalogue/delivery-labels.js';
import { taxonomyKeyForCategory } from '../catalogue/catalogue-model.js';
import { HttpError } from '../errors/http-error.js';
import {
  PackageVersionStatus,
  PackageBookingMode,
  Prisma,
  type Package,
  type PackageVersion,
} from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';

const actorSelect = { id: true, name: true, email: true } as const;
const versionActors = {
  createdBy: { select: actorSelect },
  validatedBy: { select: actorSelect },
  publishedBy: { select: actorSelect },
  taxonomy: { include: { locales: true } },
  locales: { orderBy: { locale: 'asc' as const } },
} satisfies Prisma.PackageVersionInclude;

const adminPackageInclude = {
  _count: { select: { reservations: true, reservationIntents: true } },
  versions: {
    orderBy: { version: 'desc' as const },
    include: versionActors,
  },
} satisfies Prisma.PackageInclude;

type AdminPackage = Prisma.PackageGetPayload<{ include: typeof adminPackageInclude }>;
type VersionWithActors = Prisma.PackageVersionGetPayload<{ include: typeof versionActors }>;

const jsonValue = (value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined) =>
  value === null || value === undefined ? Prisma.JsonNull : value as Prisma.InputJsonValue;

const legacyVersionData = (pack: Package, createdById?: string) => ({
  packageId: pack.id,
  version: pack.publishedVersion ?? pack.version,
  name: pack.name,
  category: pack.category,
  taxonomyKey: taxonomyKeyForCategory(pack.category),
  englishEnabled: false,
  description: pack.description,
  content: pack.description ?? pack.name,
  inclusions: jsonValue(pack.options),
  conditions: pack.legalText ?? pack.description ?? pack.name,
  price: pack.price,
  currency: pack.currency,
  durationMin: pack.durationMin,
  bookingMode: pack.bookingMode,
  deliveryLabel: pack.deliveryLabel,
  options: jsonValue(pack.options),
  legalText: pack.legalText,
  legalApprovedAt: pack.legalApprovedAt,
  status: PackageVersionStatus.PUBLISHED,
  effectiveAt: pack.createdAt,
  publishedAt: pack.createdAt,
  publishedById: createdById,
  createdById,
});

export const ensurePublishedPackageVersion = async (tx: Prisma.TransactionClient, pack: Package) => {
  const publishedVersion = pack.publishedVersion
    ? await tx.packageVersion.findUnique({
        where: { packageId_version: { packageId: pack.id, version: pack.publishedVersion } },
      })
    : await tx.packageVersion.findFirst({
        where: { packageId: pack.id, status: PackageVersionStatus.PUBLISHED },
        orderBy: { version: 'desc' },
      });
  if (publishedVersion) return publishedVersion;

  const version = await tx.packageVersion.upsert({
    where: { packageId_version: { packageId: pack.id, version: pack.version } },
    update: {
      status: PackageVersionStatus.PUBLISHED,
      effectiveAt: pack.createdAt,
      publishedAt: pack.createdAt,
    },
    create: legacyVersionData(pack),
  });
  await tx.package.update({
    where: { id: pack.id },
    data: { publishedVersion: version.version },
  });
  return version;
};

const publishedVersionOf = (pack: AdminPackage) =>
  pack.versions.find((version) => version.version === pack.publishedVersion)
  ?? pack.versions.find((version) => version.status === PackageVersionStatus.PUBLISHED)
  ?? null;

const versionProjection = (version: VersionWithActors | PackageVersion) => ({
  version: version.version,
  name: version.name,
  category: version.category,
  taxonomyKey: version.taxonomyKey,
  englishEnabled: version.englishEnabled,
  taxonomy: 'taxonomy' in version ? version.taxonomy : null,
  locales: 'locales' in version ? version.locales : [],
  description: version.description,
  content: version.content,
  inclusions: version.inclusions,
  conditions: version.conditions,
  price: version.price,
  currency: version.currency,
  durationMin: version.durationMin,
  bookingMode: version.bookingMode,
  deliveryLabel: version.deliveryLabel,
  deliveryLabelOrigin: deliveryLabelOrigin(version.deliveryLabel),
  options: version.options,
  legalText: version.legalText,
  legalApprovedAt: version.legalApprovedAt,
  publicationStatus: version.status,
  effectiveAt: version.effectiveAt,
  validatedAt: version.validatedAt,
  publishedAt: version.publishedAt,
  archivedAt: version.archivedAt,
  publishedBy: 'publishedBy' in version ? version.publishedBy : null,
});

export const adminPackageView = (pack: AdminPackage) => {
  const current = pack.versions[0] ?? null;
  const published = publishedVersionOf(pack);
  return {
    ...pack,
    ...(current ? versionProjection(current) : {}),
    currentVersion: current,
    publishedVersionData: published,
    publishedAt: published?.publishedAt ?? null,
    publishedBy: published?.publishedBy ?? null,
  };
};

const loadAdminPackage = async (packageId: string) => {
  const pack = await prisma.package.findUnique({
    where: { id: packageId },
    include: adminPackageInclude,
  });
  if (!pack) throw new HttpError(404, 'PACKAGE_NOT_FOUND', 'Formule introuvable.');
  return adminPackageView(pack);
};

export const listAdminPackages = async () => {
  const packages = await prisma.package.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: adminPackageInclude,
  });
  return packages.map(adminPackageView);
};

export const listPublishedPackages = async () => {
  const packages = await prisma.package.findMany({
    where: { isActive: true, isArchived: false, publishedVersion: { not: null } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      versions: {
        where: { status: PackageVersionStatus.PUBLISHED },
        orderBy: { version: 'desc' },
        take: 1,
        include: {
          taxonomy: { include: { locales: true } },
          locales: { where: { isEnabled: true }, orderBy: { locale: 'asc' } },
        },
      },
    },
  });
  return packages.flatMap((pack) => {
    const published = pack.versions[0];
    return published ? [{ ...pack, ...versionProjection(published), publishedVersion: published.version }] : [];
  });
};

export type PackageUpdate = {
  slug?: string;
  name?: string;
  category?: string;
  taxonomyKey?: string;
  englishEnabled?: boolean;
  locales?: PackageLocaleUpdate[];
  description?: string | null;
  content?: string | null;
  inclusions?: string[] | null;
  conditions?: string | null;
  price?: number;
  currency?: string;
  durationMin?: number | null;
  bookingMode?: PackageBookingMode;
  deliveryLabel?: string | null;
  options?: Prisma.InputJsonValue | null;
  legalText?: string | null;
  effectiveAt?: Date | null;
  isPromo?: boolean;
  isRange?: boolean;
  sortOrder?: number;
};

export type PackageLocaleUpdate = {
  locale: 'fr' | 'en';
  name: string;
  description?: string | null;
  content: string;
  inclusions: string[];
  conditions: string;
  deliveryLabel: string;
  mandatoryWording: string;
  options?: Prisma.InputJsonValue | null;
  sourceReference: string;
  approvedAt?: Date | null;
  isEnabled?: boolean;
};

export type PackageCreate = Required<Pick<PackageUpdate, 'slug' | 'name' | 'category' | 'price'>> & PackageUpdate;

const frenchLocaleFromCore = (input: { name: string; description?: string | null; content?: string | null; inclusions?: unknown; conditions?: string | null; deliveryLabel?: string | null; legalText?: string | null; options?: unknown }): PackageLocaleUpdate => ({
  locale: 'fr', name: input.name, description: input.description ?? null, content: input.content ?? '', inclusions: Array.isArray(input.inclusions) ? input.inclusions.filter((item): item is string => typeof item === 'string') : [], conditions: input.conditions ?? '', deliveryLabel: input.deliveryLabel ?? '', mandatoryWording: input.legalText ?? '', options: input.options as Prisma.InputJsonValue ?? null, sourceReference: 'ADMIN_EDITOR', approvedAt: null, isEnabled: true,
});

const localeCreateData = (locale: PackageLocaleUpdate) => ({
  locale: locale.locale,
  name: locale.name,
  description: locale.description ?? null,
  content: locale.content,
  inclusions: jsonValue(locale.inclusions),
  conditions: locale.conditions,
  deliveryLabel: locale.deliveryLabel,
  mandatoryWording: locale.mandatoryWording,
  options: jsonValue(locale.options),
  sourceReference: locale.sourceReference,
  approvedAt: locale.approvedAt ?? null,
  isEnabled: locale.isEnabled ?? true,
});

const assertBookingConfiguration = (bookingMode: PackageBookingMode, durationMin: number | null) => {
  if (bookingMode === PackageBookingMode.DIRECT && durationMin === null) {
    throw new HttpError(400, 'PACKAGE_DURATION_REQUIRED', 'La durée est obligatoire pour une réservation directe.');
  }
};

const draftData = (input: PackageCreate, packageId: string, version: number, createdById?: string) => ({
  packageId,
  version,
  name: input.name,
  category: input.category,
  taxonomyKey: input.taxonomyKey ?? taxonomyKeyForCategory(input.category),
  englishEnabled: input.englishEnabled ?? false,
  description: input.description ?? null,
  content: input.content ?? null,
  inclusions: jsonValue(input.inclusions),
  conditions: input.conditions ?? null,
  price: input.price,
  currency: input.currency ?? 'XAF',
  durationMin: input.durationMin ?? null,
  bookingMode: input.bookingMode ?? PackageBookingMode.DIRECT,
  deliveryLabel: input.deliveryLabel ?? null,
  options: jsonValue(input.options),
  legalText: input.legalText ?? null,
  legalApprovedAt: null,
  status: PackageVersionStatus.DRAFT,
  effectiveAt: input.effectiveAt ?? null,
  createdById,
});

export const createPackageWithVersion = async (input: PackageCreate, adminUserId?: string) => {
  assertBookingConfiguration(input.bookingMode ?? PackageBookingMode.DIRECT, input.durationMin ?? null);
  const packageId = await prisma.$transaction(async (tx) => {
    if (await tx.package.findUnique({ where: { slug: input.slug } })) {
      throw new HttpError(409, 'PACKAGE_SLUG_EXISTS', 'Une formule utilise déjà cet identifiant.');
    }
    const created = await tx.package.create({
      data: {
        slug: input.slug,
        name: input.name,
        category: input.category,
        description: input.description ?? null,
        price: input.price,
        currency: input.currency ?? 'XAF',
        durationMin: input.durationMin ?? null,
        bookingMode: input.bookingMode ?? PackageBookingMode.DIRECT,
        deliveryLabel: input.deliveryLabel ?? null,
        options: jsonValue(input.options),
        legalText: input.legalText ?? null,
        legalApprovedAt: null,
        version: 1,
        publishedVersion: null,
        isPromo: input.isPromo ?? false,
        isRange: input.isRange ?? false,
        isActive: false,
        isArchived: false,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    const version = await tx.packageVersion.create({ data: draftData(input, created.id, 1, adminUserId) });
    const locales = input.locales?.length ? input.locales : [frenchLocaleFromCore(input)];
    await tx.packageVersionLocale.createMany({ data: locales.map((locale) => ({ packageVersionId: version.id, ...localeCreateData(locale) })) });
    return created.id;
  });
  return loadAdminPackage(packageId);
};

export const duplicatePackageWithVersion = async (
  packageId: string,
  input: { slug?: string; name?: string },
  adminUserId?: string,
) => {
  const createdId = await prisma.$transaction(async (tx) => {
    const source = await tx.package.findUnique({
      where: { id: packageId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1, include: { locales: true } } },
    });
    if (!source) throw new HttpError(404, 'PACKAGE_NOT_FOUND', 'Formule introuvable.');
    const version = source.versions[0] ?? await ensurePublishedPackageVersion(tx, source);

    let slug = input.slug ?? `${source.slug}-copie`;
    if (!input.slug) {
      let suffix = 2;
      while (await tx.package.findUnique({ where: { slug } })) {
        slug = `${source.slug}-copie-${suffix}`;
        suffix += 1;
      }
    } else if (await tx.package.findUnique({ where: { slug } })) {
      throw new HttpError(409, 'PACKAGE_SLUG_EXISTS', 'Une formule utilise déjà cet identifiant.');
    }

    const created = await tx.package.create({
      data: {
        slug,
        name: input.name ?? `${version.name} — copie`,
        category: version.category,
        description: version.description,
        price: version.price,
        currency: version.currency,
        durationMin: version.durationMin,
        bookingMode: version.bookingMode,
        deliveryLabel: version.deliveryLabel,
        options: jsonValue(version.options),
        legalText: version.legalText,
        version: 1,
        publishedVersion: null,
        isPromo: source.isPromo,
        isRange: source.isRange,
        isActive: false,
        isArchived: false,
        sortOrder: source.sortOrder + 1,
      },
    });
    const duplicatedVersion = await tx.packageVersion.create({
      data: {
        packageId: created.id,
        version: 1,
        name: input.name ?? `${version.name} — copie`,
        category: version.category,
        taxonomyKey: version.taxonomyKey,
        englishEnabled: version.englishEnabled,
        description: version.description,
        content: version.content,
        inclusions: jsonValue(version.inclusions),
        conditions: version.conditions,
        price: version.price,
        currency: version.currency,
        durationMin: version.durationMin,
        bookingMode: version.bookingMode,
        deliveryLabel: version.deliveryLabel,
        options: jsonValue(version.options),
        legalText: version.legalText,
        legalApprovedAt: null,
        status: PackageVersionStatus.DRAFT,
        effectiveAt: null,
        createdById: adminUserId,
      },
    });
    if (version.locales.length) {
      await tx.packageVersionLocale.createMany({ data: version.locales.map((locale) => ({ packageVersionId: duplicatedVersion.id, ...localeCreateData(locale as PackageLocaleUpdate), approvedAt: null })) });
    }
    return created.id;
  });
  return loadAdminPackage(createdId);
};

const mergedDraft = (version: PackageVersion, input: PackageUpdate) => ({
  name: input.name ?? version.name,
  category: input.category ?? version.category,
  taxonomyKey: input.taxonomyKey ?? (input.category ? taxonomyKeyForCategory(input.category) : version.taxonomyKey),
  englishEnabled: input.englishEnabled ?? version.englishEnabled,
  description: input.description === undefined ? version.description : input.description,
  content: input.content === undefined ? version.content : input.content,
  inclusions: input.inclusions === undefined ? jsonValue(version.inclusions) : jsonValue(input.inclusions),
  conditions: input.conditions === undefined ? version.conditions : input.conditions,
  price: input.price ?? version.price,
  currency: input.currency ?? version.currency,
  durationMin: input.durationMin === undefined ? version.durationMin : input.durationMin,
  bookingMode: input.bookingMode ?? version.bookingMode,
  deliveryLabel: input.deliveryLabel === undefined ? version.deliveryLabel : input.deliveryLabel,
  options: input.options === undefined ? jsonValue(version.options) : jsonValue(input.options),
  legalText: input.legalText === undefined ? version.legalText : input.legalText,
  effectiveAt: input.effectiveAt === undefined ? version.effectiveAt : input.effectiveAt,
  legalApprovedAt: null,
  status: PackageVersionStatus.DRAFT,
  validatedAt: null,
  validatedById: null,
});

export const updatePackageWithVersion = async (
  packageId: string,
  input: PackageUpdate,
  adminUserId?: string,
) => {
  await prisma.$transaction(async (tx) => {
    let pack = await tx.package.findUnique({
      where: { id: packageId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1, include: { locales: true, taxonomy: true } } },
    });
    if (!pack) throw new HttpError(404, 'PACKAGE_NOT_FOUND', 'Formule introuvable.');

    if (input.slug && input.slug !== pack.slug && await tx.package.findUnique({ where: { slug: input.slug } })) {
      throw new HttpError(409, 'PACKAGE_SLUG_EXISTS', 'Une formule utilise déjà cet identifiant.');
    }

    const versionFields: (keyof PackageUpdate)[] = [
      'name', 'category', 'taxonomyKey', 'englishEnabled', 'locales', 'description', 'content', 'inclusions', 'conditions', 'price',
      'currency', 'durationMin', 'bookingMode', 'deliveryLabel', 'options', 'legalText', 'effectiveAt',
    ];
    if (!versionFields.some((field) => input[field] !== undefined)) {
      await tx.package.update({
        where: { id: packageId },
        data: {
          ...(input.slug === undefined ? {} : { slug: input.slug }),
          ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
          ...(input.isPromo === undefined ? {} : { isPromo: input.isPromo }),
          ...(input.isRange === undefined ? {} : { isRange: input.isRange }),
        },
      });
      return;
    }

    let current = pack.versions[0];
    if (!current) {
      await ensurePublishedPackageVersion(tx, pack);
      current = await tx.packageVersion.findFirstOrThrow({ where: { packageId }, orderBy: { version: 'desc' }, include: { locales: true, taxonomy: true } });
    }
    const values = mergedDraft(current, input);
    assertBookingConfiguration(values.bookingMode, values.durationMin);
    let nextVersion = current.version;

    if (current.status === PackageVersionStatus.DRAFT || current.status === PackageVersionStatus.VALIDATED) {
      await tx.packageVersion.update({ where: { id: current.id }, data: values });
      if (input.locales) {
        await tx.packageVersionLocale.deleteMany({ where: { packageVersionId: current.id } });
        await tx.packageVersionLocale.createMany({ data: input.locales.map((locale) => ({ packageVersionId: current.id, ...localeCreateData(locale) })) });
      } else {
        const french = frenchLocaleFromCore(values);
        await tx.packageVersionLocale.upsert({ where: { packageVersionId_locale: { packageVersionId: current.id, locale: 'fr' } }, update: localeCreateData(french), create: { packageVersionId: current.id, ...localeCreateData(french) } });
      }
    } else {
      nextVersion = Math.max(pack.version, current.version) + 1;
      const createdVersion = await tx.packageVersion.create({
        data: { packageId, version: nextVersion, ...values, createdById: adminUserId },
      });
      const locales = input.locales ?? await tx.packageVersionLocale.findMany({ where: { packageVersionId: current.id } });
      if (locales.length) {
        await tx.packageVersionLocale.createMany({ data: locales.map((locale) => ({
          packageVersionId: createdVersion.id,
          ...localeCreateData(locale as PackageLocaleUpdate),
          approvedAt: input.locales ? locale.approvedAt : null,
        })) });
      }
      if (!input.locales) {
        const french = frenchLocaleFromCore(values);
        await tx.packageVersionLocale.upsert({ where: { packageVersionId_locale: { packageVersionId: createdVersion.id, locale: 'fr' } }, update: localeCreateData(french), create: { packageVersionId: createdVersion.id, ...localeCreateData(french) } });
      }
    }

    const hasPublished = pack.publishedVersion !== null;
    await tx.package.update({
      where: { id: packageId },
      data: {
        ...(input.slug === undefined ? {} : { slug: input.slug }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
        ...(input.isPromo === undefined ? {} : { isPromo: input.isPromo }),
        ...(input.isRange === undefined ? {} : { isRange: input.isRange }),
        version: nextVersion,
        ...(!hasPublished ? {
          name: values.name,
          category: values.category,
          description: values.description,
          price: values.price,
          currency: values.currency,
          durationMin: values.durationMin,
          bookingMode: values.bookingMode,
          deliveryLabel: values.deliveryLabel,
          options: values.options,
          legalText: values.legalText,
          legalApprovedAt: null,
        } : {}),
      },
    });
  });
  return loadAdminPackage(packageId);
};

const requireCurrentVersion = async (
  tx: Prisma.TransactionClient,
  packageId: string,
  expectedVersion: number,
) => {
  const pack = await tx.package.findUnique({
    where: { id: packageId },
    include: { versions: { orderBy: { version: 'desc' }, take: 1, include: { locales: true, taxonomy: true } } },
  });
  if (!pack) throw new HttpError(404, 'PACKAGE_NOT_FOUND', 'Formule introuvable.');
  if (!pack.versions[0]) {
    await ensurePublishedPackageVersion(tx, pack);
    const current = await tx.packageVersion.findFirstOrThrow({ where: { packageId }, orderBy: { version: 'desc' }, include: { locales: true, taxonomy: true } });
    if (current.version !== expectedVersion) throw new HttpError(409, 'PACKAGE_VERSION_CONFLICT', 'La formule a été modifiée. Actualisez avant de continuer.');
    return { pack, current };
  }
  const current = pack.versions[0];
  if (current.version !== expectedVersion) {
    throw new HttpError(409, 'PACKAGE_VERSION_CONFLICT', 'La formule a été modifiée. Actualisez avant de continuer.');
  }
  return { pack, current };
};

type PublishableVersion = PackageVersion & { locales: Array<{ locale: string; name: string; content: string; inclusions: Prisma.JsonValue; conditions: string; deliveryLabel: string; mandatoryWording: string; isEnabled: boolean }>; taxonomy: { isActive: boolean } | null };

export const assertPublishable = (version: PublishableVersion) => {
  const missing: string[] = [];
  if (!version.name.trim()) missing.push('name');
  if (version.price < 0) missing.push('price');
  if (!/^[A-Z]{3}$/.test(version.currency)) missing.push('currency');
  if (version.bookingMode === PackageBookingMode.DIRECT && (version.durationMin === null || version.durationMin < 15)) missing.push('durationMin');
  if (!version.description?.trim()) missing.push('description');
  if (!version.content?.trim()) missing.push('content');
  if (!Array.isArray(version.inclusions) || version.inclusions.length === 0) missing.push('inclusions');
  if (!version.conditions?.trim()) missing.push('conditions');
  if (!version.legalText?.trim()) missing.push('legalText');
  if (!version.deliveryLabel?.trim()) missing.push('deliveryLabel');
  if (!version.effectiveAt) missing.push('effectiveAt');
  if (!version.taxonomyKey || !version.taxonomy?.isActive) missing.push('taxonomyKey');
  const requiredLocales = version.englishEnabled ? ['fr', 'en'] : ['fr'];
  for (const locale of requiredLocales) {
    const localized = version.locales.find((item) => item.locale === locale && item.isEnabled);
    if (!localized || !localized.name.trim() || !localized.content.trim() || !Array.isArray(localized.inclusions) || localized.inclusions.length === 0 || !localized.conditions.trim() || !localized.deliveryLabel.trim() || !localized.mandatoryWording.trim()) {
      missing.push(`locales.${locale}`);
    }
  }
  if (missing.length > 0) {
    throw new HttpError(409, 'PACKAGE_PUBLICATION_FIELDS_REQUIRED', 'Complétez tous les champs obligatoires avant validation.', { fields: missing });
  }
  if (version.effectiveAt && version.effectiveAt.getTime() > Date.now()) {
    throw new HttpError(409, 'PACKAGE_EFFECTIVE_DATE_IN_FUTURE', 'La date d’effet doit être atteinte avant publication.');
  }
};

export const validatePackageVersion = async (
  packageId: string,
  input: { expectedVersion: number; mentionsApproved: boolean },
  adminUserId: string,
) => {
  await prisma.$transaction(async (tx) => {
    const { current } = await requireCurrentVersion(tx, packageId, input.expectedVersion);
    if (current.status !== PackageVersionStatus.DRAFT) {
      throw new HttpError(409, 'PACKAGE_NOT_DRAFT', 'Seul un brouillon peut être validé.');
    }
    assertPublishable(current);
    if (!input.mentionsApproved) {
      throw new HttpError(409, 'PACKAGE_MENTIONS_APPROVAL_REQUIRED', 'Les mentions obligatoires doivent être approuvées.');
    }
    const now = new Date();
    await tx.packageVersion.update({
      where: { id: current.id },
      data: {
        status: PackageVersionStatus.VALIDATED,
        legalApprovedAt: now,
        validatedAt: now,
        validatedById: adminUserId,
      },
    });
  });
  return loadAdminPackage(packageId);
};

export const publishPackageVersion = async (
  packageId: string,
  expectedVersion: number,
  adminUserId: string,
) => {
  await prisma.$transaction(async (tx) => {
    const { current } = await requireCurrentVersion(tx, packageId, expectedVersion);
    if (current.status !== PackageVersionStatus.VALIDATED || !current.legalApprovedAt) {
      throw new HttpError(409, 'PACKAGE_NOT_VALIDATED', 'Validez les mentions obligatoires avant publication.');
    }
    assertPublishable(current);
    const now = new Date();
    await tx.packageVersion.updateMany({
      where: { packageId, status: PackageVersionStatus.PUBLISHED },
      data: { status: PackageVersionStatus.ARCHIVED, archivedAt: now },
    });
    await tx.packageVersion.update({
      where: { id: current.id },
      data: {
        status: PackageVersionStatus.PUBLISHED,
        publishedAt: now,
        publishedById: adminUserId,
        archivedAt: null,
      },
    });
    await tx.package.update({
      where: { id: packageId },
      data: {
        name: current.name,
        category: current.category,
        description: current.description,
        price: current.price,
        currency: current.currency,
        durationMin: current.durationMin,
        bookingMode: current.bookingMode,
        deliveryLabel: current.deliveryLabel,
        options: jsonValue(current.options),
        legalText: current.legalText,
        legalApprovedAt: current.legalApprovedAt,
        publishedVersion: current.version,
        version: current.version,
        isActive: true,
        isArchived: false,
        archivedAt: null,
      },
    });
  });
  return loadAdminPackage(packageId);
};

export const archivePublishedPackage = async (
  packageId: string,
  expectedVersion: number,
) => {
  await prisma.$transaction(async (tx) => {
    const pack = await tx.package.findUnique({ where: { id: packageId } });
    if (!pack) throw new HttpError(404, 'PACKAGE_NOT_FOUND', 'Formule introuvable.');
    if (pack.publishedVersion !== expectedVersion) {
      throw new HttpError(409, 'PACKAGE_VERSION_CONFLICT', 'La version publiée a changé.');
    }
    const published = await tx.packageVersion.findUnique({
      where: { packageId_version: { packageId, version: expectedVersion } },
    });
    if (!published || published.status !== PackageVersionStatus.PUBLISHED) {
      throw new HttpError(409, 'PACKAGE_NOT_PUBLISHED', 'Aucune version publiée ne peut être archivée.');
    }
    const now = new Date();
    await tx.packageVersion.update({
      where: { id: published.id },
      data: { status: PackageVersionStatus.ARCHIVED, archivedAt: now },
    });
    await tx.package.update({
      where: { id: packageId },
      data: { isActive: false, isArchived: true, archivedAt: now },
    });
  });
  return loadAdminPackage(packageId);
};

export const deleteUnreferencedPackage = async (packageId: string) =>
  prisma.$transaction(async (tx) => {
    const current = await tx.package.findUnique({
      where: { id: packageId },
      include: { _count: { select: { reservations: true, reservationIntents: true } } },
    });
    if (!current) throw new HttpError(404, 'PACKAGE_NOT_FOUND', 'Formule introuvable.');
    if (current._count.reservations > 0 || current._count.reservationIntents > 0) {
      throw new HttpError(409, 'PACKAGE_IN_USE', 'Une formule référencée ne peut pas être supprimée; archivez-la.');
    }
    await tx.package.delete({ where: { id: packageId } });
    return current;
  });
