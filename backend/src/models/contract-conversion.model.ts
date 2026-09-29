import { Schema, type FilterQuery, type Types } from 'mongoose';
import { CONVERSION_ASSETS, CONVERSION_STATUSES, type ConversionAsset, type ConversionStatus } from '../constants/domain';
import { defineModel } from './model-registry';

export interface ContractConversion {
  userId: Types.ObjectId;
  fromToken: string;
  toAsset: ConversionAsset;
  /** Tokens spent, as recorded on the ledger. */
  amount: number;
  /** Assets received, kept as a string to avoid floating point drift. */
  convertedAmount: string;
  exchangeRate: number;
  txHashMock: string;
  status: ConversionStatus;
  /** Set when the conversion is withdrawn; prevents a second withdrawal. */
  withdrawalTxHashMock?: string;
  withdrawnAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const contractConversionSchema = new Schema<ContractConversion>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fromToken: { type: String, required: true, default: 'TWORLD' },
    toAsset: { type: String, required: true, enum: CONVERSION_ASSETS },
    amount: { type: Number, required: true, min: 1 },
    convertedAmount: {
      type: String,
      required: true,
      validate: {
        validator: (value: string) => Number(value) > 0,
        message: 'convertedAmount must be greater than zero',
      },
    },
    exchangeRate: {
      type: Number,
      required: true,
      validate: {
        validator: (value: number) => value > 0,
        message: 'exchangeRate must be greater than zero',
      },
    },
    txHashMock: { type: String, required: true },
    status: { type: String, required: true, enum: CONVERSION_STATUSES, default: 'PENDING' },
    withdrawalTxHashMock: { type: String, required: false, default: null },
    withdrawnAt: { type: Date, required: false, default: null },
  },
  { timestamps: true, versionKey: false, collection: 'contract_conversions' },
);

/**
 * Indexes:
 * 1. `{ userId: 1, createdAt: -1 }` → conversion history for one user.
 * 2. `{ status: 1, createdAt: -1 }` → operational sweep for conversions that
 *    are complete but not yet withdrawn.
 */
contractConversionSchema.index({ userId: 1, createdAt: -1 });
contractConversionSchema.index({ status: 1, createdAt: -1 });

export interface ConversionQueryFilters {
  userId?: string;
  status?: ConversionStatus;
}

export function buildConversionFilter(filters: ConversionQueryFilters): FilterQuery<ContractConversion> {
  const query: FilterQuery<ContractConversion> = {};
  if (filters.userId) query.userId = filters.userId;
  if (filters.status) query.status = filters.status;
  return query;
}

export const ContractConversionModel = defineModel<ContractConversion>(
  'ContractConversion',
  contractConversionSchema,
);
