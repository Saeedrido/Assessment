import { mediaRepository, toMediaAssetDto, type MediaRepository } from '../repositories/media.repository';
import { getStorageProvider } from '../media/provider.factory';
import { StorageProviderError, type StorageProvider } from '../media/storage-provider';
import { MEDIA_MAX_FILE_SIZE_BYTES } from '../constants/media';
import { ERROR_CODES } from '../constants/error-codes';
import { ConflictError, NotFoundError, ProviderError, UnprocessableEntityError } from '../utils/errors';
import { assertValidObjectId } from '../utils/object-id';
import { buildPaginatedResult, type PaginatedResult } from '../utils/pagination';
import { logger } from '../utils/logger';
import type { MediaAssetDto } from '../types/dto';

export interface UploadMediaInput {
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer };
  uploadedBy: string;
}

/**
 * Coordinates the two-stage storage pipeline:
 *
 *   upload     → client → staging provider (Cloudinary) → database record
 *   promotion  → staging provider → permanent provider (S3) → database update
 *
 * The service owns the sequencing and failure handling; each provider only
 * knows how to talk to its own backend.
 */
export class MediaService {
  constructor(
    private readonly repository: MediaRepository,
    private readonly resolveUploadProvider: () => StorageProvider = () => getStorageProvider('upload'),
    private readonly resolvePromotionProvider: () => StorageProvider = () => getStorageProvider('promotion'),
  ) {}

  async upload(input: UploadMediaInput): Promise<MediaAssetDto> {
    this.assertSize(input.file.size);

    const uploadProvider = this.resolveUploadProvider();
    const stored = await this.callProvider(() =>
      uploadProvider.upload({
        buffer: input.file.buffer,
        filename: input.file.originalname,
        mimeType: input.file.mimetype,
      }),
    );

    const record = await this.repository.create({
      originalFilename: input.file.originalname,
      mimeType: input.file.mimetype,
      sizeBytes: input.file.size,
      source: stored,
      uploadedBy: input.uploadedBy,
    });

    logger.info(
      { mediaId: String(record._id), provider: stored.provider, sizeBytes: input.file.size },
      'Media stored',
    );

    return toMediaAssetDto(record);
  }

  /**
   * Copies a stored asset from the staging provider to permanent storage.
   *
   * Order of operations matters: the destination is written *first*, and the
   * source is only deleted once the copy is confirmed. A failure therefore
   * never leaves the asset without a copy, at worst it leaves the source in
   * place for a retry.
   */
  async promote(mediaId: string): Promise<MediaAssetDto> {
    assertValidObjectId(mediaId, 'media id');

    const asset = await this.repository.findById(mediaId);
    if (!asset) {
      throw new NotFoundError('Media asset not found', ERROR_CODES.MEDIA_NOT_FOUND);
    }

    if (asset.status === 'PROMOTED' && asset.destination) {
      throw new ConflictError(
        'This asset has already been promoted',
        ERROR_CODES.MEDIA_NOT_ELIGIBLE_FOR_PROMOTION,
      );
    }
    if (asset.status === 'FAILED') {
      throw new UnprocessableEntityError(
        'This asset previously failed to promote and cannot be retried automatically',
        ERROR_CODES.MEDIA_NOT_ELIGIBLE_FOR_PROMOTION,
      );
    }

    const sourceProvider = this.providerFor(asset.source.provider);
    const destinationProvider = this.resolvePromotionProvider();

    try {
      const downloaded = await this.callProvider(() => sourceProvider.download(asset.source.assetKey));

      const destination = await this.callProvider(() =>
        destinationProvider.upload({
          buffer: downloaded.buffer,
          filename: asset.originalFilename,
          mimeType: downloaded.mimeType || asset.mimeType,
        }),
      );

      const promoted = await this.repository.markPromoted(mediaId, destination);
      if (!promoted) {
        // Another request promoted or invalidated the asset in the meantime.
        throw new ConflictError(
          'This asset is no longer awaiting promotion',
          ERROR_CODES.MEDIA_NOT_ELIGIBLE_FOR_PROMOTION,
        );
      }

      // Best-effort cleanup of the staging copy; a failure here is not fatal
      // because the asset is already safe in permanent storage.
      await sourceProvider.remove(asset.source.assetKey).catch((error: unknown) => {
        logger.warn({ err: error, mediaId, assetKey: asset.source.assetKey }, 'Staging cleanup failed');
      });

      logger.info({ mediaId, from: asset.source.provider, to: destination.provider }, 'Media promoted');
      return toMediaAssetDto(promoted);
    } catch (error) {
      if (error instanceof ConflictError) throw error;

      await this.repository.markFailed(mediaId).catch(() => undefined);
      throw error;
    }
  }

  async list(pagination: { page: number; pageSize: number }): Promise<PaginatedResult<MediaAssetDto>> {
    const window = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      skip: (pagination.page - 1) * pagination.pageSize,
      limit: pagination.pageSize,
    };

    const { items, total } = await this.repository.list(window);
    return buildPaginatedResult(items.map(toMediaAssetDto), total, window);
  }

  async getById(mediaId: string): Promise<MediaAssetDto> {
    assertValidObjectId(mediaId, 'media id');

    const asset = await this.repository.findById(mediaId);
    if (!asset) {
      throw new NotFoundError('Media asset not found', ERROR_CODES.MEDIA_NOT_FOUND);
    }
    return toMediaAssetDto(asset);
  }

  private assertSize(sizeBytes: number): void {
    if (sizeBytes > MEDIA_MAX_FILE_SIZE_BYTES) {
      throw new UnprocessableEntityError(
        `File exceeds the maximum size of ${MEDIA_MAX_FILE_SIZE_BYTES} bytes`,
        ERROR_CODES.MEDIA_FILE_TOO_LARGE,
      );
    }
  }

  private providerFor(name: MediaAssetDto['source']['provider']): StorageProvider {
    return getStorageProvider(name === 's3' ? 'promotion' : 'upload');
  }

  /** Normalises provider failures into a 502 with a stable error code. */
  private async callProvider<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof StorageProviderError) {
        throw new ProviderError(error.message, ERROR_CODES.MEDIA_PROVIDER_ERROR, 502, error);
      }
      throw error;
    }
  }
}

export const mediaService = new MediaService(mediaRepository);
