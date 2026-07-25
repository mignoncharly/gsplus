import { HttpError } from '../errors/http-error.js';
import { Prisma, type Package } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';

const packageVersionData = (pack: Package, createdById?: string) => ({
  packageId: pack.id,
  version: pack.version,
  name: pack.name,
  category: pack.category,
  description: pack.description,
  price: pack.price,
  currency: pack.currency,
  durationMin: pack.durationMin,
  deliveryLabel: pack.deliveryLabel,
  options: pack.options ?? undefined,
  legalText: pack.legalText,
  legalApprovedAt: pack.legalApprovedAt,
  createdById,
});

export const ensureCurrentPackageVersion = (tx: Prisma.TransactionClient, pack: Package) =>
  tx.packageVersion.upsert({
    where: {
      packageId_version: {
        packageId: pack.id,
        version: pack.version,
      },
    },
    update: {},
    create: packageVersionData(pack),
  });

export type PackageUpdate = {
  slug?: string;
  name?: string;
  category?: string;
  description?: string | null;
  price?: number;
  currency?: string;
  durationMin?: number;
  deliveryLabel?: string | null;
  options?: Prisma.InputJsonValue | null;
  legalText?: string | null;
  legalApprovedAt?: Date | null;
  isPromo?: boolean;
  isRange?: boolean;
  isActive?: boolean;
  isArchived?: boolean;
  sortOrder?: number;
};

export type PackageCreate = Required<Pick<PackageUpdate, 'slug' | 'name' | 'category' | 'price' | 'durationMin'>> &
  PackageUpdate;

const packageCreateData = (input: PackageCreate) => ({
  ...input,
  options: input.options === null ? Prisma.JsonNull : input.options,
  isActive: input.isArchived ? false : input.isActive,
  archivedAt: input.isArchived ? new Date() : null,
});

export const createPackageWithVersion = async (input: PackageCreate, adminUserId?: string) =>
  prisma.$transaction(async (tx) => {
    const existing = await tx.package.findUnique({ where: { slug: input.slug } });
    if (existing) {
      throw new HttpError(409, 'PACKAGE_SLUG_EXISTS', 'A package with this slug already exists.');
    }

    const created = await tx.package.create({ data: packageCreateData(input) });
    await tx.packageVersion.create({ data: packageVersionData(created, adminUserId) });
    return created;
  });

export const duplicatePackageWithVersion = async (
  packageId: string,
  input: { slug?: string; name?: string },
  adminUserId?: string,
) =>
  prisma.$transaction(async (tx) => {
    const source = await tx.package.findUnique({ where: { id: packageId } });
    if (!source) {
      throw new HttpError(404, 'PACKAGE_NOT_FOUND', 'Package not found.');
    }

    let slug = input.slug ?? `${source.slug}-copie`;
    if (!input.slug) {
      let suffix = 2;
      while (await tx.package.findUnique({ where: { slug } })) {
        slug = `${source.slug}-copie-${suffix}`;
        suffix += 1;
      }
    } else if (await tx.package.findUnique({ where: { slug } })) {
      throw new HttpError(409, 'PACKAGE_SLUG_EXISTS', 'A package with this slug already exists.');
    }

    const created = await tx.package.create({
      data: {
        slug,
        name: input.name ?? `${source.name} — copie`,
        category: source.category,
        description: source.description,
        price: source.price,
        currency: source.currency,
        durationMin: source.durationMin,
        deliveryLabel: source.deliveryLabel,
        options: source.options ?? Prisma.JsonNull,
        legalText: source.legalText,
        legalApprovedAt: source.legalApprovedAt,
        isPromo: source.isPromo,
        isRange: source.isRange,
        isActive: false,
        isArchived: false,
        sortOrder: source.sortOrder + 1,
      },
    });
    await tx.packageVersion.create({ data: packageVersionData(created, adminUserId) });
    return created;
  });

export const deleteUnreferencedPackage = async (packageId: string) =>
  prisma.$transaction(async (tx) => {
    const current = await tx.package.findUnique({
      where: { id: packageId },
      include: { _count: { select: { reservations: true, reservationIntents: true } } },
    });
    if (!current) {
      throw new HttpError(404, 'PACKAGE_NOT_FOUND', 'Package not found.');
    }
    if (current._count.reservations > 0 || current._count.reservationIntents > 0) {
      throw new HttpError(409, 'PACKAGE_IN_USE', 'A referenced package cannot be deleted; archive it instead.');
    }

    await tx.package.delete({ where: { id: packageId } });
    return current;
  });

export const updatePackageWithVersion = async (
  packageId: string,
  input: PackageUpdate,
  adminUserId?: string,
) =>
  prisma.$transaction(async (tx) => {
    const current = await tx.package.findUnique({ where: { id: packageId } });

    if (!current) {
      throw new HttpError(404, 'PACKAGE_NOT_FOUND', 'Package not found.');
    }

    const nextVersion = current.version + 1;
    const { options, legalApprovedAt: requestedLegalApprovedAt, ...scalarInput } = input;
    const archivedAt =
      input.isArchived === undefined ? current.archivedAt : input.isArchived ? new Date() : null;
    const legalTextChanged = input.legalText !== undefined && input.legalText !== current.legalText;
    const finalLegalText = input.legalText === undefined ? current.legalText : input.legalText;
    if (requestedLegalApprovedAt && !finalLegalText) {
      throw new HttpError(400, "PACKAGE_LEGAL_TEXT_REQUIRED", "Legal text is required before approval.");
    }
    const legalApprovedAt =
      requestedLegalApprovedAt !== undefined
        ? requestedLegalApprovedAt
        : legalTextChanged
          ? null
          : current.legalApprovedAt;

    const updated = await tx.package.update({
      where: { id: packageId },
      data: {
        ...scalarInput,
        ...(options === undefined
          ? {}
          : { options: options === null ? Prisma.JsonNull : options }),
        legalApprovedAt,
        isActive: input.isArchived === true ? false : input.isActive,
        archivedAt,
        version: nextVersion,
      },
    });

    await tx.packageVersion.create({
      data: packageVersionData(updated, adminUserId),
    });

    return updated;
  });
