import { HttpError } from '../errors/http-error.js';
import {
  PackageVersionStatus,
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
  description: pack.description,
  content: pack.description ?? pack.name,
  inclusions: jsonValue(pack.options),
  conditions: pack.legalText ?? pack.description ?? pack.name,
  price: pack.price,
  currency: pack.currency,
  durationMin: pack.durationMin,
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
  description: version.description,
  content: version.content,
  inclusions: version.inclusions,
  conditions: version.conditions,
  price: version.price,
  currency: version.currency,
  durationMin: version.durationMin,
  deliveryLabel: version.deliveryLabel,
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
  description?: string | null;
  content?: string | null;
  inclusions?: string[] | null;
  conditions?: string | null;
  price?: number;
  currency?: string;
  durationMin?: number;
  deliveryLabel?: string | null;
  options?: Prisma.InputJsonValue | null;
  legalText?: string | null;
  effectiveAt?: Date | null;
  isPromo?: boolean;
  isRange?: boolean;
  sortOrder?: number;
};

export type PackageCreate = Required<Pick<PackageUpdate, 'slug' | 'name' | 'category' | 'price' | 'durationMin'>> &
  PackageUpdate;

const draftData = (input: PackageCreate, packageId: string, version: number, createdById?: string) => ({
  packageId,
  version,
  name: input.name,
  category: input.category,
  description: input.description ?? null,
  content: input.content ?? null,
  inclusions: jsonValue(input.inclusions),
  conditions: input.conditions ?? null,
  price: input.price,
  currency: input.currency ?? 'XAF',
  durationMin: input.durationMin,
  deliveryLabel: input.deliveryLabel ?? null,
  options: jsonValue(input.options),
  legalText: input.legalText ?? null,
  legalApprovedAt: null,
  status: PackageVersionStatus.DRAFT,
  effectiveAt: input.effectiveAt ?? null,
  createdById,
});

export const createPackageWithVersion = async (input: PackageCreate, adminUserId?: string) => {
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
        durationMin: input.durationMin,
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
    await tx.packageVersion.create({ data: draftData(input, created.id, 1, adminUserId) });
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
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
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
    await tx.packageVersion.create({
      data: {
        packageId: created.id,
        version: 1,
        name: input.name ?? `${version.name} — copie`,
        category: version.category,
        description: version.description,
        content: version.content,
        inclusions: jsonValue(version.inclusions),
        conditions: version.conditions,
        price: version.price,
        currency: version.currency,
        durationMin: version.durationMin,
        deliveryLabel: version.deliveryLabel,
        options: jsonValue(version.options),
        legalText: version.legalText,
        legalApprovedAt: null,
        status: PackageVersionStatus.DRAFT,
        effectiveAt: null,
        createdById: adminUserId,
      },
    });
    return created.id;
  });
  return loadAdminPackage(createdId);
};

const mergedDraft = (version: PackageVersion, input: PackageUpdate) => ({
  name: input.name ?? version.name,
  category: input.category ?? version.category,
  description: input.description === undefined ? version.description : input.description,
  content: input.content === undefined ? version.content : input.content,
  inclusions: input.inclusions === undefined ? jsonValue(version.inclusions) : jsonValue(input.inclusions),
  conditions: input.conditions === undefined ? version.conditions : input.conditions,
  price: input.price ?? version.price,
  currency: input.currency ?? version.currency,
  durationMin: input.durationMin ?? version.durationMin,
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
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!pack) throw new HttpError(404, 'PACKAGE_NOT_FOUND', 'Formule introuvable.');

    if (input.slug && input.slug !== pack.slug && await tx.package.findUnique({ where: { slug: input.slug } })) {
      throw new HttpError(409, 'PACKAGE_SLUG_EXISTS', 'Une formule utilise déjà cet identifiant.');
    }

    const versionFields: (keyof PackageUpdate)[] = [
      'name', 'category', 'description', 'content', 'inclusions', 'conditions', 'price',
      'currency', 'durationMin', 'deliveryLabel', 'options', 'legalText', 'effectiveAt',
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
      current = await ensurePublishedPackageVersion(tx, pack);
      pack = { ...pack, publishedVersion: current.version, versions: [current] };
    }
    const values = mergedDraft(current, input);
    let nextVersion = current.version;

    if (current.status === PackageVersionStatus.DRAFT || current.status === PackageVersionStatus.VALIDATED) {
      await tx.packageVersion.update({ where: { id: current.id }, data: values });
    } else {
      nextVersion = Math.max(pack.version, current.version) + 1;
      await tx.packageVersion.create({
        data: { packageId, version: nextVersion, ...values, createdById: adminUserId },
      });
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
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (!pack) throw new HttpError(404, 'PACKAGE_NOT_FOUND', 'Formule introuvable.');
  const current = pack.versions[0] ?? await ensurePublishedPackageVersion(tx, pack);
  if (current.version !== expectedVersion) {
    throw new HttpError(409, 'PACKAGE_VERSION_CONFLICT', 'La formule a été modifiée. Actualisez avant de continuer.');
  }
  return { pack, current };
};

const assertPublishable = (version: PackageVersion) => {
  const missing: string[] = [];
  if (!version.name.trim()) missing.push('name');
  if (version.price < 0) missing.push('price');
  if (!/^[A-Z]{3}$/.test(version.currency)) missing.push('currency');
  if (version.durationMin < 15) missing.push('durationMin');
  if (!version.description?.trim()) missing.push('description');
  if (!version.content?.trim()) missing.push('content');
  if (!Array.isArray(version.inclusions) || version.inclusions.length === 0) missing.push('inclusions');
  if (!version.conditions?.trim()) missing.push('conditions');
  if (!version.legalText?.trim()) missing.push('legalText');
  if (!version.deliveryLabel?.trim()) missing.push('deliveryLabel');
  if (!version.effectiveAt) missing.push('effectiveAt');
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
