import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { connectToDatabase } from '../config/database';
import { UserModel } from '../models/user.model';
import { clearDatabase } from '../test/helpers';
import type { Express } from 'express';

const VALID_BODY = {
  title: 'Introduction to tokenised rewards',
  body: 'Tokenised rewards let creators earn whenever their content is processed by the AI pipeline.',
  tags: ['tokens', 'rewards'],
};

let app: Express;
let adminId: string;
let memberId: string;

async function createUser(email: string, role: 'admin' | 'user'): Promise<string> {
  const user = await UserModel.create({ email, displayName: email, role, tokenBalance: 0 });
  return String(user._id);
}

beforeAll(async () => {
  await connectToDatabase();
  await clearDatabase();

  app = createApp();
  adminId = await createUser('admin@test.local', 'admin');
  memberId = await createUser('user@test.local', 'user');
});

describe('POST /content', () => {
  it('creates a content item for an admin', async () => {
    const response = await request(app)
      .post('/api/v1/content')
      .set('x-user-id', adminId)
      .send(VALID_BODY);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Content created',
      data: {
        title: VALID_BODY.title,
        tags: VALID_BODY.tags,
        createdBy: adminId,
      },
    });
    expect(response.body.data.id).toBeTruthy();
  });

  it('rejects a non-admin caller with 403', async () => {
    const response = await request(app)
      .post('/api/v1/content')
      .set('x-user-id', memberId)
      .send({ ...VALID_BODY, title: 'Blocked creation attempt' });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ success: false, errorCode: 'FORBIDDEN_ROLE' });
  });

  it('rejects a body that fails validation with 400 and field details', async () => {
    const response = await request(app)
      .post('/api/v1/content')
      .set('x-user-id', adminId)
      .send({ title: 'no', body: 'too short', tags: 'not-an-array' });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.details)).toBe(true);
    expect(response.body.details.map((issue: { field: string }) => issue.field)).toEqual(
      expect.arrayContaining(['body', 'title', 'tags']),
    );
  });

  it('rejects a duplicate title with 409', async () => {
    const response = await request(app)
      .post('/api/v1/content')
      .set('x-user-id', adminId)
      .send(VALID_BODY);

    expect(response.status).toBe(409);
    expect(response.body.errorCode).toBe('CONTENT_DUPLICATE_TITLE');
  });

  it('normalises and de-duplicates tags', async () => {
    const response = await request(app)
      .post('/api/v1/content')
      .set('x-user-id', adminId)
      .send({ ...VALID_BODY, title: 'Tag normalisation probe', tags: ['AI', 'ai', ' AI '] });

    expect(response.status).toBe(201);
    expect(response.body.data.tags).toEqual(['ai']);
  });
});

describe('GET /content', () => {
  beforeAll(async () => {
    await request(app)
      .post('/api/v1/content')
      .set('x-user-id', adminId)
      .send({
        title: 'Kubernetes scheduling deep dive',
        body: 'A long-form guide to pod scheduling, affinity rules and taint tolerance in clusters.',
        tags: ['devops'],
      })
      .expect(201);
  });

  it('returns paginated results with metadata', async () => {
    const response = await request(app)
      .get('/api/v1/content?page=1&pageSize=1')
      .set('x-user-id', memberId);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta).toMatchObject({ page: 1, pageSize: 1 });
    expect(response.body.meta.totalItems).toBeGreaterThan(1);
    expect(response.body.meta.hasNextPage).toBe(true);
  });

  it('filters by tag', async () => {
    const response = await request(app)
      .get('/api/v1/content?tag=devops')
      .set('x-user-id', memberId);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].tags).toContain('devops');
  });

  it('performs a case-insensitive text search', async () => {
    const response = await request(app)
      .get('/api/v1/content?q=scheduling')
      .set('x-user-id', memberId);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0].title).toContain('Kubernetes');
  });

  it('returns an empty page when nothing matches', async () => {
    const response = await request(app)
      .get('/api/v1/content?tag=does-not-exist')
      .set('x-user-id', memberId);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.totalItems).toBe(0);
  });

  it('rejects an out-of-range pageSize', async () => {
    const response = await request(app)
      .get('/api/v1/content?pageSize=500')
      .set('x-user-id', memberId);

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('VALIDATION_ERROR');
  });
});

describe('GET /content/:id', () => {
  it('returns the content item with its resolved author', async () => {
    const created = await request(app)
      .post('/api/v1/content')
      .set('x-user-id', adminId)
      .send({ ...VALID_BODY, title: 'Detail endpoint probe' });

    const response = await request(app)
      .get(`/api/v1/content/${created.body.data.id}`)
      .set('x-user-id', memberId);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      title: 'Detail endpoint probe',
      createdBy: { email: 'admin@test.local', role: 'admin' },
    });
  });

  it('returns 400 for a malformed id', async () => {
    const response = await request(app).get('/api/v1/content/not-an-id').set('x-user-id', memberId);

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('INVALID_OBJECT_ID');
  });

  it('returns 404 for a well-formed id that does not exist', async () => {
    const response = await request(app)
      .get('/api/v1/content/64b7f1c2a1b2c3d4e5f60718')
      .set('x-user-id', memberId);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      message: 'Content not found',
      errorCode: 'CONTENT_NOT_FOUND',
    });
  });
});

describe('user context', () => {
  it('returns 401 when the identity header is missing', async () => {
    const response = await request(app).get('/api/v1/content');
    expect(response.status).toBe(401);
    expect(response.body.errorCode).toBe('AUTH_USER_CONTEXT_MISSING');
  });

  it('returns 401 when the identity header is malformed', async () => {
    const response = await request(app).get('/api/v1/content').set('x-user-id', 'abc');
    expect(response.status).toBe(401);
    expect(response.body.errorCode).toBe('AUTH_INVALID_HEADER');
  });

  it('returns 401 when the user does not exist', async () => {
    const response = await request(app)
      .get('/api/v1/content')
      .set('x-user-id', '64b7f1c2a1b2c3d4e5f60718');
    expect(response.status).toBe(401);
    expect(response.body.errorCode).toBe('AUTH_USER_NOT_FOUND');
  });
});

describe('user model invariants', () => {
  it('refuses to persist a negative token balance', async () => {
    const user = new UserModel({ email: 'negative@test.local', displayName: 'Neg', role: 'user' });
    user.tokenBalance = -1;

    await expect(user.save()).rejects.toThrow(/tokenBalance/);
  });
});
