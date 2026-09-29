/**
 * Browser-side types, mirroring the backend DTOs one-for-one.
 *
 * Kept in a single module so a contract change is a single-file edit, and so
 * feature components never import types from the API client implementation.
 */

export type UserRole = 'admin' | 'user';
export type AiRunStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
export type ConversionAsset = 'MOCK_ETH' | 'MOCK_USDT';
export type ConversionStatus = 'SUCCESS' | 'PROCESSING' | 'WITHDRAWN';
export type MediaProviderName = 'cloudinary' | 's3' | 'mock';
export type MediaStatus = 'STORED' | 'PROMOTED' | 'FAILED';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  tokenBalance: number;
  createdAt: string;
}

export interface ContentListItem {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentDetail extends Omit<ContentListItem, 'createdBy'> {
  createdBy: Pick<User, 'id' | 'email' | 'displayName' | 'role'>;
}

export interface AiRun {
  id: string;
  contentId: string;
  userId: string;
  promptVersion: string;
  provider: string;
  tone: string;
  length: string;
  status: AiRunStatus;
  output: string | null;
  errorMessage: string | null;
  latencyMs: number;
  tokensAwarded: number;
  createdAt: string;
}

/**
 * Ledger vocabulary, mirroring the backend's `TOKEN_TRANSACTION_TYPES` and
 * `TOKEN_TRANSACTION_SOURCES`. `SPEND` is a token consumed by a service (an AI
 * request); `CONVERT` exchanges tokens for a mock on-chain asset.
 */
export type TokenTransactionType = 'EARN' | 'SPEND' | 'CONVERT' | 'WITHDRAW';
export type TokenTransactionSource = 'AI_USAGE' | 'MANUAL' | 'SYSTEM';

export interface TokenTransaction {
  id: string;
  userId: string;
  type: TokenTransactionType;
  source: TokenTransactionSource;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  createdAt: string;
}

export interface TokenBalance {
  balance: number;
  earned: number;
  converted: number;
  withdrawn: number;
}

export interface Conversion {
  id: string;
  userId: string;
  fromToken: string;
  toAsset: ConversionAsset;
  amount: number;
  convertedAmount: string;
  exchangeRate: number;
  txHashMock: string;
  status: ConversionStatus;
  withdrawalTxHashMock: string | null;
  withdrawnAt: string | null;
  createdAt: string;
}

export interface StoredAssetReference {
  provider: MediaProviderName;
  assetKey: string;
  publicUrl: string;
  bucketOrContainer?: string;
}

export interface MediaAsset {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  source: StoredAssetReference;
  destination: StoredAssetReference | null;
  status: MediaStatus;
  uploadedBy: string;
  promotedAt: string | null;
  createdAt: string;
}

export interface PaginatedMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface ListContentQuery extends PaginationQuery {
  q?: string;
  tag?: string;
  createdBy?: string;
}

export interface ListUsersQuery extends PaginationQuery {
  role?: UserRole;
  q?: string;
}

export interface ListTokenHistoryQuery extends PaginationQuery {
  type?: string;
  source?: string;
}

export interface CreateContentInput {
  title: string;
  body: string;
  tags: string[];
}

export interface SummarizeInput {
  tone: string;
  length: string;
}

/** Shape returned by `POST /content/:id/ai/summarize`. */
export interface SummarizeResult {
  output: string;
  latencyMs: number;
  tokensAwarded: number;
  totalTokenBalance: number;
  run: AiRun;
}

export interface ConvertInput {
  amount: number;
  toAsset: ConversionAsset;
}

export interface WithdrawInput {
  conversionId: string;
  walletAddress: string;
}

/** The success envelope the API client unwraps. */
export interface SuccessEnvelopeLike<T> {
  success: true;
  message: string;
  data: T;
}
