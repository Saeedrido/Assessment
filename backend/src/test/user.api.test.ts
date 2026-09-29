import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { Wallet } from 'ethers';
import { createApp } from '../app';
import { connectToDatabase, disconnectFromDatabase } from '../config/database';
import { UserModel } from '../models/user.model';
import { runSeed } from '../scripts/seed';
import { clearDatabase } from '../test/helpers';

let app: Express;
let adminId: string;
let memberId: string;

beforeAll(async () => {
  await connectToDatabase();
  await clearDatabase();
  app = createApp();

  const admin = await UserModel.create({
    email: 'admin@test.local',
    displayName: 'Root Admin',
    role: 'admin',
    tokenBalance: 900,
  });
  const member = await UserModel.create({
    email: 'member@test.local',
    displayName: 'Team Member',
    role: 'user',
    tokenBalance: 42,
  });

  adminId = String(admin._id);
  memberId = String(member._id);
});

afterAll(async () => {
  await disconnectFromDatabase();
});

describe('GET /users/me', () => {
  it('returns the caller profile with a live balance', async () => {
    const response = await request(app).get('/api/v1/users/me').set('x-user-id', memberId);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: memberId,
      email: 'member@test.local',
      role: 'user',
      tokenBalance: 42,
    });
  });

  it('returns 401 without a user context header', async () => {
    const response = await request(app).get('/api/v1/users/me');
    expect(response.status).toBe(401);
  });
});

describe('GET /users', () => {
  it('lists users for an admin caller', async () => {
    const response = await request(app).get('/api/v1/users').set('x-user-id', adminId);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta.totalItems).toBe(2);
  });

  it('refuses a non-admin caller', async () => {
    const response = await request(app).get('/api/v1/users').set('x-user-id', memberId);

    expect(response.status).toBe(403);
    expect(response.body.errorCode).toBe('FORBIDDEN_ROLE');
  });

  it('filters by role', async () => {
    const response = await request(app).get('/api/v1/users?role=admin').set('x-user-id', adminId);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].role).toBe('admin');
  });

  it('searches by display name and escapes regex metacharacters', async () => {
    const match = await request(app).get('/api/v1/users?q=Member').set('x-user-id', adminId);
    expect(match.status).toBe(200);
    expect(match.body.data).toHaveLength(1);

    // A regex metacharacter must be matched literally, not interpreted.
    const literal = await request(app).get('/api/v1/users?q=.*').set('x-user-id', adminId);
    expect(literal.status).toBe(200);
    expect(literal.body.data).toHaveLength(0);
  });
});

describe('GET /users/:id', () => {
  it('returns a single user for an admin caller', async () => {
    const response = await request(app).get(`/api/v1/users/${memberId}`).set('x-user-id', adminId);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(memberId);
  });

  it('returns 404 for an unknown id', async () => {
    const response = await request(app)
      .get('/api/v1/users/64b7f1c2a1b2c3d4e5f60718')
      .set('x-user-id', adminId);

    expect(response.status).toBe(404);
  });
});

describe('POST /web3/verify-signature', () => {
  it('accepts a signature produced by the expected address', async () => {
    const wallet = Wallet.createRandom();
    const message = 'Sign in to T-World';

    const response = await request(app)
      .post('/api/v1/web3/verify-signature')
      .set('x-user-id', memberId)
      .send({ message, signature: await wallet.signMessage(message), expectedAddress: wallet.address });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ valid: true });
    expect(response.body.data.address.toLowerCase()).toBe(wallet.address.toLowerCase());
  });

  it('reports a mismatch as valid:false rather than an HTTP error', async () => {
    const wallet = Wallet.createRandom();
    const impostor = Wallet.createRandom();
    const message = 'Sign in to T-World';

    const response = await request(app)
      .post('/api/v1/web3/verify-signature')
      .set('x-user-id', memberId)
      .send({ message, signature: await wallet.signMessage(message), expectedAddress: impostor.address });

    expect(response.status).toBe(200);
    expect(response.body.data.valid).toBe(false);
  });

  it('rejects a malformed address with 400', async () => {
    const response = await request(app)
      .post('/api/v1/web3/verify-signature')
      .set('x-user-id', memberId)
      .send({ message: 'hello', signature: '0xdeadbeef', expectedAddress: 'not-an-address' });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('VALIDATION_ERROR');
  });
});

describe('seed script', () => {
  it('is idempotent and preserves existing balances', async () => {
    await clearDatabase();

    await runSeed();
    const afterFirst = await UserModel.find({}).sort({ email: 1 }).lean();
    expect(afterFirst).toHaveLength(3);

    // Change a balance, then re-seed: the balance must survive.
    const ada = afterFirst.find((user) => user.email === 'ada@t-world.local')!;
    await UserModel.updateOne({ _id: ada._id }, { $set: { tokenBalance: 7 } });

    await runSeed();
    const afterSecond = await UserModel.find({}).sort({ email: 1 }).lean();

    expect(afterSecond).toHaveLength(3);
    expect(afterSecond.find((user) => user.email === 'ada@t-world.local')!.tokenBalance).toBe(7);
  });

  it('seeds content exactly once', async () => {
    const first = await request(app)
      .get('/api/v1/content?pageSize=50')
      .set('x-user-id', String((await UserModel.findOne({ email: 'admin@t-world.local' }).lean())!._id));

    expect(first.status).toBe(200);
    expect(first.body.data.length).toBe(3);

    await runSeed();
    const second = await request(app)
      .get('/api/v1/content?pageSize=50')
      .set('x-user-id', String((await UserModel.findOne({ email: 'admin@t-world.local' }).lean())!._id));

    expect(second.body.data.length).toBe(3);
  });
});
