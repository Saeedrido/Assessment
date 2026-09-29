import type { AIProvider, AISummarizeRequest, AISummarizeResult } from './ai-provider';
import { AIProviderError } from './ai-provider';
import { env } from '../config/env';

/**
 * OpenAI-compatible provider.
 *
 * Demonstrates that the rest of the application is vendor agnostic: it depends
 * on `AIProvider`, so this class can be enabled purely through configuration
 * (`AI_PROVIDER=openai` plus `OPENAI_API_KEY`) without touching a service.
 *
 * The SDK is deliberately not installed — a plain `fetch` against the
 * OpenAI-compatible `/chat/completions` endpoint keeps the dependency list
 * short and works with any compatible gateway via `OPENAI_BASE_URL`.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  async summarize(request: AISummarizeRequest): Promise<AISummarizeResult> {
    if (!env.openaiApiKey) {
      throw new AIProviderError(
        'OPENAI_API_KEY is not configured. Set AI_PROVIDER=mock to run without credentials.',
        this.name,
      );
    }

    const response = await fetch(`${env.openaiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: env.openaiModel,
        max_tokens: env.openaiMaxOutputTokens,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(request) },
        ],
      }),
    });

    if (!response.ok) {
      // The upstream body may contain sensitive detail, so it is not forwarded.
      throw new AIProviderError(
        `OpenAI request failed with status ${response.status}`,
        this.name,
      );
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const output = payload.choices?.[0]?.message?.content;
    if (!output) {
      throw new AIProviderError('OpenAI returned an empty completion', this.name);
    }

    return {
      output,
      model: env.openaiModel,
      usage: {
        promptTokens: payload.usage?.prompt_tokens,
        completionTokens: payload.usage?.completion_tokens,
      },
    };
  }
}

const SYSTEM_PROMPT =
  'You are a summarisation assistant for the T-World content platform. ' +
  'Summarise the supplied article faithfully. Never invent facts that are not present.';

function buildUserPrompt(request: AISummarizeRequest): string {
  return [
    `Title: ${request.content.title}`,
    '',
    'Article:',
    request.content.body,
    '',
    `Tone: ${request.tone}. Length: ${request.length}.`,
    `Prompt version: ${request.promptVersion}.`,
  ].join('\n');
}
