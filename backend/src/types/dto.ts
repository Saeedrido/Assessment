import type { UserRole, AiRunStatus, ConversionAsset, ConversionStatus, MediaProviderName, MediaStatus } from '../constants/domain';

/**
 * Response data-transfer objects.
 *
 * Repositories map Mongoose documents into these shapes, so services and
 * controllers never depend on Mongoose internals such as `_id` or populated
 * sub-documents.
 */

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  tokenBalance: number;
  createdAt: string;
}

/** Content item as returned by the list endpoint (author id only). */
export interface ContentListItemDto {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Content item as returned by the detail endpoint, with the author resolved. */
export interface ContentDetailDto extends Omit<ContentListItemDto, 'createdBy'> {
  createdBy: Pick<UserDto, 'id' | 'email' | 'displayName' | 'role'>;
}

export interface AiRunDto {
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

export interface TokenTransactionDto {
  id: string;
  userId: string;
  type: string;
  source: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  createdAt: string;
}

export interface TokenBalanceDto {
  balance: number;
  earned: number;
  converted: number;
  withdrawn: number;
}

export interface ConversionDto {
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

export interface MediaAssetDto {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  source: StoredAssetReferenceDto;
  destination: StoredAssetReferenceDto | null;
  status: MediaStatus;
  uploadedBy: string;
  promotedAt: string | null;
  createdAt: string;
}

export interface StoredAssetReferenceDto {
  provider: MediaProviderName;
  assetKey: string;
  publicUrl: string;
  bucketOrContainer?: string;
}
