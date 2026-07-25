import multer from 'multer';

import { HttpError } from '../errors/http-error.js';

const acceptedUploadTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const MAX_MEDIA_UPLOAD_BYTES = 8 * 1024 * 1024;

export const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_MEDIA_UPLOAD_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!acceptedUploadTypes.has(file.mimetype)) {
      callback(new HttpError(400, 'UNSUPPORTED_MEDIA_TYPE', 'Only JPG, PNG, and WEBP images are accepted.'));
      return;
    }

    callback(null, true);
  },
});
