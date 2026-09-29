import type { ClientSession, FilterQuery, Types } from 'mongoose';
import { UserModel, type User } from '../models/user.model';
import type { PaginationParams } from '../utils/pagination';
import type { UserRole } from '../constants/domain';
import type { UserDto } from '../types/dto';

export interface UserRecord extends User {
  _id: Types.ObjectId;
}

export interface UserDocumentLike extends User {
  _id: Types.ObjectId;
}

export interface UserQueryFilters {
  role?: UserRole;
  search?: string;
}

export interface SeedUserInput {
  email: string;
  displayName: string;
  role: UserRole;
  tokenBalance: number;
}

/**
 * User data access.
 *
 * Balance mutations live here rather than in services because they must be
 * expressed as *atomic* MongoDB updates — see `applyBalanceDelta`.
 */
export const userRepository = {
  async findById(id: string, session?: ClientSession): Promise<UserRecord | null> {
    const document = await UserModel.findById(id).session(session ?? null).lean<UserRecord | null>();
    return document;
  },

  async findManyByIds(ids: string[]): Promise<UserRecord[]> {
    return UserModel.find({ _id: { $in: ids } }).lean<UserRecord[]>();
  },

  async findByEmail(email: string): Promise<UserRecord | null> {
    return UserModel.findOne({ email: email.toLowerCase() }).lean<UserRecord | null>();
  },

  async listByRole(role: UserRole): Promise<UserRecord[]> {
    return UserModel.find({ role }).sort({ createdAt: -1 }).lean<UserRecord[]>();
  },

  /** Paginated listing for the admin console, with optional role/text filters. */
  async list(
    filters: UserQueryFilters,
    pagination: PaginationParams,
  ): Promise<{ items: UserRecord[]; total: number }> {
    const query: FilterQuery<User> = buildUserFilter(filters);

    const [items, total] = await Promise.all([
      UserModel.find(query)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean<UserRecord[]>(),
      UserModel.countDocuments(query),
    ]);

    return { items, total };
  },

  /**
   * Idempotent seed helper.
   *
   * `upsert` keeps re-running the seed safe. An existing user has only its
   * descriptive fields refreshed; `tokenBalance` is set on insert only, so
   * re-seeding can never silently mint or destroy tokens.
   */
  async upsertSeedUser(input: SeedUserInput): Promise<{ user: UserRecord; created: boolean }> {
    const email = input.email.toLowerCase();
    const before = await this.findByEmail(email);

    const user = await UserModel.findOneAndUpdate(
      { email },
      { $set: { displayName: input.displayName, role: input.role }, $setOnInsert: { tokenBalance: input.tokenBalance } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean<UserRecord>();

    return { user, created: before === null };
  },

  /**
   * Applies a signed delta to a user's token balance atomically.
   *
   * For a negative delta the filter includes `tokenBalance: { $gte: amount }`,
   * so the decrement only succeeds if the balance is sufficient. Because both
   * the check and the write are one server-side operation, two concurrent
   * debits cannot both observe the same balance and overdraw the account — the
   * loser's filter simply stops matching.
   *
   * @param delta signed token change (positive credits, negative debits)
   * @returns the updated user, or `null` when the id is unknown or the
   *          balance is insufficient.
   */
  async applyBalanceDelta(
    userId: string,
    delta: number,
    session?: ClientSession,
  ): Promise<UserDocumentLike | null> {
    const filter: Record<string, unknown> = { _id: userId };
    if (delta < 0) {
      filter.tokenBalance = { $gte: Math.abs(delta) };
    }

    return UserModel.findOneAndUpdate(
      filter,
      { $inc: { tokenBalance: delta } },
      { new: true, session, runValidators: true },
    ).lean<UserDocumentLike>();
  },

  async setBalance(userId: string, balance: number, session?: ClientSession): Promise<UserDocumentLike | null> {
    return UserModel.findByIdAndUpdate(userId, { $set: { tokenBalance: balance } }, { new: true, session }).lean<
      UserDocumentLike
    >();
  },

  async count(): Promise<number> {
    return UserModel.countDocuments();
  },
};

export type UserRepository = typeof userRepository;

function buildUserFilter(filters: UserQueryFilters): FilterQuery<User> {
  const query: FilterQuery<User> = {};

  if (filters.role) query.role = filters.role;
  if (filters.search) {
    // Escaped regex: a partial match on display name or email, without letting
    // regex metacharacters from user input change the query.
    const pattern = new RegExp(escapeRegExp(filters.search), 'i');
    query.$or = [{ displayName: pattern }, { email: pattern }];
  }

  return query;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function toUserDto(document: UserRecord): UserDto {
  return {
    id: String(document._id),
    email: document.email,
    displayName: document.displayName,
    role: document.role,
    tokenBalance: document.tokenBalance,
    createdAt: document.createdAt.toISOString(),
  };
}
