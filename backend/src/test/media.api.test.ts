import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app';
import { connectToDatabase } from '../config/database';
import { UserModel } from '../models/user.model';
import { MediaAssetModel } from '../models/media-asset.model';
import { resetMockStorage, MockStorageProvider } from '../media/mock-storage.provider';
import { setStorageProvider } from '../media/provider.factory';
import { StorageProviderError, type StorageProvider } from '../media/storage-provider';
import { clearDatabase } from '../test/helpers';

let app: Express;
let adminId: string;
let memberId: string;

/** 1x1 transparent PNG — the smallest valid file for upload tests. */
const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

beforeAll(async () => {
  await connectToDatabase();
  await clearDatabase();
  app = createApp();

  const admin = await UserModel.create({
    email: 'media-admin@test.local',
    displayName: 'Media Admin',
    role: 'admin',
    tokenBalance: 0,
  });
  const member = await UserModel.create({
    email: 'media-user@test.local',
    displayName: 'Media User',
    role: 'user',
    tokenBalance: 0,
  });

  adminId = String(admin._id);
  memberId = String(member._id);
});

afterEach(() => {
  setStorageProvider('mock', null);
  resetMockStorage();
});

async function uploadFile(userId: string): Promise<string> {
  const response = await request(app)
    .post('/api/v1/media/upload')
    .set('x-user-id', userId)
    .attach('file', PNG_FIXTURE, { filename: 'logo.png', contentType: 'image/png' });

  expect(response.status).toBe(201);
  return response.body.data.id;
}

describe('POST /media/upload', () => {
  it('stores an uploaded file and records its metadata', async () => {
    const response = await request(app)
      .post('/api/v1/media/upload')
      .set('x-user-id', adminId)
      .attach('file', PNG_FIXTURE, { filename: 'logo.png', contentType: 'image/png' });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      originalFilename: 'logo.png',
      mimeType: 'image/png',
      sizeBytes: PNG_FIXTURE.length,
      status: 'STORED',
      uploadedBy: adminId,
      promotedAt: null,
    });
    expect(response.body.data.source.provider).toBe('mock');
    expect(response.body.data.source.assetKey).toBeTruthy();
    expect(response.body.data.source.publicUrl).toContain('logo.png');
    expect(response.body.data.destination).toBeNull();
  });

  it('rejects a non-admin caller', async () => {
    const response = await request(app)
      .post('/api/v1/media/upload')
      .set('x-user-id', memberId)
      .attach('file', PNG_FIXTURE, { filename: 'logo.png', contentType: 'image/png' });

    expect(response.status).toBe(403);
    expect(response.body.errorCode).toBe('FORBIDDEN_ROLE');
  });

  it('rejects an unsupported mime type', async () => {
    const response = await request(app)
      .post('/api/v1/media/upload')
      .set('x-user-id', adminId)
      .attach('file', Buffer.from('#!/bin/sh\nrm -rf /'), {
        filename: 'evil.sh',
        contentType: 'application/x-sh',
      });

    expect(response.status).toBe(422);
    expect(response.body.errorCode).toBe('MEDIA_UNSUPPORTED_FILE_TYPE');
  });

  it('rejects a request with no file', async () => {
    const response = await request(app).post('/api/v1/media/upload').set('x-user-id', adminId);

    expect(response.status).toBe(422);
    expect(response.body.errorCode).toBe('MEDIA_MISSING_FILE');
  });

  it('surfaces a provider failure as 502', async () => {
    const brokenProvider: StorageProvider = {
      name: 'mock',
      isConfigured: () => true,
      upload: async () => {
        throw new StorageProviderError('staging bucket unavailable', 'mock');
      },
      download: async () => ({ buffer: Buffer.alloc(0), mimeType: 'image/png' }),
      remove: async () => undefined,
    };
    setStorageProvider('mock', brokenProvider);

    const response = await request(app)
      .post('/api/v1/media/upload')
      .set('x-user-id', adminId)
      .attach('file', PNG_FIXTURE, { filename: 'logo.png', contentType: 'image/png' });

    expect(response.status).toBe(502);
    expect(response.body.errorCode).toBe('MEDIA_PROVIDER_ERROR');
  });
});

