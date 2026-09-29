import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware';
import { requireAdmin } from '../middlewares/require-role.middleware';
import { handleMediaUploadErrors, mediaUpload } from '../middlewares/media-upload.middleware';
import { getMedia, listMedia, promoteMedia, uploadMedia } from '../controllers/media.controller';
import { mediaIdParamSchema, mediaPaginationQuerySchema } from '../validators/media.validator';

export const mediaRouter = Router();

/**
 * POST /media/upload — multipart upload to the staging provider.
 * Admin only, since media management is an operational task.
 */
mediaRouter.post(
  '/upload',
  requireAdmin,
  mediaUpload.single('file'),
  handleMediaUploadErrors,
  uploadMedia,
);

/** GET /media — list stored assets, newest first. */
mediaRouter.get('/', validate({ query: mediaPaginationQuerySchema }), listMedia);

/** POST /media/:id/promote — copy from staging into permanent storage. */
mediaRouter.post(
  '/:id/promote',
  requireAdmin,
  validate({ params: mediaIdParamSchema }),
  handleMediaUploadErrors,
  promoteMedia,
);

/** GET /media/:id */
mediaRouter.get('/:id', validate({ params: mediaIdParamSchema }), getMedia);
