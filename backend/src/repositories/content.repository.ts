import type { FilterQuery, Types } from 'mongoose';
import {
  ContentItemModel,
  buildContentFilter,
  buildContentSort,
  type ContentItem,
  type ContentQueryFilters,
  type ContentSort,
} from '../models/content-item.model';
import type { PaginationParams } from '../utils/pagination';
import type { ContentDetailDto, ContentListItemDto } from '../types/dto';

/** A persisted document, as returned by `.lean()`. */
type ContentDocument = ContentItem & { _id: Types.ObjectId };

/** Populated author shape produced by `.populate('createdBy', ...)`. */
type PopulatedAuthor = {
  _id: Types.ObjectId;
  email: string;
  displayName: string;
  role: ContentDetailDto['createdBy']['role'];
};

type ContentDetailDocument = Omit<ContentDocument, 'createdBy'> & {
  createdBy: PopulatedAuthor | null;
};

export interface ContentListResult {
  items: ContentListItemDto[];
  total: number;
}

/**
 * Data access for content items.
 *
 * Performance notes:
 *  - `.lean()` is used throughout: these documents are only serialised, so
 *    hydration and change tracking would be wasted work.
 *  - The list endpoint does **not** populate `createdBy`. Populating per row
 *    costs one extra query per document (an N+1) and the list UI only needs the
 *    author id.
 *  - `countDocuments` runs in parallel with the page query.
 */
export const contentRepository = {
  async create(input: {
    title: string;
    body: string;
    tags: string[];
    createdBy: string;
  }): Promise<ContentListItemDto> {
    const created = await ContentItemModel.create({
      title: input.title,
      body: input.body,
      tags: input.tags,
      createdBy: input.createdBy,
    });

    // Mapped from the document rather than `toJSON()`: the serialiser replaces
    // `_id` with `id`, which the DTO mapper below expects to read.
    return toListItem(created as unknown as ContentDocument);
  },

  async findById(id: string): Promise<ContentDetailDto | null> {
    const document = await ContentItemModel.findById(id)
      .populate('createdBy', 'email displayName role')
      .lean<ContentDetailDocument | null>();

    return document ? toDetail(document) : null;
  },

  async list(
    filters: ContentQueryFilters,
    pagination: PaginationParams,
  ): Promise<ContentListResult> {
    const query: FilterQuery<ContentItem> = buildContentFilter(filters);
    const sort: ContentSort = buildContentSort(Boolean(filters.search));

    const [documents, total] = await Promise.all([
      ContentItemModel.find(query)
        .sort(sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean<ContentDocument[]>(),
      ContentItemModel.countDocuments(query),
    ]);

    return { items: documents.map(toListItem), total };
  },

  async existsByTitle(title: string): Promise<boolean> {
    return Boolean(await ContentItemModel.exists({ title }));
  },

  async count(): Promise<number> {
    return ContentItemModel.countDocuments();
  },
};

export type ContentRepository = typeof contentRepository;

function toListItem(document: ContentDocument): ContentListItemDto {
  return {
    id: String(document._id),
    title: document.title,
    body: document.body,
    tags: document.tags,
    createdBy: String(document.createdBy),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function toDetail(document: ContentDetailDocument): ContentDetailDto {
  const { createdBy, ...rest } = document;
  return {
    ...toListItem(rest as ContentDocument),
    createdBy: createdBy
      ? {
          id: String(createdBy._id),
          email: createdBy.email,
          displayName: createdBy.displayName,
          role: createdBy.role,
        }
      : { id: '', email: '', displayName: 'Unknown author', role: 'user' },
  };
}
