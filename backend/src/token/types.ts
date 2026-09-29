import type { ClientSession } from 'mongoose';
import type { TokenTransactionSource, TokenTransactionType } from '../constants/domain';

/** Reference types recorded on a ledger entry, used for reconciliation. */
export const LEDGER_REFERENCE_TYPES = ['AI_RUN', 'CONVERSION', 'WITHDRAWAL', 'SEED', 'ADJUSTMENT'] as const;
export type LedgerReferenceType = (typeof LEDGER_REFERENCE_TYPES)[number];

/**
 * Input for a single balance mutation.
 *
 * `amount` is always signed from the *user's* point of view: positive credits,
 * negative debits. Services never accept an unsigned amount plus a direction,
 * because that invites sign bugs at the call site.
 */
export interface BalanceMutationInput {
  userId: string;
  /** Signed change in tokens. `0` is only valid for WITHDRAW event markers. */
  amount: number;
  type: TokenTransactionType;
  source: TokenTransactionSource;
  referenceType?: LedgerReferenceType;
  referenceId?: string;
  note?: string;
  /** Reuse an existing session to join a caller's transaction. */
  session?: ClientSession;
}

/** Outcome of a balance mutation, including the resulting ledger entry. */
export interface BalanceMutationResult {
  balanceBefore: number;
  balanceAfter: number;
  transactionId: string;
}
