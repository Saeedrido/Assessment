import type { MediaProviderName } from '../constants/domain';

export interface UploadRequest {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  /** Namespace within the provider, e.g. a Cloudinary folder. */
  folder?: string;
}

export interface StoredObjectReference {
  provider: MediaProviderName;
  /** Provider-native handle: a Cloudinary `public_id`, or an S3 object key. */
  assetKey: string;
  publicUrl: string;
  bucketOrContainer?: string;
}

export interface DownloadedObject {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Storage abstraction.
 *
 * `MediaService` depends on this interface only — no Cloudinary or AWS SDK
 * call appears outside the provider implementations. That is what makes the
 * "upload to Cloudinary, promote to S3" flow swappable (and testable with the
 * mock implementations) without touching business logic.
 */
export interface StorageProvider {
  readonly name: MediaProviderName;

  upload(request: UploadRequest): Promise<StoredObjectReference>;

  /** Reads an object back, which is what promotion uses to copy it. */
  download(assetKey: string): Promise<DownloadedObject>;

  remove(assetKey: string): Promise<void>;

  /** True when the provider has everything it needs to operate. */
  isConfigured(): boolean;
}

/** Raised when a provider cannot complete an operation. */
export class StorageProviderError extends Error {
  constructor(
    message: string,
    public readonly providerName: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'StorageProviderError';
  }
}
