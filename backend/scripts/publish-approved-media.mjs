import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, '..');
const projectDir = path.resolve(backendDir, '..');
const curatedDir = path.join(projectDir, 'private-media', 'phase8-curated');
const manifestPath = path.join(curatedDir, 'manifest.json');

if (!process.argv.includes('--owner-approved')) {
  throw new Error('Refusing publication without --owner-approved.');
}

dotenv.config({ path: path.join(backendDir, '.env'), quiet: true });
const [{ env }, { prisma }] = await Promise.all([
  import('../dist/config/env.js'),
  import('../dist/db/prisma.js'),
]);

const publicCategories = new Set(['Portrait', 'Couple', 'Maternité', 'Corporate', 'Famille', 'Événementiel']);
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

if (!Array.isArray(manifest.items) || manifest.items.length !== 17) {
  throw new Error(`Expected exactly 17 staged images, received ${manifest.items?.length ?? 0}.`);
}

const publicDir = path.join(env.UPLOAD_DIR, 'portfolio');
await fs.mkdir(publicDir, { recursive: true, mode: 0o755 });

const resolveCuratedDerivative = (relativePath) => {
  const resolved = path.resolve(projectDir, relativePath);
  const relative = path.relative(curatedDir, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Derivative is outside the curated directory: ${relativePath}`);
  }
  return resolved;
};

const prepared = [];
for (const [index, item] of manifest.items.entries()) {
  if (!publicCategories.has(item.category)) {
    throw new Error(`Unsupported public category: ${item.category}`);
  }
  if (!Array.isArray(item.derivatives) || item.derivatives.length !== 2) {
    throw new Error(`Expected two derivatives for ${item.source}.`);
  }

  const derivatives = [...item.derivatives].sort((a, b) => a.width - b.width);
  const [thumbnail, primary] = derivatives;
  for (const derivative of derivatives) {
    if (derivative.mimeType !== 'image/webp' || !Number.isInteger(derivative.bytes) || derivative.bytes <= 0) {
      throw new Error(`Invalid derivative metadata for ${derivative.path}.`);
    }
    const sourcePath = resolveCuratedDerivative(derivative.path);
    const stats = await fs.stat(sourcePath);
    if (!stats.isFile() || stats.size !== derivative.bytes) {
      throw new Error(`Derivative verification failed for ${derivative.path}.`);
    }
  }

  const publicName = (derivative) => `owner-approved-${path.basename(derivative.path)}`;
  const thumbnailName = publicName(thumbnail);
  const primaryName = publicName(primary);
  const thumbnailPath = path.join(publicDir, thumbnailName);
  const primaryPath = path.join(publicDir, primaryName);

  await fs.copyFile(resolveCuratedDerivative(thumbnail.path), thumbnailPath, fsConstants.COPYFILE_FICLONE);
  await fs.copyFile(resolveCuratedDerivative(primary.path), primaryPath, fsConstants.COPYFILE_FICLONE);
  await Promise.all([fs.chmod(thumbnailPath, 0o644), fs.chmod(primaryPath, 0o644)]);

  prepared.push({
    title: item.titleDraft,
    altText: item.altDraft,
    category: item.category,
    url: `${env.UPLOAD_PUBLIC_PATH}/portfolio/${primaryName}`,
    thumbnailUrl: `${env.UPLOAD_PUBLIC_PATH}/portfolio/${thumbnailName}`,
    width: primary.width,
    height: primary.height,
    mimeType: primary.mimeType,
    fileSize: primary.bytes,
    thumbnailWidth: thumbnail.width,
    thumbnailHeight: thumbnail.height,
    thumbnailFileSize: thumbnail.bytes,
    isFeatured: false,
    isPublished: true,
    sortOrder: 100 + index,
    source: item.source,
  });
}

const published = await prisma.$transaction(async (tx) => {
  const results = [];
  for (const item of prepared) {
    const existing = await tx.mediaItem.findFirst({ where: { url: item.url } });
    const data = {
      title: item.title,
      altText: item.altText,
      category: item.category,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl,
      width: item.width,
      height: item.height,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
      thumbnailWidth: item.thumbnailWidth,
      thumbnailHeight: item.thumbnailHeight,
      thumbnailFileSize: item.thumbnailFileSize,
      objectPosition: 'center center',
      isFeatured: item.isFeatured,
      isPublished: item.isPublished,
      sortOrder: item.sortOrder,
    };
    const media = existing
      ? await tx.mediaItem.update({ where: { id: existing.id }, data })
      : await tx.mediaItem.create({ data });
    await tx.auditLog.create({
      data: {
        action: existing ? 'media.owner_approval_republish' : 'media.owner_approval_publish',
        entityType: 'MediaItem',
        entityId: media.id,
        metadata: { source: item.source, publicationApproved: true },
      },
    });
    results.push(media);
  }
  return results;
});

const approvedAt = new Date().toISOString();
const approvedManifest = {
  ...manifest,
  publicationApproved: true,
  approvedAt,
  approvalBasis: 'Explicit owner authorization in the production deployment session',
  items: manifest.items.map((item) => ({ ...item, publicationApproved: true })),
};
const manifestTemporaryPath = `${manifestPath}.tmp`;
await fs.writeFile(manifestTemporaryPath, `${JSON.stringify(approvedManifest, null, 2)}\n`, { mode: 0o600 });
await fs.rename(manifestTemporaryPath, manifestPath);

console.log(`Published ${published.length} owner-approved images.`);
await prisma.$disconnect();
