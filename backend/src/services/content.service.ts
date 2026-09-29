import { contentRepository, type ContentRepository } from '../repositories/content.repository';
import { ERROR_CODES } from '../constants/error-codes';
import { ConflictError, NotFoundError } from '../utils/errors';
import { buildPaginatedResult, type PaginatedResult } from '../utils/pagination';
import { assertValidObjectId } from '../utils/object-id';
import type { CreateContentBody, ListContentQuery } from '../validators/content.validator';
import type { ContentDetailDto, ContentListItemDto } from '../types/dto';

/**
 * Content business rules.
 *
 * Controllers stay thin because every failure mode (duplicate title, malformed
 * id, missing record) is decided here and raised as a typed error the central
 * handler already knows how to format.
 */
export class ContentService {
  constructor(private readonly repository: ContentRepository) {}

  async create(body: CreateContentBody, createdBy: string): Promise<ContentListItemDto> {
    if (await this.repository.existsByTitle(body.title)) {
      throw new ConflictError(
        `A content item titled "${body.title}" already exists`,
        ERROR_CODES.CONTENT_DUPLICATE_TITLE,
      );
    }

    return this.repository.create({
      title: body.title,
      body: body.body,
      // De-duplicate tags so `["ai", "AI"]` becomes a single tag.
      tags: [...new Set(body.tags)],
      createdBy,
    });
  }

  async getById(id: string): Promise<ContentDetailDto> {
    assertValidObjectId(id, 'content id');

    const item = await this.repository.findById(id);
    if (!item) {
      throw new NotFoundError('Content not found', ERROR_CODES.CONTENT_NOT_FOUND);
    }

    return item;
  }

  async list(query: ListContentQuery): Promise<PaginatedResult<ContentListItemDto>> {
    const pagination = {
      page: query.page,
      pageSize: query.pageSize,
      skip: (query.page - 1) * query.pageSize,
      limit: query.pageSize,
    };

    const { items, total } = await this.repository.list(
      { tag: query.tag, search: query.q, createdBy: query.createdBy },
      pagination,
    );

    return buildPaginatedResult(items, total, pagination);
  }

  async count(): Promise<number> {
    return this.repository.count();
  }
}

/** Default instance used by the HTTP layer; tests construct their own. */
export const contentService = new ContentService(contentRepository);
