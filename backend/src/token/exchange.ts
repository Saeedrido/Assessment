import { EXCHANGE_RATES, MIN_CONVERSION_TOKENS, MAX_CONVERSION_TOKENS } from '../constants/token';
import { CONVERSION_ASSETS, type ConversionAsset } from '../constants/domain';
import { ERROR_CODES } from '../constants/error-codes';
import { UnprocessableEntityError } from '../utils/errors';

/**
 * Pure exchange-rate arithmetic.
 *
 * Kept free of Mongoose and Express so the maths can be unit-tested directly
 * and reused by any consumer (services, scripts, future jobs).
 *
 * Rates are configured as "tokens per one unit of asset":
 *   MOCK_USDT → 100 tokens
 *   MOCK_ETH  → 20 000 tokens
 */

/** Number of decimal places kept for the asset amount. */
export const ASSET_DECIMAL_PLACES = 6;

export function isSupportedAsset(asset: string): asset is ConversionAsset {
  return (CONVERSION_ASSETS as readonly string[]).includes(asset);
}

export function assertSupportedAsset(asset: string): asserts asset is ConversionAsset {
  if (!isSupportedAsset(asset)) {
    throw new UnprocessableEntityError(
      `Unsupported asset "${asset}". Supported assets: ${CONVERSION_ASSETS.join(', ')}`,
      ERROR_CODES.TOKENS_UNSUPPORTED_ASSET,
    );
  }
}

/** Tokens required per single unit of `asset`. */
export function getTokensPerUnit(asset: ConversionAsset): number {
  return EXCHANGE_RATES[asset].tokensPerUnit;
}

export function assertConvertibleAmount(amount: number): void {
  if (!Number.isInteger(amount)) {
    throw new UnprocessableEntityError(
      'Amount must be a whole number of tokens',
      ERROR_CODES.TOKENS_INVALID_AMOUNT,
    );
  }
  if (amount < MIN_CONVERSION_TOKENS || amount > MAX_CONVERSION_TOKENS) {
    throw new UnprocessableEntityError(
      `Amount must be between ${MIN_CONVERSION_TOKENS} and ${MAX_CONVERSION_TOKENS} tokens`,
      ERROR_CODES.TOKENS_INVALID_AMOUNT,
    );
  }
}

/**
 * Converts a token amount into the target asset.
 *
 * The result is a **string** so the exact value survives persistence — binary
 * floating point cannot represent values like 0.005 precisely, and the asset
 * amount is later shown to the user and written to a "blockchain" record.
 */
export function calculateConvertedAmount(asset: ConversionAsset, tokenAmount: number): string {
  const tokensPerUnit = getTokensPerUnit(asset);
  const units = tokenAmount / tokensPerUnit;

  return trimTrailingZeros(units.toFixed(ASSET_DECIMAL_PLACES));
}

/** e.g. `formatConvertedAmount('MOCK_USDT', '1.000000')` → `"1 MOCK_USDT"`. */
export function formatConvertedAmount(asset: ConversionAsset, amount: string): string {
  return `${amount} ${asset}`;
}

function trimTrailingZeros(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}
