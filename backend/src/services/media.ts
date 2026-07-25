import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp, { type Metadata } from 'sharp';

import { env } from '../config/env.js';
import { HttpError } from '../errors/http-error.js';

const publicPortfolioDir = path.join(env.UPLOAD_DIR, 'portfolio');
const privateMasterDir = path.join(env.PRIVATE_MEDIA_DIR, 'portfolio');
const maximumInputPixels = 40_000_000;

const masterExtension = new Map<string, string>([
  ['jpeg', '.jpg'],
  ['png', '.png'],
  ['webp', '.webp'],
]);

type MediaFileReferences = {
  storagePath?: string | null;
  url?: string | null;
  thumbnailUrl?: string | null;
};

export type ProcessedMediaUpload = {
  storagePath: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  mimeType: string;
  fileSize: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  thumbnailFileSize: number;
};

const publicUrl = (filename: string) => `${env.UPLOAD_PUBLIC_PATH}/portfolio/${filename}`;

const publicStoragePath = (url: string | null | undefined) => {
  if (!url?.startsWith(`${env.UPLOAD_PUBLIC_PATH}/`)) return null;

  const relativeUrl = url.slice(env.UPLOAD_PUBLIC_PATH.length + 1);
  const resolved = path.resolve(env.UPLOAD_DIR, relativeUrl);
  const relativePath = path.relative(path.resolve(env.UPLOAD_DIR), resolved);

  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
  return resolved;
};

const safePrivatePath = (storagePath: string | null | undefined) => {
  if (!storagePath) return null;

  const resolved = path.resolve(storagePath);
  const roots = [path.resolve(env.PRIVATE_MEDIA_DIR), path.resolve(env.UPLOAD_DIR)];
  return roots.some((root) => {
    const relativePath = path.relative(root, resolved);
    return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }) ? resolved : null;
};

const removeFiles = async (paths: Array<string | null | undefined>) => {
  const uniquePaths = [...new Set(paths.filter((value): value is string => Boolean(value)))];
  await Promise.all(uniquePaths.map((filePath) => fs.rm(filePath, { force: true })));
};

export const deleteMediaFiles = async (media: MediaFileReferences) => {
  await removeFiles([
    safePrivatePath(media.storagePath),
    publicStoragePath(media.url),
    publicStoragePath(media.thumbnailUrl),
  ]);
};

export const processUploadedMedia = async (file: Express.Multer.File): Promise<ProcessedMediaUpload> => {
  let metadata: Metadata;

  try {
    metadata = await sharp(file.buffer, {
      animated: false,
      failOn: 'warning',
      limitInputPixels: maximumInputPixels,
    }).metadata();
  } catch {
    throw new HttpError(400, 'INVALID_IMAGE', 'The uploaded file is not a valid supported image.');
  }

  const extension = metadata.format ? masterExtension.get(metadata.format) : undefined;
  if (!extension || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) {
    throw new HttpError(400, 'INVALID_IMAGE', 'The uploaded image format or dimensions are not supported.');
  }

  await Promise.all([
    fs.mkdir(publicPortfolioDir, { recursive: true }),
    fs.mkdir(privateMasterDir, { recursive: true, mode: 0o700 }),
  ]);

  const token = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const masterPath = path.join(privateMasterDir, `${token}${extension}`);
  const thumbnailFilename = `${token}-640.webp`;
  const primaryFilename = `${token}-1600.webp`;
  const thumbnailPath = path.join(publicPortfolioDir, thumbnailFilename);
  const primaryPath = path.join(publicPortfolioDir, primaryFilename);

  await fs.writeFile(masterPath, file.buffer, { flag: 'wx', mode: 0o600 });

  try {
    const [thumbnail, primary] = await Promise.all([
      sharp(file.buffer, { animated: false, limitInputPixels: maximumInputPixels })
        .rotate()
        .resize({ width: 640, withoutEnlargement: true })
        .webp({ quality: 78, effort: 4 })
        .toFile(thumbnailPath),
      sharp(file.buffer, { animated: false, limitInputPixels: maximumInputPixels })
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 84, effort: 4 })
        .toFile(primaryPath),
    ]);

    if (!thumbnail.width || !thumbnail.height || !primary.width || !primary.height) {
      throw new Error('Missing derivative dimensions');
    }

    return {
      storagePath: masterPath,
      url: publicUrl(primaryFilename),
      thumbnailUrl: publicUrl(thumbnailFilename),
      width: primary.width,
      height: primary.height,
      mimeType: 'image/webp',
      fileSize: primary.size,
      thumbnailWidth: thumbnail.width,
      thumbnailHeight: thumbnail.height,
      thumbnailFileSize: thumbnail.size,
    };
  } catch {
    await removeFiles([masterPath, thumbnailPath, primaryPath]);
    throw new HttpError(400, 'IMAGE_PROCESSING_FAILED', 'The uploaded image could not be processed safely.');
  }
};
