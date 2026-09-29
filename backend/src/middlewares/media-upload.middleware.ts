import multer from 'multer';
import type { ErrorRequestHandler } from 'express';
import { ERROR_CODES } from '../constants/error-codes';
import { MEDIA_MAX_FILE_SIZE_BYTES, MEDIA_MAX_FILE_SIZE_MB, SUPPORTED_UPLOAD_MIME_TYPES } from '../constants/media';
import { UnprocessableEntityError } from '../utils/errors';

/**
 * Files are held in memory rather than written to disk: the promotion flow
 * streams them straight from one provider to another, so a temp file would be
 * pointless I/O. `MEDIA_MAX_FILE_SIZE_BYTES` keeps the memory cost bounded.
 */
export const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MEDIA_MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (_request, file, callback) => {
    const isAllowed = (SUPPORTED_UPLOAD_MIME_TYPES as readonly string[]).includes(file.mimetype);
    if (!isAllowed) {
      callback(
        new UnprocessableEntityError(
          `Unsupported file type "${file.mimetype}". Allowed: ${SUPPORTED_UPLOAD_MIME_TYPES.join(', ')}`,
          ERROR_CODES.MEDIA_UNSUPPORTED_FILE_TYPE,
        ),
      );
      return;
    }
    callback(null, true);
  },
});

/** Maps multer's own error codes onto the API's error vocabulary. */
export function translateMulterError(error: unknown): unknown {
  if (!(error instanceof multer.MulterError)) return error;

  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return new UnprocessableEntityError(
        `File exceeds the maximum size of ${MEDIA_MAX_FILE_SIZE_MB} MB`,
        ERROR_CODES.MEDIA_FILE_TOO_LARGE,
      );
    case 'LIMIT_UNEXPECTED_FILE':
    case 'LIMIT_FILE_COUNT':
      return new UnprocessableEntityError(
        'Exactly one file must be supplied in the "file" field',
        ERROR_CODES.MEDIA_MISSING_FILE,
      );
    default:
      return new UnprocessableEntityError(error.message, ERROR_CODES.VALIDATION_ERROR);
  }
}

/**
 * Express error middleware for multer failures, so a controller never has to
 * know that file parsing is a third-party concern.
 */
export const handleMediaUploadErrors: ErrorRequestHandler = (error, _request, _response, next) => {
  next(translateMulterError(error));
};
