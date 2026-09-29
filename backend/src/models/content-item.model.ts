import { Schema, type FilterQuery, type Types } from 'mongoose';
import { defineModel } from './model-registry';
import type { PaginationParams } from '../utils/pagination';

export interface ContentItem {
  title: string;
  body: string;
  tags: string[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/** Limits applied by the schema so invalid data never reaches the collection. */
export const CONTENT_LIMITS = {
  titleMinLength: 3,
  titleMaxLength: 180,
  bodyMinLength: 20,
  bodyMaxLength: 20_000,
  maxTags: 10,
  maxTagLength: 32,
} as const;

const contentItemSchema = new Schema<ContentItem>(
  {
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
      minlength: CONTENT_LIMITS.titleMinLength,
      maxlength: CONTENT_LIMITS.titleMaxLength,
    },
    body: {
      type: String,
      required: [true, 'body is required'],
      trim: true,
      minlength: CONTENT_LIMITS.bodyMinLength,
      maxlength: CONTENT_LIMITS.bodyMaxLength,
    },
    tags: {
      type: [String],
      default: [],
      validate: [
        {
          validator: (tags: string[]) => tags.length <= CONTENT_LIMITS.maxTags,
          message: `a content item may carry at most ${CONTENT_LIMITS.maxTags} tags`,
        },
        {
          validator: (tags: string[]) =>
            tags.every((tag) => tag.length > 0 && tag.length <= CONTENT_LIMITS.maxTagLength),
          message: `tags must be 1-${CONTENT_LIMITS.maxTagLength} characters long`,
        },
      ],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'content_items' },
);

/**
 * Indexes — every one of these backs a query the API actually issues:
 *
 * 1. `{ tags: 1, createdAt: -1 }`  → `GET /content?tag=x` (filter, then sort).
 *    Field order matches the query shape so MongoDB can stop early.
 * 2. `{ title: 'text', body: 'text', tags: 'text' }` → `GET /content?q=…`.
 *    A text index serves `$text` search with relevance ranking without scanning
 *    the whole collection, unlike a leading-wildcard regex.
 * 3. `{ createdAt: -1 }` → default "newest first" listing.
 * 4. `{ createdBy: 1, createdAt: -1 }` → content created by a single user.
 */
contentItemSchema.index({ tags: 1, createdAt: -1 });
contentItemSchema.index({ title: 'text', body: 'text', tags: 'text' });
contentItemSchema.index({ createdAt: -1 });
contentItemSchema.index({ createdBy: 1, createdAt: -1 });

export interface ContentQueryFilters {
  tag?: string;
  search?: string;
  createdBy?: string;
}

/**
 * Builds the Mongo filter for the list endpoint from validated query params.
 *
 * Free-text search uses `$text` rather than a regex so the
 * `{ title: 'text', body: 'text', tags: 'text' }` index actually serves the
 * query. A regex scan would work on tiny datasets but degrades linearly and
 * cannot be ranked by relevance.
 */
export function buildContentFilter(filters: ContentQueryFilters): FilterQuery<ContentItem> {
  const query: FilterQuery<ContentItem> = {};

  if (filters.tag) query.tags = filters.tag;
  if (filters.createdBy) query.createdBy = filters.createdBy;
  if (filters.search) query.$text = { $search: filters.search.trim() };

  return query;
}

/** Mongoose sort spec; relevance is used when a search term is present. */
export type ContentSort = Record<string, 1 | -1 | { $meta: 'textScore' }>;

/**
 * `score` is only a valid sort key when the query contains `$text`, so the
 * caller must pass `hasSearch` consistent with `buildContentFilter`.
 */
export function buildContentSort(hasSearch: boolean): ContentSort {
  return hasSearch ? { score: { $meta: 'textScore' }, createdAt: -1 } : { createdAt: -1 };
}

export const ContentItemModel = defineModel<ContentItem>('ContentItem', contentItemSchema);

export type ContentPagination = PaginationParams;
