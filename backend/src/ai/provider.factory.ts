import type { AIProvider } from './ai-provider';
import { MockAIProvider } from './mock-ai.provider';
import { OpenAIProvider } from './openai-ai.provider';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let cachedProvider: AIProvider | null = null;

/**
 * Returns the AI provider selected by `AI_PROVIDER`.
 *
 * Only `AIService` calls this. Because the provider is resolved per call, tests
 * can inject a stub (`setAiProvider`) without rebuilding the service graph, and
 * a new vendor only needs a new branch here.
 */
export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    cachedProvider = createProvider(env.aiProvider);
    logger.info(`AI provider ready (implementation="${cachedProvider.name}")`);
  }
  return cachedProvider;
}

function createProvider(name: string): AIProvider {
  switch (name) {
    case 'openai':
      return new OpenAIProvider();
    case 'mock':
      return new MockAIProvider();
    default:
      throw new Error(`Unsupported AI_PROVIDER "${name}". Expected "mock" or "openai".`);
  }
}

/** Test seam: inject a provider, or pass `null` to restore the configured one. */
export function setAiProvider(provider: AIProvider | null): void {
  cachedProvider = provider;
}
