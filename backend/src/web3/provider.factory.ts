import type { Web3Provider } from './web3-provider';
import { MockWeb3Provider } from './mock-web3.provider';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let cachedProvider: Web3Provider | null = null;

/**
 * Returns the configured Web3 provider.
 *
 * Only the mock implementation exists today. Adding a real one means adding a
 * branch here (selected by an env flag) and nothing else — services depend on
 * the `Web3Provider` interface, never on a concrete chain client.
 */
export function getWeb3Provider(): Web3Provider {
  if (!cachedProvider) {
    cachedProvider = new MockWeb3Provider(env.web3NetworkName);
    logger.info(`Web3 provider ready (implementation="${cachedProvider.name}", network="${env.web3NetworkName}")`);
  }
  return cachedProvider;
}

/** Test seam: inject a provider (e.g. one that always fails). */
export function setWeb3Provider(provider: Web3Provider | null): void {
  cachedProvider = provider;
}
