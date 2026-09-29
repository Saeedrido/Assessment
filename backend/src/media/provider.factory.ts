import { env } from '../config/env';
import { logger } from '../utils/logger';
import { MockStorageProvider } from './mock-storage.provider';
import { CloudinaryStorageProvider } from './cloudinary-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { StorageProviderError, type StorageProvider } from './storage-provider';
import type { MediaProviderName } from '../constants/domain';

const providers = new Map<MediaProviderName, StorageProvider>();

/** Returns the storage provider for a role in the pipeline. */
export function getStorageProvider(role: 'upload' | 'promotion'): StorageProvider {
  const name: MediaProviderName = role === 'upload' ? env.mediaUploadProvider : env.mediaPromotionProvider;
  return resolveProvider(name, role);
}

/** Test seam: override a provider implementation. */
export function setStorageProvider(name: MediaProviderName, provider: StorageProvider | null): void {
  if (provider) {
    providers.set(name, provider);
    return;
  }
  providers.delete(name);
}

function resolveProvider(name: MediaProviderName, role: string): StorageProvider {
  const cached = providers.get(name);
  if (cached) return cached;

  const provider = createProvider(name);

  // A misconfigured real provider fails loudly rather than silently pretending
  // to work with the mock — a silent fallback would hide a broken deployment.
  if (!provider.isConfigured()) {
    throw new StorageProviderError(
      `Media ${role} provider "${name}" is selected but not configured. Set its credentials, or choose "mock".`,
      name,
    );
  }

  providers.set(name, provider);
  logger.info(`Storage provider ready (implementation="${name}", role="${role}")`);
  return provider;
}

function createProvider(name: MediaProviderName): StorageProvider {
  switch (name) {
    case 'cloudinary':
      return new CloudinaryStorageProvider();
    case 's3':
      return new S3StorageProvider();
    case 'mock':
      return new MockStorageProvider('mock');
    default: {
      const exhaustive: never = name;
      throw new Error(`Unsupported media provider "${String(exhaustive)}"`);
    }
  }
}
