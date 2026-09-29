import { connectToDatabase, disconnectFromDatabase } from '../config/database';
import { userRepository } from '../repositories/user.repository';
import { ContentItemModel } from '../models/content-item.model';
import { logger } from '../utils/logger';
import type { SeedUserInput } from '../repositories/user.repository';

/**
 * Deterministic demo data.
 *
 * Fixed ids keep the README and the Postman collection usable after a fresh
 * seed: the same `x-user-id` header value always resolves to the same account.
 */
const SEED_USERS: SeedUserInput[] = [
  {
    email: 'admin@t-world.local',
    displayName: 'T-World Admin',
    role: 'admin',
    tokenBalance: 1_000,
  },
  {
    email: 'ada@t-world.local',
    displayName: 'Ada Lovelace',
    role: 'user',
    tokenBalance: 500,
  },
  {
    email: 'linus@t-world.local',
    displayName: 'Linus Torvalds',
    role: 'user',
    tokenBalance: 250,
  },
];

const SEED_CONTENT = [
  {
    title: 'Tokenised content on T-World',
    body: 'T-World rewards readers with tokens for consuming and summarising content. Publishing an item is free; AI summaries cost a small number of tokens and pay a reward on success.',
    tags: ['t-world', 'tokens', 'getting-started'],
    authorEmail: 'admin@t-world.local',
  },
  {
    title: 'How the token ledger stays consistent',
    body: 'Every balance change writes a ledger entry inside the same MongoDB transaction as the balance update. Each entry records the balance before and after the change, so the ledger can always be reconciled against the account.',
    tags: ['blockchain', 'tokens', 'architecture'],
    authorEmail: 'ada@t-world.local',
  },
  {
    title: 'From Cloudinary staging to S3 storage',
    body: 'Uploads land in a staging provider so they are available quickly. Promotion copies the asset into permanent object storage and only then removes the staged copy, so a failed promotion never leaves an asset without a home.',
    tags: ['media', 'storage', 'architecture'],
    authorEmail: 'linus@t-world.local',
  },
];

/**
 * Idempotent seed.
 *
 * Safe to run repeatedly: users are upserted without touching existing token
 * balances, and content is only created when a title is missing. Nothing is
 * dropped, so this is safe to point at a shared database.
 */
export async function runSeed(): Promise<void> {
  const userIds = new Map<string, string>();

  for (const seedUser of SEED_USERS) {
    const { user, created } = await userRepository.upsertSeedUser(seedUser);
    userIds.set(seedUser.email, String(user._id));
    logger.info(
      { email: user.email, id: String(user._id), role: user.role, tokenBalance: user.tokenBalance },
      created ? 'Seeded user' : 'User already present',
    );
  }

  for (const item of SEED_CONTENT) {
    const authorId = userIds.get(item.authorEmail);
    if (!authorId) continue;

    if (await ContentItemModel.exists({ title: item.title })) {
      logger.info({ title: item.title }, 'Content already present');
      continue;
    }

    const created = await ContentItemModel.create({
      title: item.title,
      body: item.body,
      tags: item.tags,
      createdBy: authorId,
    });
    logger.info({ title: item.title, id: String(created._id) }, 'Seeded content');
  }

  logger.info('Seed complete. Use these values for the x-user-id header:');
  for (const [email, id] of userIds) {
    logger.info({ header: `x-user-id: ${id}`, email }, 'Seed user id');
  }
}

/** Entry point for `npm run seed`. */
async function main(): Promise<void> {
  await connectToDatabase();
  try {
    await runSeed();
  } finally {
    await disconnectFromDatabase();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    logger.error({ err: error }, 'Seed failed');
    process.exitCode = 1;
  });
}
