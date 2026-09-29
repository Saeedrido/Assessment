import { basename } from 'path';
import {
  StorageProviderError,
  type DownloadedObject,
  type StorageProvider,
  type StoredObjectReference,
  type UploadRequest,
} from './storage-provider';
import type { MediaProviderName } from '../constants/domain';

/**
 * In-memory stand-in for an object store.
 *
 * State is module-scoped so promotion (write to one provider, read from the
 * other) works within a single process, and so a re-created provider still sees
 * previously "stored" objects — the same contract a real bucket gives.
 *
 * Objects expire so a long-running dev server does not grow without bound.
 */
const objects = new Map<string, StoredObjectRecord>();

const MAX_MOCK_OBJECTS = 50;

interface StoredObjectRecord {
  provider: MediaProviderName;
  buffer: Buffer;
  mimeType: string;
  publicUrl: string;
}

export class MockStorageProvider implements StorageProvider {
  constructor(readonly name: MediaProviderName) {}

  async upload(request: UploadRequest): Promise<StoredObjectReference> {
    const assetKey = buildAssetKey(request.folder, request.filename);
    const publicUrl = `https://mock-storage.local/${this.name}/${assetKey}`;

    pruneIfNeeded();
    objects.set(storageKey(this.name, assetKey), {
      provider: this.name,
      buffer: request.buffer,
      mimeType: request.mimeType,
      publicUrl,
    });

    return { provider: this.name, assetKey, publicUrl, bucketOrContainer: `mock-${this.name}` };
  }

  async download(assetKey: string): Promise<DownloadedObject> {
    const record = objects.get(storageKey(this.name, assetKey));
    if (!record) {
      throw new StorageProviderError(
        `Object "${assetKey}" was not found in the mock ${this.name} store`,
        this.name,
      );
    }
    return { buffer: record.buffer, mimeType: record.mimeType };
  }

  async remove(assetKey: string): Promise<void> {
    objects.delete(storageKey(this.name, assetKey));
  }

  isConfigured(): boolean {
    return true;
  }
}

function buildAssetKey(folder: string | undefined, filename: string): string {
  const safeName = basename(filename).replace(/[^a-zA-Z0-9._-]/g, '-');
  return [folder, `${Date.now()}-${safeName}`].filter(Boolean).join('/');
}

function storageKey(provider: MediaProviderName, assetKey: string): string {
  return `${provider}::${assetKey}`;
}

function pruneIfNeeded(): void {
  if (objects.size < MAX_MOCK_OBJECTS) return;
  const oldestKey = objects.keys().next().value;
  if (oldestKey) objects.delete(oldestKey);
}

/** Test helper: empties the simulated stores. */
export function resetMockStorage(): void {
  objects.clear();
}

/** Convenience for building a reference without performing an upload. */
export function buildMockReference(provider: MediaProviderName, assetKey: string): StoredObjectReference {
  return {
    provider,
    assetKey,
    publicUrl: `https://mock-storage.local/${provider}/${assetKey}`,
    bucketOrContainer: `mock-${provider}`,
  };
}