import type { RequestHandler } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { sendCreated, sendSuccess } from '../utils/response';
import { sendPaginated } from '../utils/pagination';
import { contentService } from '../services/content.service';
import { validatedBody, validatedQuery } from '../types/request';
import type { CreateContentBody, ListContentQuery } from '../validators/content.validator';

/**
 * HTTP layer for content. Each handler only translates between HTTP and the
 * service — no business rules and no database calls live here.
 */
export const createContent: RequestHandler = asyncHandler(async (request, response) => {
  const body = validatedBody<CreateContentBody>(request);
  const created = await contentService.create(body, request.user!.id);
  sendCreated(response, created, 'Content created');
});

export const getContentById: RequestHandler = asyncHandler(async (request, response) => {
  const content = await contentService.getById(request.params.id);
  sendSuccess(response, content, 'Content retrieved');
});

export const listContent: RequestHandler = asyncHandler(async (request, response) => {
  const query = validatedQuery<ListContentQuery>(request);
  const result = await contentService.list(query);
  sendPaginated(response, result);
});
