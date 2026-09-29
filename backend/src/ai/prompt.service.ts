import { AI_SENTENCES_BY_LENGTH, AI_TONE_INSTRUCTIONS } from '../constants/ai';
import { AI_PROMPT_VERSION } from '../constants/ai';
import type { AiSummaryLength, AiSummaryTone } from '../constants/domain';
import type { SummarizableContent } from './ai-provider';

export interface BuiltPrompt {
  system: string;
  user: string;
  promptVersion: string;
  /** Included in the mock provider's output and useful when debugging. */
  instruction: string;
}

/**
 * Single place where summarisation prompts are defined.
 *
 * The version is stamped onto every run, so a stored output can always be
 * traced back to the prompt that produced it. Bump `AI_PROMPT_VERSION` when the
 * prompt text changes.
 */
export function buildSummaryPrompt(
  content: SummarizableContent,
  tone: AiSummaryTone,
  length: AiSummaryLength,
): BuiltPrompt {
  const instruction = [
    AI_TONE_INSTRUCTIONS[tone] ?? AI_TONE_INSTRUCTIONS.neutral,
    `Use at most ${AI_SENTENCES_BY_LENGTH[length] ?? AI_SENTENCES_BY_LENGTH.medium} sentences.`,
  ].join(' ');

  return {
    promptVersion: AI_PROMPT_VERSION,
    instruction,
    system:
      'You are a summarisation assistant for the T-World content platform. ' +
      'Summarise the supplied article faithfully. Never invent facts that are not present.',
    user: [
      `Title: ${content.title}`,
      '',
      'Article:',
      content.body,
      '',
      `Tone: ${tone}. Length: ${length}.`,
      instruction,
    ].join('\n'),
  };
}
