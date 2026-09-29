/** Domain enums shared by Mongoose schemas, services and validators. */

export const USER_ROLES = ['admin', 'user'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const AI_RUN_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT'] as const;
export type AiRunStatus = (typeof AI_RUN_STATUSES)[number];

/**
 * Ledger entry types.
 *
 * `SPEND` covers tokens consumed by a service (an AI summary request) as
 * opposed to tokens exchanged for an on-chain asset (`CONVERT`).
 */
export const TOKEN_TRANSACTION_TYPES = ['EARN', 'SPEND', 'CONVERT', 'WITHDRAW'] as const;
export type TokenTransactionType = (typeof TOKEN_TRANSACTION_TYPES)[number];

export const TOKEN_TRANSACTION_SOURCES = ['AI_USAGE', 'MANUAL', 'SYSTEM'] as const;
export type TokenTransactionSource = (typeof TOKEN_TRANSACTION_SOURCES)[number];

export const CONVERSION_ASSETS = ['MOCK_USDT', 'MOCK_ETH'] as const;
export type ConversionAsset = (typeof CONVERSION_ASSETS)[number];

/**
 * Conversion lifecycle:
 *   PENDING    → record created, chain call not yet confirmed
 *   SUCCESS    → assets credited, eligible for withdrawal
 *   PROCESSING → a withdrawal is in flight (claim held by one request)
 *   WITHDRAWN  → assets transferred to the user's wallet (terminal)
 *   FAILED     → the chain call failed (terminal, tokens refunded)
 */
export const CONVERSION_STATUSES = ['PENDING', 'SUCCESS', 'PROCESSING', 'WITHDRAWN', 'FAILED'] as const;
export type ConversionStatus = (typeof CONVERSION_STATUSES)[number];

/** Only a completed conversion may be withdrawn. */
export const WITHDRAWABLE_CONVERSION_STATUS: ConversionStatus = 'SUCCESS';

export const MEDIA_PROVIDERS = ['mock', 'cloudinary', 's3'] as const;
export type MediaProviderName = (typeof MEDIA_PROVIDERS)[number];

export const MEDIA_STATUSES = ['STORED', 'PROMOTED', 'FAILED'] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export const AI_SUMMARY_TONES = ['neutral', 'friendly', 'formal', 'concise'] as const;
export type AiSummaryTone = (typeof AI_SUMMARY_TONES)[number];

export const AI_SUMMARY_LENGTHS = ['short', 'medium', 'long'] as const;
export type AiSummaryLength = (typeof AI_SUMMARY_LENGTHS)[number];
