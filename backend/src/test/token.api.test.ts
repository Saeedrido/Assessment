import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app';
import { connectToDatabase } from '../config/database';
import { UserModel } from '../models/user.model';
import { TokenTransactionModel } from '../models/token-transaction.model';
import { ContractConversionModel } from '../models/contract-conversion.model';
import { tokenService } from '../services/token.service';
import { setWeb3Provider } from '../web3/provider.factory';
import { resetMockChain } from '../web3/mock-web3.provider';
import {
  assertSupportedAsset,
  calculateConvertedAmount,
  formatConvertedAmount,
} from '../token/exchange';
import { clearDatabase } from '../test/helpers';

const RICH_USER_BALANCE = 10_000;

let app: Express;
let userId: string;

async function createRichUser(): Promise<string> {
  const user = await UserModel.create({
    email: 'rich@test.local',
    displayName: 'Rich User',
    role: 'user',
    tokenBalance: RICH_USER_BALANCE,
  });
  return String(user._id);
}

beforeAll(async () => {
  await connectToDatabase();
  await clearDatabase();
  app = createApp();
  userId = await createRichUser();
});

afterEach(() => {
  // Reset both the injected provider and the simulated chain so each test starts
  // from a known ledger state.
  setWeb3Provider(null);
  resetMockChain();
});

describe('exchange arithmetic', () => {
  it('converts 100 tokens to 1 MOCK_USDT', () => {
    expect(calculateConvertedAmount('MOCK_USDT', 100)).toBe('1');
    expect(formatConvertedAmount('MOCK_USDT', '1')).toBe('1 MOCK_USDT');
  });

  it('converts 20 000 tokens to 1 MOCK_ETH', () => {
    expect(calculateConvertedAmount('MOCK_ETH', 20_000)).toBe('1');
  });

  it('keeps fractional amounts exact (no floating point drift)', () => {
    // 100 / 20 000 = 0.005, which is not representable in binary floating point.
    expect(calculateConvertedAmount('MOCK_ETH', 100)).toBe('0.005');
  });

  it('rejects an unsupported asset', () => {
    expect(() => assertSupportedAsset('MOCK_BTC')).toThrow(/Unsupported asset/);
  });
});

describe('GET /tokens/balance', () => {
  it('returns the current balance and lifetime totals', async () => {
    const response = await request(app).get('/api/v1/tokens/balance').set('x-user-id', userId);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ balance: RICH_USER_BALANCE, earned: 0, converted: 0 });
  });

  it('requires a user context', async () => {
    const response = await request(app).get('/api/v1/tokens/balance');
    expect(response.status).toBe(401);
  });
});

describe('token rewards (credit)', () => {
  it('awards tokens and writes a matching ledger entry', async () => {
    const result = await tokenService.credit({
      userId,
      amount: 5,
      type: 'EARN',
      source: 'AI_USAGE',
      referenceType: 'AI_RUN',
      referenceId: 'run-1',
    });

    expect(result).toMatchObject({ balanceBefore: RICH_USER_BALANCE, balanceAfter: RICH_USER_BALANCE + 5 });

    const entry = await TokenTransactionModel.findById(result.transactionId).lean();
    expect(entry).toMatchObject({
      amount: 5,
      balanceBefore: RICH_USER_BALANCE,
      balanceAfter: RICH_USER_BALANCE + 5,
      type: 'EARN',
      source: 'AI_USAGE',
      referenceType: 'AI_RUN',
      referenceId: 'run-1',
    });
    expect(String(entry!.userId)).toBe(userId);
  });

  it('keeps the ledger internally consistent across several entries', async () => {
    await tokenService.credit({ userId, amount: 5, type: 'EARN', source: 'AI_USAGE', referenceId: 'run-2' });
    await tokenService.credit({ userId, amount: 5, type: 'EARN', source: 'AI_USAGE', referenceId: 'run-3' });

    const entries = await TokenTransactionModel.find({ userId }).sort({ createdAt: 1 }).lean();
    expect(entries.length).toBeGreaterThan(2);

    // Each entry must continue the running balance of the previous one, and the
    // final entry must agree with the user's stored balance.
    entries.forEach((entry, index) => {
      expect(entry.balanceAfter).toBeGreaterThanOrEqual(0);
      expect(entry.balanceAfter).toBe(entry.balanceBefore + entry.amount);
      if (index > 0) expect(entry.balanceBefore).toBe(entries[index - 1].balanceAfter);
    });

    const user = await UserModel.findById(userId).lean();
    expect(entries[entries.length - 1].balanceAfter).toBe(user!.tokenBalance);
  });

  it('rejects a credit of zero or a negative amount', async () => {
    await expect(
      tokenService.credit({ userId, amount: 0, type: 'EARN', source: 'MANUAL' }),
    ).rejects.toThrow(/positive token amount/);
  });
});

