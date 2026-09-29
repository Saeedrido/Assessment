import { z } from 'zod';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/pagination';

export const mediaPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export const mediaIdParamSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

export type MediaPaginationQuery = z.infer<typeof mediaPaginationQuerySchema>;
