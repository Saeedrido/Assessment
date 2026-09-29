import { AI_SUMMARY_LENGTHS, AI_SUMMARY_TONES } from './domain';
import { env } from '../config/env';

/**
 * AI orchestration constants.
 *
 * `AI_PROMPT_VERSION` is persisted on every run so historical summaries stay
 * reproducible after a prompt change.
 */
export const AI_PROMPT_VERSION = env.aiPromptVersion;

/** Hard ceiling on a single provider call; the caller receives a 504 on breach. */
export const AI_REQUEST_TIMEOUT_MS = env.aiTimeoutMs;

/**
 * Tokens charged for requesting a summary.
 *
 * Charged up front, before the provider is called, and refunded in full if the
 * run fails or times out — a user is never charged for a service that did not
 * produce a summary.
 */


/** Sentences per summary, by requested length. Keeps output predictable. */
export const AI_SENTENCES_BY_LENGTH: Record<string, number> = {
  short: 1,
  medium: 3,
  long: 5,
};

export const AI_TONE_INSTRUCTIONS: Record<string, string> = {
  neutral: 'Write in a neutral, factual register.',
  friendly: 'Write in a warm, approachable register.',
  formal: 'Write in a formal, professional register.',
  concise: 'Write in a clipped, information-dense register.',
};

export const SUPPORTED_TONES = AI_SUMMARY_TONES;
export const SUPPORTED_LENGTHS = AI_SUMMARY_LENGTHS;
