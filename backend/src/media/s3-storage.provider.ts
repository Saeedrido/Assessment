import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env } from '../config/env';
import {
  StorageProviderError,
  type DownloadedObject,
  type StorageProvider,
  type StoredObjectReference,
  type UploadRequest,
} from './storage-provider';

/**
 * AWS S3 promotion provider.
 *
 * Supports any S3-compatible endpoint (MinIO, R2, Spaces) through
 * `AWS_S3_ENDPOINT` and `AWS_S3_FORCE_PATH_STYLE`.
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3' as const;
  private client: S3Client | null = null;

  async upload(request: UploadRequest): Promise<StoredObjectReference> {
    const key = buildObjectKey(request.folder, request.filename);
    const bucket = this.requireBucket();

    try {
      await this.getClient().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: request.buffer,
          ContentType: request.mimeType,
          // Assets are served through a CDN in production; keep them public here
          // so `publicUrl` is directly usable.
          ACL: 'public-read',
        }),
      );

      return { provider: this.name, assetKey: key, publicUrl: this.publicUrlFor(key), bucketOrContainer: bucket };
    } catch (error) {
      throw new StorageProviderError('S3 upload failed', this.name, { cause: error });
    }
  }

  async download(assetKey: string): Promise<DownloadedObject> {
    try {
      const response = await this.getClient().send(
        new GetObjectCommand({ Bucket: this.requireBucket(), Key: assetKey }),
      );

      return {
        buffer: Buffer.from(await response.Body!.transformToByteArray()),
        mimeType: response.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      throw new StorageProviderError(`Could not download "${assetKey}" from S3`, this.name, {
        cause: error,
      });
    }
  }

  async remove(assetKey: string): Promise<void> {
    try {
      await this.getClient().send(
        new DeleteObjectCommand({ Bucket: this.requireBucket(), Key: assetKey }),
      );
    } catch (error) {
      throw new StorageProviderError(`Could not delete "${assetKey}" from S3`, this.name, {
        cause: error,
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(env.awsS3Bucket);
  }

  publicUrlFor(assetKey: string): string {
    const bucket = this.requireBucket();

    if (env.awsS3Endpoint) {
      const base = env.awsS3Endpoint.replace(/\/$/, '');
      return env.awsS3ForcePathStyle
        ? `${base}/${bucket}/${assetKey}`
        : `${base.replace('://', '://')}${bucket}.${hostOf(env.awsS3Endpoint)}/${assetKey}`;
    }

    return `https://${bucket}.s3.${env.awsRegion}.amazonaws.com/${assetKey}`;
  }

  private requireBucket(): string {
    if (!env.awsS3Bucket) {
      throw new StorageProviderError(
        'S3 is selected but AWS_S3_BUCKET is not set',
        this.name,
      );
    }
    return env.awsS3Bucket;
  }

  /** The client is built lazily so the API boots without AWS credentials. */
  private getClient(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: env.awsRegion,
        ...(env.awsAccessKeyId && env.awsSecretAccessKey
          ? { credentials: { accessKeyId: env.awsAccessKeyId, secretAccessKey: env.awsSecretAccessKey } }
          : {}),
        ...(env.awsS3Endpoint ? { endpoint: env.awsS3Endpoint } : {}),
        forcePathStyle: env.awsS3ForcePathStyle,
      });
    }
    return this.client;
  }
}

function buildObjectKey(folder: string | undefined, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  return [folder, `${Date.now()}-${safeName}`].filter(Boolean).join('/');
}

function hostOf(endpoint: string): string {
  return endpoint.replace(/^https?:\/\//, '').split('/')[0];
}
