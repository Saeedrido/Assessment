import { env } from '../config/env';

/** Media / storage constants. */

export const MEDIA_MAX_FILE_SIZE_BYTES = env.mediaMaxFileSizeBytes;

/** 10 MB in bytes, used for human-readable log/error messages. */
export const MEDIA_MAX_FILE_SIZE_MB = Math.floor(MEDIA_MAX_FILE_SIZE_BYTES / (1024 * 1024));

export const SUPPORTED_UPLOAD_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'video/mp4',
] as const;

export type SupportedUploadMimeType = (typeof SUPPORTED_UPLOAD_MIME_TYPES)[number];
