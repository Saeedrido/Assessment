import { CONVERSION_ASSETS, type ConversionAsset } from './domain';
import { env } from '../config/env';

/**
 * Token economy constants.
 *
 * Everything tunable lives in the environment (see `config/env.ts`) so a
 * deployment can change reward rates or exchange rates without a code change.
 * The names below are the single source of truth for business rules — no
 * service or controller should repeat these values.
 */

/** Tokens charged to a user for each AI summarisation request. */
export const AI_REQUEST_COST = env.aiRequestCost;

/** Tokens credited to a user for each successful AI summarisation run. */
export const AI_SUCCESS_REWARD = env.aiSuccessReward;

/** Tokens awarded for each successful AI run (alias of `AI_SUCCESS_REWARD`). */
export const TOKEN_AI_REWARD = AI_SUCCESS_REWARD;

/**
 * Ledger source values as named constants. The model validates against the
 * string literals; these keep call sites readable and typo-proof.
 */
export const TOKEN_SOURCE = {
  AI_USAGE: 'AI_USAGE',
  MANUAL: 'MANUAL',
  SYSTEM: 'SYSTEM',
} as const satisfies Record<string, 'AI_USAGE' | 'MANUAL' | 'SYSTEM'>;

export const TOKEN_TRANSACTION_TYPE = {
  EARN: 'EARN',
  SPEND: 'SPEND',
  CONVERT: 'CONVERT',
  WITHDRAW: 'WITHDRAW',
} as const satisfies Record<string, 'EARN' | 'SPEND' | 'CONVERT' | 'WITHDRAW'>;

/** Starting balance for a brand new user (not used by the seed script). */
export const INITIAL_TOKEN_BALANCE = env.tokenInitialBalance;

/** A conversion must be a whole number of tokens within these bounds. */
export const MIN_CONVERSION_TOKENS = 1;
export const MAX_CONVERSION_TOKENS = 1_000_000;

/**
 * Exchange rates expressed as "tokens required per 1 unit of asset".
 * 100 tokens -> 1 MOCK_USDT, 20 000 tokens -> 1 MOCK_ETH.
 */
export const EXCHANGE_RATES: Record<ConversionAsset, { tokensPerUnit: number }> = {
  MOCK_USDT: { tokensPerUnit: env.rateTokensPerMockUsdt },
  MOCK_ETH: { tokensPerUnit: env.rateTokensPerMockEth },
};

export const SUPPORTED_CONVERSION_ASSETS = CONVERSION_ASSETS;
