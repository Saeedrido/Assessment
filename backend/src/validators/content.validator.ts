import { z } from 'zod';
import { CONTENT_LIMITS } from '../models/content-item.model';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/pagination';
import { optionalQuery } from './query';

const idParamSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

/** Normalises `["ai", " AI "]` / `"ai,ai"` into `["ai"]`. */
const tagSchema = z
  .string()
  .trim()
  .min(1)
  .max(CONTENT_LIMITS.maxTagLength)
  .transform((tag) => tag.toLowerCase());

export const createContentBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(CONTENT_LIMITS.titleMinLength, `title must be at least ${CONTENT_LIMITS.titleMinLength} characters`)
    .max(CONTENT_LIMITS.titleMaxLength),
  body: z
    .string()
    .trim()
    .min(CONTENT_LIMITS.bodyMinLength, `body must be at least ${CONTENT_LIMITS.bodyMinLength} characters`)
    .max(CONTENT_LIMITS.bodyMaxLength),
  tags: z
    .array(tagSchema)
    .max(CONTENT_LIMITS.maxTags, `at most ${CONTENT_LIMITS.maxTags} tags are allowed`)
    .optional()
    .default([]),
});

export const listContentQuerySchema = z.object({
  tag: optionalQuery(tagSchema),
  q: optionalQuery(z.string().trim().min(1).max(120)),
  createdBy: optionalQuery(z.string()),
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type CreateContentBody = z.infer<typeof createContentBodySchema>;
export type ListContentQuery = z.infer<typeof listContentQuerySchema>;

export { idParamSchema };
