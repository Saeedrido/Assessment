/**
 * Development-only in-memory MongoDB.
 *
 * The service relies on multi-document transactions, which MongoDB only
 * supports on a replica set — a standalone `mongod` is not enough. This script
 * starts a single-node replica set in memory so the API can be run on a machine
 * with no MongoDB installed.
 *
 * It is a convenience for local development only: the data lives in RAM and is
 * discarded when the process stops. For anything else, point `MONGODB_URI` at a
 * real deployment.
 *
 *   npm run db:memory
 *
 * The script prints the connection string it bound to; copy that value into
 * `backend/.env` as `MONGODB_URI`. A random free port is used on every start.
 *
 * `mongodb-memory-server` is already a dev dependency for the test suite, so
 * this adds no new package.
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: 'wiredTiger' },
});

console.log('In-memory MongoDB replica set is running.');
console.log(`Set this in backend/.env:\n  MONGODB_URI=${replSet.getUri('t-world-dev')}`);
console.log('Data is not persisted. Stop this process to discard everything.');

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await replSet.stop();
  process.exit(0);
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

// Hold the process open; `setInterval` keeps the event loop alive.
setInterval(() => {}, 1 << 30);
