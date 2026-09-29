import { Schema, type Types } from 'mongoose';
import { MEDIA_PROVIDERS, MEDIA_STATUSES, type MediaProviderName, type MediaStatus } from '../constants/domain';
import { defineModel } from './model-registry';

export interface StoredAssetReference {
  provider: MediaProviderName;
  /** Provider-native handle: Cloudinary `public_id`, S3 object key. */
  assetKey: string;
  publicUrl: string;
  bucketOrContainer?: string;
}

export interface MediaAsset {
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  /** Where the file currently lives. */
  source: StoredAssetReference;
  /** Populated after promotion to permanent storage. */
  destination?: StoredAssetReference;
  status: MediaStatus;
  uploadedBy: Types.ObjectId;
  promotedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const storedAssetReferenceSchema = new Schema<StoredAssetReference>(
  {
    provider: { type: String, required: true, enum: MEDIA_PROVIDERS },
    assetKey: { type: String, required: true },
    publicUrl: { type: String, required: true },
    bucketOrContainer: { type: String, required: false },
  },
  { _id: false, versionKey: false },
);

const mediaAssetSchema = new Schema<MediaAsset>(
  {
    originalFilename: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 1 },
    source: { type: storedAssetReferenceSchema, required: true },
    destination: { type: storedAssetReferenceSchema, required: false, default: null },
    status: { type: String, required: true, enum: MEDIA_STATUSES, default: 'STORED' },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    promotedAt: { type: Date, required: false, default: null },
  },
  { timestamps: true, versionKey: false, collection: 'media_assets' },
);

/**
 * Indexes:
 * 1. `{ status: 1, createdAt: -1 }` → the media list, newest first.
 * 2. `{ uploadedBy: 1, createdAt: -1 }` → assets uploaded by one user.
 * 3. `{ 'source.assetKey': 1 }` → look-up during promotion/cleanup.
 */
mediaAssetSchema.index({ status: 1, createdAt: -1 });
mediaAssetSchema.index({ uploadedBy: 1, createdAt: -1 });
mediaAssetSchema.index({ 'source.assetKey': 1 });

export const MediaAssetModel = defineModel<MediaAsset>('MediaAsset', mediaAssetSchema);
