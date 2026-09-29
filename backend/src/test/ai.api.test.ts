import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app';
import { connectToDatabase } from '../config/database';
import { UserModel } from '../models/user.model';
import { AiRunModel } from '../models/ai-run.model';
import { TokenTransactionModel } from '../models/token-transaction.model';
import { setAiProvider } from '../ai/provider.factory';
import type { AIProvider } from '../ai/ai-provider';
import { AI_REQUEST_COST, AI_SUCCESS_REWARD } from '../constants/token';
import { sleep } from '../utils/timeout';
import { clearDatabase } from '../test/helpers';

let app: Express;
let userId: string;
let contentId: string;

const ARTICLE = {
  title: 'How token rewards incentivise content',
  body:
    'Token rewards tie creator compensation to measurable activity. Each successful AI run credits the creator. ' +
    'Because every credit is written to an append-only ledger, balances can always be reconciled. ' +
    'Creators can convert accrued tokens into mock on-chain assets when they are ready to cash out.',
};

/** A provider that never resolves, to exercise the timeout path. */
const hangingProvider: AIProvider = {
  name: 'hailing',
  summarize: () => new Promise(() => {}),
};

/** A provider that fails immediately, to exercise the error path. */
const failingProvider: AIProvider = {
  name: 'broken',
  summarize: async () => {
    throw new Error('upstream exploded');
  },
};

const instantProvider: AIProvider = {
  name: 'instant',
  summarize: async () => ({ output: 'A fast deterministic summary.', model: 'instant-v1' }),
};

beforeAll(async () => {
  await connectToDatabase();
  await clearDatabase();
  app = createApp();

  const admin = await UserModel.create({
    email: 'ai-admin@test.local',
    displayName: 'AI Admin',
    role: 'admin',
    tokenBalance: 0,
  });
  const user = await UserModel.create({
    email: 'ai-user@test.local',
    displayName: 'AI User',
    role: 'user',
    // Funded because summaries cost `AI_REQUEST_COST`; the "insufficient
    // balance" cases below create a separate, deliberately empty account.
    tokenBalance: 1_000,
  });

  userId = String(user._id);

  const created = await request(app)
    .post('/api/v1/content')
    .set('x-user-id', String(admin._id))
    .send(ARTICLE);
  contentId = created.body.data.id;
});

afterEach(() => {
  setAiProvider(null);
});