describe('POST /media/:id/promote', () => {
  it('copies the asset to permanent storage and updates the record', async () => {
    const mediaId = await uploadFile(adminId);

    const response = await request(app)
      .post(`/api/v1/media/${mediaId}/promote`)
      .set('x-user-id', adminId);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: 'PROMOTED', id: mediaId });
    expect(response.body.data.destination).toMatchObject({ provider: 'mock' });
    expect(response.body.data.promotedAt).toBeTruthy();

    // The record must keep pointing at the staging copy as well, for audit.
    expect(response.body.data.source.provider).toBe('mock');
  });

  it('promotes the exact bytes that were uploaded', async () => {
    const mediaId = await uploadFile(adminId);
    await request(app).post(`/api/v1/media/${mediaId}/promote`).set('x-user-id', adminId).expect(200);

    const record = await MediaAssetModel.findById(mediaId).lean();
    const destination = new MockStorageProvider('mock');
    const downloaded = await destination.download(record!.destination!.assetKey);

    expect(downloaded.buffer.equals(PNG_FIXTURE)).toBe(true);
    expect(downloaded.mimeType).toBe('image/png');
  });

  it('refuses to promote the same asset twice', async () => {
    const mediaId = await uploadFile(adminId);
    await request(app).post(`/api/v1/media/${mediaId}/promote`).set('x-user-id', adminId).expect(200);

    const second = await request(app)
      .post(`/api/v1/media/${mediaId}/promote`)
      .set('x-user-id', adminId);

    expect(second.status).toBe(409);
    expect(second.body.errorCode).toBe('MEDIA_NOT_ELIGIBLE_FOR_PROMOTION');
  });

  it('returns 404 for an unknown media id', async () => {
    const response = await request(app)
      .post('/api/v1/media/64b7f1c2a1b2c3d4e5f60718/promote')
      .set('x-user-id', adminId);

    expect(response.status).toBe(404);
    expect(response.body.errorCode).toBe('MEDIA_NOT_FOUND');
  });

  it('marks the asset FAILED and keeps the staged copy when promotion fails', async () => {
    const mediaId = await uploadFile(adminId);

    const brokenPromotion: StorageProvider = {
      name: 's3',
      isConfigured: () => true,
      upload: async () => {
        throw new StorageProviderError('destination bucket unavailable', 's3');
      },
      download: async () => ({ buffer: Buffer.alloc(0), mimeType: 'image/png' }),
      remove: async () => undefined,
    };
    setStorageProvider('mock', brokenPromotion);

    const response = await request(app)
      .post(`/api/v1/media/${mediaId}/promote`)
      .set('x-user-id', adminId);

    expect(response.status).toBe(502);
    expect(response.body.errorCode).toBe('MEDIA_PROVIDER_ERROR');

    const record = await MediaAssetModel.findById(mediaId).lean();
    expect(record!.status).toBe('FAILED');
    expect(record!.destination).toBeNull();
  });

  it('requires admin rights to promote', async () => {
    const mediaId = await uploadFile(adminId);

    const response = await request(app)
      .post(`/api/v1/media/${mediaId}/promote`)
      .set('x-user-id', memberId);

    expect(response.status).toBe(403);
  });
});

describe('GET /media', () => {
  it('lists stored assets with pagination metadata', async () => {
    await uploadFile(adminId);

    const response = await request(app).get('/api/v1/media?pageSize=50').set('x-user-id', memberId);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.meta.pageSize).toBe(50);
  });

  it('returns a single asset by id', async () => {
    const mediaId = await uploadFile(adminId);

    const response = await request(app).get(`/api/v1/media/${mediaId}`).set('x-user-id', memberId);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(mediaId);
  });

  it('returns 400 for a malformed id', async () => {
    const response = await request(app).get('/api/v1/media/nope').set('x-user-id', memberId);
    expect(response.status).toBe(400);
  });
});
