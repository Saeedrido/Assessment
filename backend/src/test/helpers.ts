import mongoose from 'mongoose';

/**
 * Helpers shared by the integration tests.
 *
 * The in-memory replica set itself is created in `src/test/setup.ts`, which
 * runs before any application module is imported so that `config/env.ts` picks
 * up the generated `MONGODB_URI`.
 */

/** Removes all documents while leaving indexes in place. */
export async function clearDatabase(): Promise<void> {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

/** Builds a `set -u`-safe env header map for supertest requests. */
export function authHeaders(userId: string): Record<string, string> {
  return { 'x-user-id': userId };
}
