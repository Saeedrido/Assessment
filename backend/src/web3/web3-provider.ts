import type { ConversionAsset } from '../constants/domain';

/**
 * Web3 provider abstraction.
 *
 * The application depends on this interface only. `MockWeb3Provider` is the
 * default implementation used in development and in tests; a real provider
 * (ethers + viem + a deployed contract) can be added without touching any
 * service, controller or route.
 */
export interface ConversionRequest {
  userId: string;
  fromToken: string;
  toAsset: ConversionAsset;
  /** Tokens spent. */
  amount: number;
  /** Assets received, already formatted as a decimal string. */
  convertedAmount: string;
  /** Tokens required per one unit of the asset. */
  tokensPerUnit: number;
}

export interface WithdrawalRequest {
  userId: string;
  toAsset: ConversionAsset;
  amount: string;
  /** Transaction hash of the conversion being withdrawn. */
  referenceTxHash: string;
}

export interface Web3TransactionResult {
  txHash: string;
  status: 'SUCCESS' | 'FAILED';
  network: string;
  blockNumber?: number;
  /** Populated when `status` is FAILED. */
  reason?: string;
}

/** Thrown when the chain (real or mocked) rejects a transaction. */
export class Web3TransactionError extends Error {
  constructor(
    message: string,
    public readonly reason: string,
  ) {
    super(message);
    this.name = 'Web3TransactionError';
  }
}

export interface Web3Provider {
  readonly name: string;
  readonly network: string;

  /** Exchanges tokens for a mock on-chain asset. */
  convert(request: ConversionRequest): Promise<Web3TransactionResult>;

  /** Transfers previously converted assets to the user's wallet. */
  withdraw(request: WithdrawalRequest): Promise<Web3TransactionResult>;

  /** Reads the current on-chain balance of an asset for a user. */
  balanceOf(userId: string, asset: ConversionAsset): Promise<string>;
}
