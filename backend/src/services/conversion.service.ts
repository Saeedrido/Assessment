import { tokenService, type TokenService } from './token.service';
import { withDatabaseTransaction } from './transaction.service';
import { conversionRepository, toConversionDto, type ConversionRepository } from '../repositories/conversion.repository';
import { getWeb3Provider } from '../web3/provider.factory';
import { Web3TransactionError, type Web3Provider } from '../web3/web3-provider';
import {
  assertConvertibleAmount,
  assertSupportedAsset,
  calculateConvertedAmount,
  formatConvertedAmount,
  getTokensPerUnit,
} from '../token/exchange';
import { WITHDRAWABLE_CONVERSION_STATUS } from '../constants/domain';
import { ERROR_CODES } from '../constants/error-codes';
import { ConflictError, NotFoundError, UnprocessableEntityError } from '../utils/errors';
import { buildPaginatedResult, type PaginatedResult } from '../utils/pagination';
import { assertValidObjectId } from '../utils/object-id';
import { logger } from '../utils/logger';
import { TOKEN_SOURCE } from '../constants/token';
import type { ConversionAsset } from '../constants/domain';
import type { ConversionDto } from '../types/dto';

/** Token symbol shown to users in conversion responses. */
const FROM_TOKEN_SYMBOL = 'TWORLD';

export interface ConvertRequest {
  userId: string;
  toAsset: ConversionAsset;
  amount: number;
}

export interface ConvertResult {
  conversion: ConversionDto;
  convertedAmount: string;
  remainingBalance: number;
}

export interface WithdrawResult {
  status: 'SUCCESS';
  network: string;
  txHashMock: string;
  conversion: ConversionDto;
}

/**
 * Orchestrates the token → mock-asset conversion and its withdrawal lifecycle.
 *
 * Responsibilities are deliberately split:
 *  - `token/exchange.ts`   → rate arithmetic (pure, unit-testable)
 *  - `TokenService`        → balance + ledger writes
 *  - `Web3Provider`        → the (mock) chain
 *  - this service          → sequencing and the transaction boundary
 */
export class ConversionService {
  /**
   * The provider is resolved per call rather than captured in the constructor so
   * the chain implementation can be swapped at runtime (and in tests) without
   * rebuilding the service graph.
   */
  constructor(
    private readonly tokens: TokenService,
    private readonly conversions: ConversionRepository,
    private readonly resolveWeb3Provider: () => Web3Provider,
  ) {}

  /**
   * Converts tokens into a mock on-chain asset.
   *
   * Balance debit, ledger entry and the conversion record are written inside a
   * single MongoDB transaction, so the account can never be debited without the
   * matching ledger and conversion rows. The chain call is made inside that
   * transaction as well: it keeps the three writes atomic, and for a real chain
   * the call would instead be moved out with a compensating refund (see README,
   * "Known limitations").
   */
  async convert(request: ConvertRequest): Promise<ConvertResult> {
    assertSupportedAsset(request.toAsset);
    assertConvertibleAmount(request.amount);

    const web3 = this.resolveWeb3Provider();

    const tokensPerUnit = getTokensPerUnit(request.toAsset);
    const convertedAmount = calculateConvertedAmount(request.toAsset, request.amount);

    return withDatabaseTransaction(async (session) => {
      const chainResult = await web3.convert({
        userId: request.userId,
        fromToken: FROM_TOKEN_SYMBOL,
        toAsset: request.toAsset,
        amount: request.amount,
        convertedAmount,
        tokensPerUnit,
      });

      if (chainResult.status !== 'SUCCESS') {
        throw new UnprocessableEntityError(
          'The contract rejected the conversion',
          ERROR_CODES.TOKENS_CONVERSION_NOT_ELIGIBLE,
        );
      }

      const conversion = await this.conversions.create(
        {
          userId: request.userId,
          fromToken: FROM_TOKEN_SYMBOL,
          toAsset: request.toAsset,
          amount: request.amount,
          convertedAmount,
          exchangeRate: tokensPerUnit,
          txHashMock: chainResult.txHash,
        },
        session,
      );

      const mutation = await this.tokens.debit({
        userId: request.userId,
        amount: request.amount,
        type: 'CONVERT',
        source: TOKEN_SOURCE.MANUAL,
        referenceType: 'CONVERSION',
        referenceId: String(conversion._id),
        note: `Converted ${request.amount} ${FROM_TOKEN_SYMBOL} to ${formatConvertedAmount(request.toAsset, convertedAmount)}`,
        session,
      });

      return {
        conversion: toConversionDto(conversion),
        convertedAmount: formatConvertedAmount(request.toAsset, convertedAmount),
        remainingBalance: mutation.balanceAfter,
      };
    });
  }

