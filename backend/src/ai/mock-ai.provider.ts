import { randomInt } from 'crypto';
import type { AIProvider, AISummarizeRequest, AISummarizeResult } from './ai-provider';
import { AIProviderError } from './ai-provider';
import { AI_SENTENCES_BY_LENGTH } from '../constants/ai';
import { env } from '../config/env';
import { sleep } from '../utils/timeout';

/**
 * Deterministic, offline AI provider.
 *
 * It performs a real extractive summarisation (leading sentences, lightly
 * re-shaped by tone) after a simulated latency, which lets the whole AI →
 * token-reward pipeline be exercised without credentials, network access or
 * cost. Failure rate and latency bounds are configurable so timeout and error
 * paths can be demonstrated on demand.
 */
export class MockAIProvider implements AIProvider {
  readonly name = 'mock';

  async summarize(request: AISummarizeRequest): Promise<AISummarizeResult> {
    await this.simulateLatency();
    this.maybeFail();

    return {
      output: this.buildExtractiveSummary(request),
      model: 'mock-extractive-v1',
    };
  }

  /**
   * Random delay inside the configured window, to exercise latency reporting.
   *
   * The upper bound is clamped to the request budget so a default setup can
   * never turn an ordinary mock run into a timeout. Tests that *want* a
   * timeout raise the window deliberately.
   */
  private async simulateLatency(): Promise<void> {
    const minLatency = Math.min(env.aiMockMinLatencyMs, env.aiTimeoutMs);
    const maxLatency = Math.min(env.aiMockMaxLatencyMs, env.aiTimeoutMs);

    if (maxLatency <= minLatency) {
      await sleep(minLatency);
      return;
    }
    await sleep(randomInt(minLatency, maxLatency + 1));
  }

  private maybeFail(): void {
    if (env.aiMockFailureRate > 0 && Math.random() < env.aiMockFailureRate) {
      throw new AIProviderError('Mock provider simulated an upstream failure', this.name);
    }
  }

  /**
   * Takes the leading sentences of the article and prefixes a tone cue. It is
   * intentionally simple — the point is to exercise the orchestration, not to
   * compete with a language model.
   */
  private buildExtractiveSummary(request: AISummarizeRequest): string {
    const sentences = splitSentences(request.content.body);
    const limit = AI_SENTENCES_BY_LENGTH[request.length] ?? AI_SENTENCES_BY_LENGTH.medium;
    const selected = sentences.slice(0, limit).join(' ');

    const tonePrefix = tonePrefixFor(request.tone);

    return `${tonePrefix}${truncate(selected || request.content.body, MAX_SUMMARY_CHARACTERS)}`;
  }
}

const MAX_SUMMARY_CHARACTERS = 600;

function tonePrefixFor(tone: AISummarizeRequest['tone']): string {
  switch (tone) {
    case 'formal':
      return 'In summary: ';
    case 'friendly':
      return 'Here is the short version — ';
    case 'concise':
      return '';
    default:
      return '';
  }
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}…`;
}
