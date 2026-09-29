import mongoose, { type ClientSession } from 'mongoose';
import { supportsTransactions } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Runs `work` inside a MongoDB transaction.
 *
 * Transactions require a replica set (including a single-node one) or Atlas.
 * When the deployment cannot support them the work still runs — with a warning
 * — so the API remains usable against a plain `mongod`, at the cost of losing
 * atomicity across the writes. See the README, "Database transactions".
 */
export async function withDatabaseTransaction<T>(
  work: (session?: ClientSession) => Promise<T>,
): Promise<T> {
  if (!supportsTransactions()) {
    logger.warn(
      'MongoDB deployment does not report replica-set support; running without a transaction',
    );
    return work(undefined);
  }

  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

/** Narrows an optional session for repositories that accept one. */
export type SessionOption = { session?: ClientSession };
