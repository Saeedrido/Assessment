import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

/**
 * MongoDB transactions require a replica set (including a single-node one).
 * The API works without transactions — see `withTransaction` in
 * `services/transaction.service.ts` — but balance + ledger writes are only
 * fully atomic when this is true.
 */
export function supportsTransactions(): boolean {
  return env.mongoUri.includes('replicaSet') || env.mongoUri.includes('mongodb+srv');
}

let connectionPromise: Promise<typeof mongoose> | null = null;

/**
 * Connects to MongoDB. Repeated calls reuse the first connection attempt so
 * concurrent bootstraps (tests, scripts) cannot open duplicate connections.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (connectionPromise) return connectionPromise;

  mongoose.set('strictQuery', true);

  connectionPromise = mongoose
    .connect(env.mongoUri, {
      maxPoolSize: env.mongoMaxPoolSize,
      serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs,
      autoIndex: !env.isProduction,
    })
    .then((instance) => {
      logger.info(
        `MongoDB connected (database="${instance.connection.name}", transactions=${supportsTransactions()})`,
      );
      return instance;
    })
    .catch((error: unknown) => {
      connectionPromise = null;
      throw error;
    });

  return connectionPromise;
}

export async function disconnectFromDatabase(): Promise<void> {
  connectionPromise = null;
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