describe('GET /tokens/history', () => {
  it('returns ledger entries newest first with pagination metadata', async () => {
    const response = await request(app)
      .get('/api/v1/tokens/history?page=1&pageSize=10')
      .set('x-user-id', userId);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.meta.page).toBe(1);

    const timestamps = response.body.data.map((entry: { createdAt: string }) =>
      new Date(entry.createdAt).getTime(),
    );
    expect([...timestamps].sort((a: number, b: number) => b - a)).toEqual(timestamps);
  });

  it('filters by transaction type', async () => {
    const response = await request(app).get('/api/v1/tokens/history?type=EARN').set('x-user-id', userId);

    expect(response.status).toBe(200);
    expect(response.body.data.every((entry: { type: string }) => entry.type === 'EARN')).toBe(true);
  });
});

describe('POST /tokens/convert', () => {
  it('converts tokens, debits the ledger and records the conversion', async () => {
    const before = (await tokenService.getBalance(userId)).balance;

    const response = await request(app)
      .post('/api/v1/tokens/convert')
      .set('x-user-id', userId)
      .send({ toAsset: 'MOCK_USDT', amount: 100 });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      convertedAmount: '1 MOCK_USDT',
      totalTokenBalance: before - 100,
    });
    expect(response.body.data.txHashMock).toMatch(/^0x[0-9a-f]{64}$/);

    const ledger = await TokenTransactionModel.findOne({ type: 'CONVERT' }).sort({ createdAt: -1 }).lean();
    expect(ledger?.amount).toBe(-100);
  });

  it('rejects a conversion larger than the balance with 422', async () => {
    const response = await request(app)
      .post('/api/v1/tokens/convert')
      .set('x-user-id', userId)
      .send({ toAsset: 'MOCK_USDT', amount: RICH_USER_BALANCE + RICH_USER_BALANCE });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      success: false,
      errorCode: 'TOKENS_INSUFFICIENT_BALANCE',
    });
  });

  it('leaves the balance and ledger untouched after an insufficient-balance attempt', async () => {
    const balanceBefore = (await tokenService.getBalance(userId)).balance;
    const entryCountBefore = await TokenTransactionModel.countDocuments({ userId });

    await request(app)
      .post('/api/v1/tokens/convert')
      .set('x-user-id', userId)
      .send({ toAsset: 'MOCK_ETH', amount: 999_999 })
      .expect(422);

    const balanceAfter = (await tokenService.getBalance(userId)).balance;
    expect(balanceAfter).toBe(balanceBefore);
    expect(await TokenTransactionModel.countDocuments({ userId })).toBe(entryCountBefore);
  });

  it('rejects an unsupported asset at the validation layer', async () => {
    const response = await request(app)
      .post('/api/v1/tokens/convert')
      .set('x-user-id', userId)
      .send({ toAsset: 'MOCK_BTC', amount: 100 });

    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-positive amount', async () => {
    const response = await request(app)
      .post('/api/v1/tokens/convert')
      .set('x-user-id', userId)
      .send({ toAsset: 'MOCK_USDT', amount: 0 });

    expect(response.status).toBe(400);
  });

  it('never allows the balance to reach a negative value under concurrent debits', async () => {
    const poorUser = await UserModel.create({
      email: 'poor@test.local',
      displayName: 'Poor User',
      role: 'user',
      tokenBalance: 100,
    });
    const poorId = String(poorUser._id);

    // Six concurrent debits of 50 against a balance of 100: exactly two may
    // succeed. This is what the conditional atomic update guarantees.
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        request(app)
          .post('/api/v1/tokens/convert')
          .set('x-user-id', poorId)
          .send({ toAsset: 'MOCK_USDT', amount: 50 }),
      ),
    );

    const succeeded = results.filter((result) => result.status === 200);
    expect(succeeded).toHaveLength(2);

    const finalUser = await UserModel.findById(poorId).lean();
    expect(finalUser!.tokenBalance).toBe(0);
    expect(await ContractConversionModel.countDocuments({ userId: poorId })).toBe(2);
  });
});

