import { Schema, type Types } from 'mongoose';
import { TOKEN_TRANSACTION_TYPES, TOKEN_TRANSACTION_SOURCES } from '../constants/domain';
import { defineModel } from './model-registry';

/**
 * Append-only ledger of every token balance change.
 *
 * Business rules enforced by the schema:
 *  - `amount` is never zero (a no-op entry would be meaningless noise).
 *  - `balanceAfter` can never be negative.
 *  - `balanceBefore + amount` must equal `balanceAfter`, so the ledger is
 *    internally verifiable by an auditor.
 *
 * There is deliberately no update or delete API for this collection.
 */
export interface TokenTransaction {
  userId: Types.ObjectId;
  type: (typeof TOKEN_TRANSACTION_TYPES)[number];
  source: (typeof TOKEN_TRANSACTION_SOURCES)[number];
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const tokenTransactionSchema = new Schema<TokenTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: false },
    type: { type: String, required: true, enum: TOKEN_TRANSACTION_TYPES },
    source: { type: String, required: true, enum: TOKEN_TRANSACTION_SOURCES },
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: function (value: number) {
          if (!Number.isInteger(value)) return false;
          // A zero amount is reserved for WITHDRAW markers: transferring an
          // already-converted asset does not move the token balance again, but
          // the event still belongs in the audit trail.
          if (value === 0) return this.type === 'WITHDRAW';
          return true;
        },
        message: 'amount must be a non-zero integer, or 0 for a WITHDRAW marker entry',
      },
    },
    balanceBefore: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value: number) => Number.isInteger(value) && value >= 0,
        message: 'balanceBefore must be a non-negative integer',
      },
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: [0, 'balanceAfter cannot be negative'],
      validate: {
        validator: function (value: number) {
          return Number.isInteger(value) && value >= 0 && value === this.balanceBefore + this.amount;
        },
        message: 'balanceAfter must equal balanceBefore + amount and cannot be negative',
      },
    },
    referenceType: {
      type: String,
      required: false,
      enum: ['AI_RUN', 'CONVERSION', 'WITHDRAWAL', 'SEED', 'ADJUSTMENT'],
      index: false,
    },
    referenceId: { type: Schema.Types.String, required: false, index: false },
    note: { type: Schema.Types.String, required: false, maxlength: 280 },
  },
  { timestamps: true, versionKey: false, collection: 'token_transactions' },
);

// Supports `GET /tokens/history` (newest first for one user) and reconciliation
// queries that look up every entry produced by a given reference.
tokenTransactionSchema.index({ userId: 1, createdAt: -1 });
tokenTransactionSchema.index({ referenceType: 1, referenceId: 1 });
tokenTransactionSchema.index({ userId: 1, type: 1, createdAt: -1 });

export const TokenTransactionModel = defineModel<TokenTransaction>('TokenTransaction', tokenTransactionSchema);