  /**
   * Withdraws previously converted assets.
   *
   * The conversion is *claimed* atomically (`SUCCESS` → `PROCESSING`) before the
   * transfer, which is what prevents the same conversion being withdrawn twice —
   * including by two requests arriving at the same moment. If the transfer
   * fails, the claim is released so the user can retry.
   */
  async withdraw(conversionId: string, userId: string): Promise<WithdrawResult> {
    assertValidObjectId(conversionId, 'conversion id');

    const web3 = this.resolveWeb3Provider();

    const conversion = await this.conversions.findById(conversionId, userId);
    if (!conversion) {
      throw new NotFoundError('Conversion not found', ERROR_CODES.TOKENS_CONVERSION_NOT_FOUND);
    }

    if (conversion.status === 'WITHDRAWN') {
      throw new ConflictError(
        'This conversion has already been withdrawn',
        ERROR_CODES.TOKENS_CONVERSION_ALREADY_WITHDRAWN,
      );
    }

    if (conversion.status !== WITHDRAWABLE_CONVERSION_STATUS) {
      throw new UnprocessableEntityError(
        `Conversion in state "${conversion.status}" cannot be withdrawn`,
        ERROR_CODES.TOKENS_CONVERSION_NOT_COMPLETED,
      );
    }

    const claimed = await this.conversions.claimForWithdrawal(
      conversionId,
      WITHDRAWABLE_CONVERSION_STATUS,
    );

    if (!claimed) {
      throw new ConflictError(
        'This conversion is already being withdrawn',
        ERROR_CODES.TOKENS_CONVERSION_ALREADY_WITHDRAWN,
      );
    }

    let withdrawalTxHash: string;
    try {
      const result = await web3.withdraw({
        userId,
        toAsset: conversion.toAsset,
        amount: conversion.convertedAmount,
        referenceTxHash: conversion.txHashMock,
      });

      if (result.status !== 'SUCCESS') {
        throw new Web3TransactionError(result.reason ?? 'Withdrawal failed', 'WITHDRAWAL_REVERTED');
      }
      withdrawalTxHash = result.txHash;
    } catch (error) {
      await this.conversions.releaseWithdrawalClaim(conversionId);
      logger.warn({ err: error, conversionId }, 'Withdrawal failed; claim released for retry');
      throw new UnprocessableEntityError(
        'The contract rejected the withdrawal. The conversion remains available for retry.',
        ERROR_CODES.TOKENS_WITHDRAWAL_FAILED,
      );
    }

    const updated = await withDatabaseTransaction(async (session) => {
      const marked = await this.conversions.markWithdrawn(conversionId, withdrawalTxHash, session);

      // Tokens were already spent at conversion time, so this entry is a
      // balance-neutral marker that keeps the ledger a complete audit trail.
      await this.tokens.recordNeutralEvent({
        userId,
        type: 'WITHDRAW',
        source: TOKEN_SOURCE.MANUAL,
        referenceType: 'WITHDRAWAL',
        referenceId: conversionId,
        note: `Withdrew ${formatConvertedAmount(conversion.toAsset, conversion.convertedAmount)}`,
        session,
      });

      return marked;
    });

    return {
      status: 'SUCCESS',
      network: web3.network,
      txHashMock: withdrawalTxHash,
      conversion: toConversionDto(updated ?? conversion),
    };
  }

  async list(
    userId: string,
    pagination: { page: number; pageSize: number },
  ): Promise<PaginatedResult<ConversionDto>> {
    const window = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      skip: (pagination.page - 1) * pagination.pageSize,
      limit: pagination.pageSize,
    };

    const { items, total } = await this.conversions.listByUser(userId, window);
    return buildPaginatedResult(items.map(toConversionDto), total, window);
  }
}

export const conversionService = new ConversionService(tokenService, conversionRepository, getWeb3Provider);
