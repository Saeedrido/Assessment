import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import {
  StorageProviderError,
  type DownloadedObject,
  type StorageProvider,
  type StoredObjectReference,
  type UploadRequest,
} from './storage-provider';

/**
 * Cloudinary staging provider.
 *
 * The SDK is configured lazily, on first use, so the API boots without
 * credentials and only fails if Cloudinary is actually selected *and* used.
 */
export class CloudinaryStorageProvider implements StorageProvider {
  readonly name = 'cloudinary' as const;
  private configured = false;

  private ensureConfigured(): void {
    if (this.configured) return;

    if (!this.isConfigured()) {
      throw new StorageProviderError(
        'Cloudinary is selected but CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are not set',
        this.name,
      );
    }

    cloudinary.config({
      cloud_name: env.cloudinaryCloudName,
      api_key: env.cloudinaryApiKey,
      api_secret: env.cloudinaryApiSecret,
      secure: true,
    });
    this.configured = true;
  }

  async upload(request: UploadRequest): Promise<StoredObjectReference> {
    this.ensureConfigured();

    try {
      const result = await this.runUpload(request);
      return {
        provider: this.name,
        assetKey: result.public_id,
        publicUrl: result.secure_url,
        bucketOrContainer: env.cloudinaryCloudName,
      };
    } catch (error) {
      throw new StorageProviderError('Cloudinary upload failed', this.name, { cause: error });
    }
  }

  /** Wraps Cloudinary's callback-based streaming upload in a promise. */
  private runUpload(request: UploadRequest): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: request.folder ?? env.cloudinaryFolder,
          resource_type: resourceTypeFor(request.mimeType),
        },
        (error, uploaded) => {
          if (error) return reject(error);
          if (!uploaded) return reject(new Error('Cloudinary returned an empty response'));
          return resolve(uploaded);
        },
      );

      stream.end(request.buffer);
    });
  }

  async download(assetKey: string): Promise<DownloadedObject> {
    this.ensureConfigured();

    try {
      // Cloudinary has no SDK "get bytes" call for every resource type, so the
      // delivery URL is used for public assets.
      const { publicUrl } = await this.resolve(assetKey);
      const response = await fetch(publicUrl);
      if (!response.ok) {
        throw new Error(`Cloudinary responded with status ${response.status}`);
      }

      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        mimeType: response.headers.get('content-type') ?? 'application/octet-stream',
      };
    } catch (error) {
      throw new StorageProviderError(
        `Could not download "${assetKey}" from Cloudinary`,
        this.name,
        { cause: error },
      );
    }
  }

  async remove(assetKey: string): Promise<void> {
    this.ensureConfigured();

    try {
      await cloudinary.uploader.destroy(assetKey);
    } catch (error) {
      throw new StorageProviderError(`Could not delete "${assetKey}" from Cloudinary`, this.name, {
        cause: error,
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);
  }

  private async resolve(assetKey: string): Promise<{ publicUrl: string }> {
    const metadata = await cloudinary.api.resource(assetKey, { resource_type: 'auto' });
    return { publicUrl: metadata.secure_url };
  }
}

/** Cloudinary models uploads and videos as different resource types. */
function resourceTypeFor(mimeType: string): 'image' | 'raw' | 'video' {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return 'raw';
}

/** Logs once at boot if Cloudinary was selected without credentials. */
export function warnIfCloudinaryUnconfigured(): void {
  const provider = new CloudinaryStorageProvider();
  if (!provider.isConfigured()) {
    logger.warn(
      'MEDIA_UPLOAD_PROVIDER=cloudinary but Cloudinary credentials are missing; uploads will fail until they are set',
    );
  }
}
