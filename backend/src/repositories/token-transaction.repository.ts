import type { ClientSession, Types } from 'mongoose';
import { Types as MongooseTypes } from 'mongoose';
import { TokenTransactionModel, type TokenTransaction } from '../models/token-transaction.model';
import type { PaginationParams } from '../utils/pagination';
import type { TokenTransactionDto, TokenBalanceDto } from '../types/dto';
import type { TokenTransactionType } from '../constants/domain';

type TokenTransactionDocument = TokenTransaction & { _id: Types.ObjectId };

export interface TokenLedgerTotals {
  earned: number;
  converted: number;
  withdrawn: number;
}

/**
 * Append-only ledger data access.
 *
 * This module intentionally exposes no update or delete operation — historical
 * entries are immutable by design.
 */
export const tokenTransactionRepository = {
  async append(
    entry: {
      userId: string;
      type: TokenTransactionType;
      source: TokenTransaction['source'];
      amount: number;
      balanceBefore: number;
      balanceAfter: number;
      referenceType?: string;
      referenceId?: string;
      note?: string;
    },
    session?: ClientSession,
  ): Promise<TokenTransactionDocument> {
    const [created] = await TokenTransactionModel.create([entry], session ? { session } : {});
    return created;
  },

  async listByUser(
    userId: string,
    pagination: PaginationParams,
    filter: { type?: TokenTransactionType } = {},
  ): Promise<{ items: TokenTransactionDocument[]; total: number }> {
    const query: Record<string, unknown> = { userId };
    if (filter.type) query.type = filter.type;

    const [items, total] = await Promise.all([
      TokenTransactionModel.find(query)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean<TokenTransactionDocument[]>(),
      TokenTransactionModel.countDocuments(query),
    ]);

    return { items, total };
  },

  /**
   * Lifetime totals per ledger type, computed with a single aggregation rather
   * than three separate queries.
   */
  async totalsByUser(userId: string): Promise<TokenLedgerTotals> {
    const rows = await TokenTransactionModel.aggregate<{ _id: TokenTransactionType; total: number }>([
      { $match: { userId: new MongooseTypes.ObjectId(userId) } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);

    const totals: TokenLedgerTotals = { earned: 0, converted: 0, withdrawn: 0 };
    for (const row of rows) {
      if (row._id === 'EARN') totals.earned = row.total;
      if (row._id === 'CONVERT') totals.converted = row.total;
      if (row._id === 'WITHDRAW') totals.withdrawn = row.total;
    }
    return totals;
  },

  async findByReference(referenceType: string, referenceId: string): Promise<TokenTransactionDocument | null> {
    const document = await TokenTransactionModel.findOne({ referenceType, referenceId }).lean<
      TokenTransactionDocument | null
    >();
    return document;
  },
};

export type TokenTransactionRepository = typeof tokenTransactionRepository;

export function toTokenTransactionDto(document: TokenTransactionDocument): TokenTransactionDto {
  return {
    id: String(document._id),
    userId: String(document.userId),
    type: document.type,
    source: document.source,
    amount: document.amount,
    balanceBefore: document.balanceBefore,
    balanceAfter: document.balanceAfter,
    referenceType: document.referenceType,
    referenceId: document.referenceId,
    note: document.note,
    createdAt: document.createdAt.toISOString(),
  };
}

export function toTokenBalanceDto(
  balance: number,
  totals: TokenLedgerTotals,
): TokenBalanceDto & TokenLedgerTotals {
  // Net movements, so the numbers match the ledger the user can inspect.
  return {
    balance,
    earned: totals.earned,
    converted: Math.abs(totals.converted),
    withdrawn: Math.abs(totals.withdrawn),
  };
}
