import { randomBytes } from 'crypto';
import {
  Web3TransactionError,
  type ConversionRequest,
  type Web3Provider,
  type Web3TransactionResult,
  type WithdrawalRequest,
} from './web3-provider';

/** 32 bytes, the length of a real Ethereum hash. */
const TRANSACTION_HASH_BYTES = 32;

/**
 * State of the simulated chain.
 *
 * Deliberately module-scoped rather than per-instance: a real chain is shared,
 * persistent state, so rebuilding the provider (for example in a test) must not
 * "reset the ledger".
 */
const chainBalances = new Map<string, string>();
let chainHeadBlock = 1;

/**
 * In-memory stand-in for the token contract.
 *
 * It mimics the parts of the chain the application actually depends on:
 * a 32-byte transaction hash, a monotonically increasing block number, and a
 * balance per user/asset so `balanceOf` returns something meaningful.
 *
 * No blockchain is contacted and no funds move.
 */
export class MockWeb3Provider implements Web3Provider {
  readonly name = 'mock';
  readonly network: string;

  constructor(networkName: string) {
    this.network = networkName;
  }

  async convert(request: ConversionRequest): Promise<Web3TransactionResult> {
    const blockNumber = this.mineBlock();
    this.creditBalance(request.userId, request.toAsset, request.convertedAmount);

    return {
      txHash: this.generateTransactionHash(),
      status: 'SUCCESS',
      network: this.network,
      blockNumber,
    };
  }

  async withdraw(request: WithdrawalRequest): Promise<Web3TransactionResult> {
    const available = Number(chainBalances.get(balanceKey(request.userId, request.toAsset)) ?? 0);
    const requested = Number(request.amount);

    if (requested > available) {
      throw new Web3TransactionError(
        `Insufficient ${request.toAsset} balance to withdraw ${request.amount}`,
        'INSUFFICIENT_CONTRACT_BALANCE',
      );
    }

    const blockNumber = this.mineBlock();
    this.creditBalance(request.userId, request.toAsset, `-${request.amount}`);

    return {
      txHash: this.generateTransactionHash(),
      status: 'SUCCESS',
      network: this.network,
      blockNumber,
    };
  }

  async balanceOf(userId: string, asset: ConversionRequest['toAsset']): Promise<string> {
    return chainBalances.get(balanceKey(userId, asset)) ?? '0';
  }

  private creditBalance(userId: string, asset: ConversionRequest['toAsset'], amount: string): void {
    const key = balanceKey(userId, asset);
    const current = Number(chainBalances.get(key) ?? 0);
    chainBalances.set(key, String(Number((current + Number(amount)).toFixed(12))));
  }

  private mineBlock(): number {
    chainHeadBlock += 1;
    return chainHeadBlock;
  }

  /** 0x followed by 64 hex characters, matching Ethereum's hash format. */
  private generateTransactionHash(): string {
    return `0x${randomBytes(TRANSACTION_HASH_BYTES).toString('hex')}`;
  }
}

/** Test helper: empties the simulated chain. */
export function resetMockChain(): void {
  chainBalances.clear();
  chainHeadBlock = 1;
}

function balanceKey(userId: string, asset: string): string {
  return `${userId}:${asset}`;
}
