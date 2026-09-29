import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

/**
 * Vitest global setup (`setupFiles`).
 *
 * Order matters here: environment variables are assigned *before* any
 * application module is imported, because `config/env.ts` validates
 * `process.env` at import time. The in-memory replica set is therefore started
 * first and its URI is exported for the app config to pick up.
 */
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.AI_PROVIDER = 'mock';
/**
 * Generous relative to the mock latency below: a *successful* run must never be
 * turned into a TIMEOUT by CPU contention on a loaded CI machine. The timeout
 * path itself is exercised by a provider that never resolves, so this value
 * only has to be comfortably larger than the simulated latency.
 */
process.env.AI_TIMEOUT_MS = '1500';
process.env.AI_MOCK_MIN_LATENCY_MS = '5';
process.env.AI_MOCK_MAX_LATENCY_MS = '40';
process.env.AI_SUCCESS_REWARD = '5';
process.env.SEED_USER_TOKEN_BALANCE = '0';
process.env.AUTH_DEV_ENABLED = 'true';
process.env.RATE_LIMIT_MAX = '0';

/**
 * A replica set is required rather than a standalone server: MongoDB
 * transactions are used to keep token balances and ledger entries consistent,
 * and they only work on a replica set.
 */
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: 'wiredTiger' },
});

process.env.MONGODB_URI = replSet.getUri('t-world-test');

afterAll(async () => {
  await mongoose.connection.close();
  await replSet.stop();
});
