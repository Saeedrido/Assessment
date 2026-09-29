import type { RequestHandler } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { sendCreated, sendSuccess } from '../utils/response';
import { sendPaginated } from '../utils/pagination';
import { mediaService } from '../services/media.service';
import { validatedQuery } from '../types/request';
import { ERROR_CODES } from '../constants/error-codes';
import { UnprocessableEntityError } from '../utils/errors';
import type { MediaPaginationQuery } from '../validators/media.validator';

/** HTTP layer for media: parse the call, delegate to the service, shape the reply. */
export const uploadMedia: RequestHandler = asyncHandler(async (request, response) => {
  if (!request.file) {
    throw new UnprocessableEntityError(
      'No file was uploaded. Send one file in the "file" field.',
      ERROR_CODES.MEDIA_MISSING_FILE,
    );
  }

  const uploaded = await mediaService.upload({ file: request.file, uploadedBy: request.user!.id });
  sendCreated(response, uploaded, 'Media uploaded');
});

export const promoteMedia: RequestHandler = asyncHandler(async (request, response) => {
  const promoted = await mediaService.promote(request.params.id);
  sendSuccess(response, promoted, 'Media promoted');
});

export const getMedia: RequestHandler = asyncHandler(async (request, response) => {
  const asset = await mediaService.getById(request.params.id);
  sendSuccess(response, asset, 'Media asset retrieved');
});

export const listMedia: RequestHandler = asyncHandler(async (request, response) => {
  const query = validatedQuery<MediaPaginationQuery>(request);
  const result = await mediaService.list({ page: query.page, pageSize: query.pageSize });
  sendPaginated(response, result);
});
