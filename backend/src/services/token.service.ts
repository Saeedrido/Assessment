import type { ClientSession } from 'mongoose';
import { userRepository, type UserRepository } from '../repositories/user.repository';
import {
  tokenTransactionRepository,
  toTokenBalanceDto,
  toTokenTransactionDto,
  type TokenTransactionRepository,
} from '../repositories/token-transaction.repository';
import { withDatabaseTransaction } from './transaction.service';
import { ERROR_CODES } from '../constants/error-codes';
import { NotFoundError, UnprocessableEntityError } from '../utils/errors';
import { buildPaginatedResult, type PaginatedResult } from '../utils/pagination';
import type { BalanceMutationInput, BalanceMutationResult, LedgerReferenceType } from '../token/types';
import type { TokenTransactionType } from '../constants/domain';
import type { TokenBalanceDto, TokenTransactionDto } from '../types/dto';

/**
 * The token economy.
 *
 * **This is the only place in the codebase allowed to change a token balance.**
 * Every mutation goes through `applyBalanceMutation`, which guarantees:
 *
 *  1. The balance is updated atomically with a guard against overdrawing.
 *  2. A matching ledger entry is written in the same database transaction.
 *  3. `balanceBefore`/`balanceAfter` on the entry are derived from the actual
 *     stored value, so the ledger can always be reconciled against the account.
 */
export class TokenService {
  constructor(
    private readonly users: UserRepository,
    private readonly ledger: TokenTransactionRepository,
  ) {}

  async getBalance(userId: string): Promise<TokenBalanceDto> {
    const [user, totals] = await Promise.all([
      this.users.findById(userId),
      this.ledger.totalsByUser(userId),
    ]);

    if (!user) {
      throw new NotFoundError('User not found', ERROR_CODES.AUTH_USER_NOT_FOUND);
    }

    return toTokenBalanceDto(user.tokenBalance, totals);
  }

  async getHistory(
    userId: string,
    pagination: { page: number; pageSize: number },
    filter: { type?: TokenTransactionType } = {},
  ): Promise<PaginatedResult<TokenTransactionDto>> {
    const window = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      skip: (pagination.page - 1) * pagination.pageSize,
      limit: pagination.pageSize,
    };

    const { items, total } = await this.ledger.listByUser(userId, window, filter);

    return buildPaginatedResult(items.map(toTokenTransactionDto), total, window);
  }

  /** Credits tokens (for example the AI reward). */
  async credit(input: Omit<BalanceMutationInput, 'amount'> & { amount: number }): Promise<BalanceMutationResult> {
    if (input.amount <= 0) {
      throw new UnprocessableEntityError(
        'A credit must be a positive token amount',
        ERROR_CODES.TOKENS_INVALID_AMOUNT,
      );
    }
    return this.applyBalanceMutation({ ...input, amount: Math.abs(input.amount) });
  }

  /** Debits tokens (for example a conversion). */
  async debit(input: Omit<BalanceMutationInput, 'amount'> & { amount: number }): Promise<BalanceMutationResult> {
    if (input.amount === 0) {
      throw new UnprocessableEntityError(
        'A debit must be a positive token amount',
        ERROR_CODES.TOKENS_INVALID_AMOUNT,
      );
    }
    return this.applyBalanceMutation({ ...input, amount: -Math.abs(input.amount) });
  }

  /**
   * Records an event that does not move the balance (used when a withdrawal
   * transfers the already-converted asset rather than tokens).
   *
   * The ledger stays the audit trail for everything that happens to a token
   * account, including balance-neutral events.
   */
  async recordNeutralEvent(input: {
    userId: string;
    type: TokenTransactionType;
    source: BalanceMutationInput['source'];
    referenceType?: LedgerReferenceType;
    referenceId?: string;
    note?: string;
    session?: ClientSession;
  }): Promise<BalanceMutationResult> {
    return this.applyBalanceMutation({ ...input, amount: 0 });
  }

  /**
   * Applies a signed delta and appends the matching ledger entry.
   *
   * Ordering matters: the balance is updated first and the returned document
   * gives us the authoritative new value, from which the previous balance is
   * derived. Both writes share a transaction, so a failure to append the ledger
   * entry rolls the balance back.
   */
  async applyBalanceMutation(input: BalanceMutationInput): Promise<BalanceMutationResult> {
    if (!Number.isInteger(input.amount)) {
      throw new UnprocessableEntityError(
        'Token amount must be a whole number',
        ERROR_CODES.TOKENS_INVALID_AMOUNT,
      );
    }

    const run = async (session?: ClientSession): Promise<BalanceMutationResult> => {
      const updatedUser = await this.users.applyBalanceDelta(input.userId, input.amount, session);

      if (!updatedUser) {
        // Distinguish "no such user" from "not enough tokens" so the API can
        // answer 401 vs 422 — both are real, different client errors.
        const userExists = await this.users.findById(input.userId, session);
        if (!userExists) {
          throw new NotFoundError('User not found', ERROR_CODES.AUTH_USER_NOT_FOUND);
        }
        throw new UnprocessableEntityError(
          'Insufficient token balance for this operation',
          ERROR_CODES.TOKENS_INSUFFICIENT_BALANCE,
        );
      }

      const balanceAfter = updatedUser.tokenBalance;
      const balanceBefore = balanceAfter - input.amount;

      const ledgerEntry = await this.ledger.append(
        {
          userId: input.userId,
          type: input.type,
          source: input.source,
          amount: input.amount,
          balanceBefore,
          balanceAfter,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          note: input.note,
        },
        session,
      );

      return { balanceBefore, balanceAfter, transactionId: String(ledgerEntry._id) };
    };

    // When the caller already owns a transaction, join it instead of nesting.
    return input.session ? run(input.session) : withDatabaseTransaction(run);
  }
}

export const tokenService = new TokenService(userRepository, tokenTransactionRepository);