describe('POST /content/:id/ai/summarize', () => {
  it('summarises, records the run and awards the reward', async () => {
    setAiProvider(instantProvider);

    const balanceBefore = (await UserModel.findById(userId).lean())!.tokenBalance;

    const response = await request(app)
      .post(`/api/v1/content/${contentId}/ai/summarize`)
      .set('x-user-id', userId)
      .send({ tone: 'friendly', length: 'short' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      output: 'A fast deterministic summary.',
      tokensAwarded: AI_SUCCESS_REWARD,
      // Reported *after* both the charge and the reward have been applied.
      totalTokenBalance: balanceBefore - AI_REQUEST_COST + AI_SUCCESS_REWARD,
    });
    expect(response.body.data.latencyMs).toBeGreaterThanOrEqual(0);
    expect(response.body.data.run).toMatchObject({
      status: 'SUCCESS',
      provider: 'instant',
      promptVersion: 'v1',
      tone: 'friendly',
      length: 'short',
      tokensAwarded: AI_SUCCESS_REWARD,
    });
  });

  it('charges the request cost, then credits the reward, and records both ledger entries', async () => {
    setAiProvider(instantProvider);

    const before = (await UserModel.findById(userId).lean())!.tokenBalance;

    const response = await request(app)
      .post(`/api/v1/content/${contentId}/ai/summarize`)
      .set('x-user-id', userId)
      .send({ tone: 'neutral', length: 'medium' });

    const after = (await UserModel.findById(userId).lean())!.tokenBalance;
    expect(after).toBe(before - AI_REQUEST_COST + AI_SUCCESS_REWARD);
    expect(response.body.data.totalTokenBalance).toBe(after);

    const earn = await TokenTransactionModel.findOne({ type: 'EARN' }).sort({ createdAt: -1 }).lean();
    expect(earn).toMatchObject({
      amount: AI_SUCCESS_REWARD,
      source: 'AI_USAGE',
      referenceType: 'AI_RUN',
      balanceAfter: after,
    });
    expect(earn!.referenceId).toBe(response.body.data.run.id);
    expect(earn!.balanceBefore).toBe(before - AI_REQUEST_COST);

    // The cost itself is a SPEND entry, charged before the provider ran.
    const spend = await TokenTransactionModel.findOne({ type: 'SPEND' })
      .sort({ createdAt: -1 })
      .lean();
    expect(spend).toMatchObject({
      amount: -AI_REQUEST_COST,
      source: 'AI_USAGE',
      referenceType: 'AI_RUN',
      balanceBefore: before,
      balanceAfter: before - AI_REQUEST_COST,
    });
    expect(spend!.referenceId).toBe(response.body.data.run.id);
  });

  it('leaves the balance unchanged overall for a successful run', async () => {
    setAiProvider(instantProvider);
    const before = (await UserModel.findById(userId).lean())!.tokenBalance;

    await request(app)
      .post(`/api/v1/content/${contentId}/ai/summarize`)
      .set('x-user-id', userId)
      .send({ tone: 'neutral', length: 'short' })
      .expect(200);

    // Cost and reward are separate entries, so the chain reconciles exactly.
    expect((await UserModel.findById(userId).lean())!.tokenBalance).toBe(
      before - AI_REQUEST_COST + AI_SUCCESS_REWARD,
    );
  });

  it('awards tokens for every successful run', async () => {
    setAiProvider(instantProvider);
    const before = (await UserModel.findById(userId).lean())!.tokenBalance;

    for (let run = 0; run < 3; run += 1) {
      await request(app)
        .post(`/api/v1/content/${contentId}/ai/summarize`)
        .set('x-user-id', userId)
        .send({ tone: 'neutral', length: 'short' })
        .expect(200);
    }

    expect((await UserModel.findById(userId).lean())!.tokenBalance).toBe(
      before + 3 * (AI_SUCCESS_REWARD - AI_REQUEST_COST),
    );
  });

  it('rejects an unsupported tone with 400', async () => {
    const response = await request(app)
      .post(`/api/v1/content/${contentId}/ai/summarize`)
      .set('x-user-id', userId)
      .send({ tone: 'sarcastic', length: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('rejects an unsupported length with 400', async () => {
    const response = await request(app)
      .post(`/api/v1/content/${contentId}/ai/summarize`)
      .set('x-user-id', userId)
      .send({ tone: 'neutral', length: 'novel' });

    expect(response.status).toBe(400);
  });

  it('returns 404 when the content does not exist', async () => {
    const response = await request(app)
      .post('/api/v1/content/64b7f1c2a1b2c3d4e5f60718/ai/summarize')
      .set('x-user-id', userId)
      .send({ tone: 'neutral', length: 'short' });

    expect(response.status).toBe(404);
    expect(response.body.errorCode).toBe('AI_CONTENT_NOT_FOUND');
  });

  it('records a TIMEOUT run and awards no tokens when the provider hangs', async () => {
    setAiProvider(hangingProvider);

    const balanceBefore = (await UserModel.findById(userId).lean())!.tokenBalance;
    const runsBefore = await AiRunModel.countDocuments({ userId });

    const response = await request(app)
      .post(`/api/v1/content/${contentId}/ai/summarize`)
      .set('x-user-id', userId)
      .send({ tone: 'neutral', length: 'short' });

    expect(response.status).toBe(504);
    expect(response.body).toMatchObject({
      success: false,
      errorCode: 'AI_PROVIDER_TIMEOUT',
    });
    expect(response.body.details.status).toBe('TIMEOUT');
    expect(response.body.details.latencyMs).toBeGreaterThanOrEqual(0);

    // The run must be recorded as a timeout, never as a success.
    expect(await AiRunModel.countDocuments({ userId })).toBe(runsBefore + 1);
    const run = await AiRunModel.findById(response.body.details.runId).lean();
    expect(run).toMatchObject({ status: 'TIMEOUT', tokensAwarded: 0, output: null });

    // The up-front charge is refunded, so a timeout is never billed.
    expect((await UserModel.findById(userId).lean())!.tokenBalance).toBe(balanceBefore);
    const refund = await TokenTransactionModel.findOne({ referenceId: response.body.details.runId })
      .sort({ createdAt: -1 })
      .lean();
    expect(refund).toMatchObject({ type: 'SPEND', amount: AI_REQUEST_COST });
    expect(refund!.note).toContain('refunded');
  });

  it('records a FAILED run and awards no tokens when the provider errors', async () => {
    setAiProvider(failingProvider);

    const balanceBefore = (await UserModel.findById(userId).lean())!.tokenBalance;

    const response = await request(app)
      .post(`/api/v1/content/${contentId}/ai/summarize`)
      .set('x-user-id', userId)
      .send({ tone: 'neutral', length: 'short' });

    expect(response.status).toBe(502);
    expect(response.body.errorCode).toBe('AI_PROVIDER_ERROR');
    expect(response.body.details.status).toBe('FAILED');

    const run = await AiRunModel.findById(response.body.details.runId).lean();
    expect(run).toMatchObject({ status: 'FAILED', tokensAwarded: 0 });
    expect(run!.errorMessage).toBeTruthy();

    // The cost is taken and then returned; the net effect on the balance is nil.
    expect((await UserModel.findById(userId).lean())!.tokenBalance).toBe(balanceBefore);
  });

  it('rejects a request the user cannot afford with 422 and records a failed run', async () => {
    setAiProvider(instantProvider);

    const broke = await UserModel.create({
      email: 'ai-broke@test.local',
      displayName: 'AI Broke',
      role: 'user',
      tokenBalance: 0,
    });

    const response = await request(app)
      .post(`/api/v1/content/${contentId}/ai/summarize`)
      .set('x-user-id', String(broke._id))
      .send({ tone: 'neutral', length: 'short' });

    expect(response.status).toBe(422);
    expect(response.body.errorCode).toBe('TOKENS_INSUFFICIENT_BALANCE');

    // The provider must not be paid for, and the run must not stay PENDING.
    const run = await AiRunModel.findOne({ userId: String(broke._id) }).lean();
    expect(run).toMatchObject({ status: 'FAILED', tokensAwarded: 0, output: null });
    expect(await AiRunModel.countDocuments({ userId: String(broke._id), status: 'PENDING' })).toBe(0);
    expect((await UserModel.findById(broke._id).lean())!.tokenBalance).toBe(0);
    expect(await TokenTransactionModel.countDocuments({ userId: String(broke._id) })).toBe(0);
  });

  it('offers a clearly-labelled fallback output but still reports failure', async () => {
    setAiProvider(failingProvider);

    const response = await request(app)
      .post(`/api/v1/content/${contentId}/ai/summarize`)
      .set('x-user-id', userId)
      .send({ tone: 'neutral', length: 'short' });

    expect(response.status).toBe(502);
    expect(response.body.details.fallbackOutput).toContain('Automatic summary unavailable');
  });
});

describe('GET /content/:id/ai/runs', () => {
  it('returns the run history for the content item', async () => {
    const response = await request(app)
      .get(`/api/v1/content/${contentId}/ai/runs?pageSize=50`)
      .set('x-user-id', userId);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);

    const statuses = new Set(response.body.data.map((run: { status: string }) => run.status));
    expect(statuses.has('SUCCESS')).toBe(true);
    expect(statuses.has('FAILED')).toBe(true);
    expect(statuses.has('TIMEOUT')).toBe(true);
  });

  it('never records tokens on a non-successful run', async () => {
    const response = await request(app)
      .get(`/api/v1/content/${contentId}/ai/runs?pageSize=100`)
      .set('x-user-id', userId);

    const unsuccessful = response.body.data.filter((run: { status: string }) => run.status !== 'SUCCESS');
    expect(unsuccessful.length).toBeGreaterThan(0);
    unsuccessful.forEach((run: { tokensAwarded: number }) => expect(run.tokensAwarded).toBe(0));
  });
});

describe('the default mock provider', () => {
  it('produces a summary derived from the article without credentials', async () => {
    await sleep(10);

    const response = await request(app)
      .post(`/api/v1/content/${contentId}/ai/summarize`)
      .set('x-user-id', userId)
      .send({ tone: 'formal', length: 'short' });

    expect(response.status).toBe(200);
    expect(response.body.data.run.provider).toBe('mock');
    expect(response.body.data.output).toContain('Token rewards');
    expect(response.body.data.latencyMs).toBeGreaterThan(0);
  });
});
