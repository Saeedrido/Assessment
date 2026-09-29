import type { AiSummaryLength, AiSummaryTone } from '../constants/domain';

/** The slice of a content item an AI provider needs. */
export interface SummarizableContent {
  title: string;
  body: string;
}

export interface AISummarizeRequest {
  content: SummarizableContent;
  tone: AiSummaryTone;
  length: AiSummaryLength;
  promptVersion: string;
}

export interface AISummarizeResult {
  output: string;
  /** Model identifier, recorded on the run for traceability. */
  model: string;
  /** Token usage, when the provider reports it. */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

/** Raised by a provider when the upstream call fails. */
export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly providerName: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'AIProviderError';
  }
}

/**
 * Raised when a provider does not answer within the configured budget.
 *
 * A dedicated type (rather than a generic error) lets the service distinguish a
 * timeout from a genuine provider failure and answer 504 instead of 502.
 */
export class AIProviderTimeoutError extends AIProviderError {
  constructor(
    public readonly timeoutMs: number,
    providerName: string,
  ) {
    super(`Provider "${providerName}" exceeded the ${timeoutMs}ms budget`, providerName);
    this.name = 'AIProviderTimeoutError';
  }
}

/**
 * Provider-agnostic AI abstraction.
 *
 * The application depends on this interface only. `AIService` measures latency,
 * enforces the timeout, records the run and awards tokens — it has no knowledge
 * of any vendor SDK. Swapping `MockAIProvider` for a real one is a
 * configuration change (see `ai/provider.factory.ts`).
 */
export interface AIProvider {
  /** Stable identifier persisted on each `ai_runs` record. */
  readonly name: string;

  summarize(request: AISummarizeRequest): Promise<AISummarizeResult>;
}
