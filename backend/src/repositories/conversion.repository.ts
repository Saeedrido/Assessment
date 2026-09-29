import type { ClientSession, Types } from 'mongoose';
import { ContractConversionModel, type ContractConversion } from '../models/contract-conversion.model';
import type { ConversionStatus } from '../constants/domain';
import type { PaginationParams } from '../utils/pagination';
import type { ConversionDto } from '../types/dto';

type ConversionDocument = ContractConversion & { _id: Types.ObjectId };

export interface CreateConversionInput {
  userId: string;
  fromToken: string;
  toAsset: ContractConversion['toAsset'];
  amount: number;
  convertedAmount: string;
  exchangeRate: number;
  txHashMock: string;
}

export const conversionRepository = {
  async create(input: CreateConversionInput, session?: ClientSession): Promise<ConversionDocument> {
    const [created] = await ContractConversionModel.create(
      [{ ...input, status: 'SUCCESS' }],
      session ? { session } : {},
    );
    return created;
  },

  async findById(id: string, userId?: string): Promise<ConversionDocument | null> {
    const query: Record<string, unknown> = { _id: id };
    if (userId) query.userId = userId;

    const document = await ContractConversionModel.findOne(query).lean<ConversionDocument | null>();
    return document;
  },

  async listByUser(
    userId: string,
    pagination: PaginationParams,
  ): Promise<{ items: ConversionDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      ContractConversionModel.find({ userId })
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean<ConversionDocument[]>(),
      ContractConversionModel.countDocuments({ userId }),
    ]);

    return { items, total };
  },

  /**
   * Atomically claims a conversion for withdrawal by moving it out of the
   * withdrawable state.
   *
   * The status guard in the filter is what makes a second, concurrent
   * withdrawal request fail instead of transferring the assets twice. It
   * returns `null` when the conversion was already claimed or completed.
   */
  async claimForWithdrawal(
    id: string,
    fromStatus: ConversionStatus,
    session?: ClientSession,
  ): Promise<ConversionDocument | null> {
    return ContractConversionModel.findOneAndUpdate(
      { _id: id, status: fromStatus },
      { $set: { status: 'PROCESSING' as const } },
      { new: true, session },
    ).lean<ConversionDocument>();
  },

  /** Releases a claim so the conversion can be retried after a failed transfer. */
  async releaseWithdrawalClaim(id: string, session?: ClientSession): Promise<void> {
    await ContractConversionModel.updateOne(
      { _id: id, status: 'PROCESSING' },
      { $set: { status: 'SUCCESS' as const } },
      { session },
    );
  },

  async markWithdrawn(
    id: string,
    withdrawalTxHash: string,
    session?: ClientSession,
  ): Promise<ConversionDocument | null> {
    return ContractConversionModel.findOneAndUpdate(
      { _id: id },
      { $set: { status: 'WITHDRAWN' as const, withdrawalTxHashMock: withdrawalTxHash, withdrawnAt: new Date() } },
      { new: true, session },
    ).lean<ConversionDocument>();
  },

  async markFailed(id: string, session?: ClientSession): Promise<void> {
    await ContractConversionModel.updateOne(
      { _id: id },
      { $set: { status: 'FAILED' as const } },
      { session },
    );
  },

  async countByUser(userId: string): Promise<number> {
    return ContractConversionModel.countDocuments({ userId });
  },
};

export type ConversionRepository = typeof conversionRepository;

export function toConversionDto(document: ConversionDocument): ConversionDto {
  return {
    id: String(document._id),
    userId: String(document.userId),
    fromToken: document.fromToken,
    toAsset: document.toAsset,
    amount: document.amount,
    convertedAmount: document.convertedAmount,
    exchangeRate: document.exchangeRate,
    txHashMock: document.txHashMock,
    status: document.status,
    withdrawalTxHashMock: document.withdrawalTxHashMock ?? null,
    withdrawnAt: document.withdrawnAt ? document.withdrawnAt.toISOString() : null,
    createdAt: document.createdAt.toISOString(),
  };
}