describe('POST /tokens/withdraw', () => {
  let conversionId: string;

  beforeAll(async () => {
    const conversion = await request(app)
      .post('/api/v1/tokens/convert')
      .set('x-user-id', userId)
      .send({ toAsset: 'MOCK_USDT', amount: 200 });

    conversionId = conversion.body.data.conversion.id;
  });

  it('completes a withdrawal and marks the conversion as withdrawn', async () => {
    const response = await request(app)
      .post('/api/v1/tokens/withdraw')
      .set('x-user-id', userId)
      .send({ conversionId });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: 'SUCCESS', network: 'Ethereum' });
    expect(response.body.data.txHashMock).toMatch(/^0x[0-9a-f]{64}$/);
    expect(response.body.data.conversion.status).toBe('WITHDRAWN');
    expect(response.body.data.conversion.withdrawnAt).toBeTruthy();
  });

  it('refuses to withdraw the same conversion twice with 409', async () => {
    const response = await request(app)
      .post('/api/v1/tokens/withdraw')
      .set('x-user-id', userId)
      .send({ conversionId });

    expect(response.status).toBe(409);
    expect(response.body.errorCode).toBe('TOKENS_CONVERSION_ALREADY_WITHDRAWN');
  });

  it('records a balance-neutral WITHDRAW marker in the ledger', async () => {
    const entry = await TokenTransactionModel.findOne({ type: 'WITHDRAW' })
      .sort({ createdAt: -1 })
      .lean();

    expect(entry).toMatchObject({
      amount: 0,
      referenceType: 'WITHDRAWAL',
      referenceId: conversionId,
    });
    expect(entry!.balanceBefore).toBe(entry!.balanceAfter);
  });

  it('allows only one of two concurrent withdrawal attempts to succeed', async () => {
    const prepared = await request(app)
      .post('/api/v1/tokens/convert')
      .set('x-user-id', userId)
      .send({ toAsset: 'MOCK_USDT', amount: 100 });

    const id = prepared.body.data.conversion.id;

    const [first, second] = await Promise.all([
      request(app).post('/api/v1/tokens/withdraw').set('x-user-id', userId).send({ conversionId: id }),
      request(app).post('/api/v1/tokens/withdraw').set('x-user-id', userId).send({ conversionId: id }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it('returns 404 for an unknown conversion', async () => {
    const response = await request(app)
      .post('/api/v1/tokens/withdraw')
      .set('x-user-id', userId)
      .send({ conversionId: '64b7f1c2a1b2c3d4e5f60718' });

    expect(response.status).toBe(404);
    expect(response.body.errorCode).toBe('TOKENS_CONVERSION_NOT_FOUND');
  });

  it('does not let one user withdraw another user conversion', async () => {
    const owner = await UserModel.create({
      email: 'owner@test.local',
      displayName: 'Owner',
      role: 'user',
      tokenBalance: 1_000,
    });
    const other = await UserModel.create({
      email: 'other@test.local',
      displayName: 'Other',
      role: 'user',
      tokenBalance: 1_000,
    });

    const conversion = await request(app)
      .post('/api/v1/tokens/convert')
      .set('x-user-id', String(owner._id))
      .send({ toAsset: 'MOCK_USDT', amount: 100 });

    const response = await request(app)
      .post('/api/v1/tokens/withdraw')
      .set('x-user-id', String(other._id))
      .send({ conversionId: conversion.body.data.conversion.id });

    expect(response.status).toBe(404);
  });

  it('releases the withdrawal claim when the contract call fails', async () => {
    const conversion = await request(app)
      .post('/api/v1/tokens/convert')
      .set('x-user-id', userId)
      .send({ toAsset: 'MOCK_USDT', amount: 100 });

    // A provider that fails every withdrawal.
    setWeb3Provider({
      name: 'failing',
      network: 'Ethereum',
      convert: async () => ({ txHash: '0xfail', status: 'SUCCESS' as const, network: 'Ethereum' }),
      withdraw: async () => {
        throw new Error('node unreachable');
      },
      balanceOf: async () => '0',
    });

    const response = await request(app)
      .post('/api/v1/tokens/withdraw')
      .set('x-user-id', userId)
      .send({ conversionId: conversion.body.data.conversion.id });

    expect(response.status).toBe(422);
    expect(response.body.errorCode).toBe('TOKENS_WITHDRAWAL_FAILED');

    const record = await ContractConversionModel.findById(conversion.body.data.conversion.id).lean();
    expect(record!.status).toBe('SUCCESS');

    // After the provider recovers, the same conversion can be withdrawn.
    setWeb3Provider(null);
    const retry = await request(app)
      .post('/api/v1/tokens/withdraw')
      .set('x-user-id', userId)
      .send({ conversionId: conversion.body.data.conversion.id });

    expect(retry.status).toBe(200);
  });
});
