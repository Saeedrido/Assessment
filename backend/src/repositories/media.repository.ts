import type { Types } from 'mongoose';
import { MediaAssetModel, type MediaAsset, type StoredAssetReference } from '../models/media-asset.model';
import type { PaginationParams } from '../utils/pagination';
import type { MediaAssetDto, StoredAssetReferenceDto } from '../types/dto';

type MediaDocument = MediaAsset & { _id: Types.ObjectId };

export interface CreateMediaInput {
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  source: StoredAssetReference;
  uploadedBy: string;
}

export const mediaRepository = {
  async create(input: CreateMediaInput): Promise<MediaDocument> {
    const created = await MediaAssetModel.create({ ...input, status: 'STORED' });
    // `toObject()` on purpose: `toJSON()` applies the model registry transform,
    // which renames `_id` to `id` and the DTO mapper below needs the raw `_id`.
    return created.toObject() as unknown as MediaDocument;
  },

  async findById(id: string): Promise<MediaDocument | null> {
    return MediaAssetModel.findById(id).lean<MediaDocument>();
  },

  async list(pagination: PaginationParams): Promise<{ items: MediaDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      MediaAssetModel.find()
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean<MediaDocument[]>(),
      MediaAssetModel.countDocuments(),
    ]);

    return { items, total };
  },

  /**
   * Records a successful promotion.
   *
   * The `{ status: 'STORED' }` guard makes promotion idempotent: a second
   * request for the same asset finds nothing to update instead of overwriting
   * the destination reference.
   */
  async markPromoted(
    id: string,
    destination: StoredAssetReference,
  ): Promise<MediaDocument | null> {
    return MediaAssetModel.findOneAndUpdate(
      { _id: id, status: 'STORED' },
      { $set: { destination, status: 'PROMOTED', promotedAt: new Date() } },
      { new: true },
    ).lean<MediaDocument>();
  },

  async markFailed(id: string): Promise<void> {
    await MediaAssetModel.updateOne({ _id: id, status: 'STORED' }, { $set: { status: 'FAILED' } });
  },
};

export type MediaRepository = typeof mediaRepository;

export function toMediaAssetDto(document: MediaDocument): MediaAssetDto {
  return {
    id: String(document._id),
    originalFilename: document.originalFilename,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    source: toAssetReferenceDto(document.source),
    destination: document.destination ? toAssetReferenceDto(document.destination) : null,
    status: document.status,
    uploadedBy: String(document.uploadedBy),
    promotedAt: document.promotedAt ? document.promotedAt.toISOString() : null,
    createdAt: document.createdAt.toISOString(),
  };
}

function toAssetReferenceDto(reference: StoredAssetReference): StoredAssetReferenceDto {
  return {
    provider: reference.provider,
    assetKey: reference.assetKey,
    publicUrl: reference.publicUrl,
    bucketOrContainer: reference.bucketOrContainer,
  };
}
