import { z } from 'zod';
import { AI_SUMMARY_LENGTHS, AI_SUMMARY_TONES } from '../constants/domain';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/pagination';

export const summarizeBodySchema = z.object({
  tone: z.enum(AI_SUMMARY_TONES, {
    errorMap: () => ({ message: `tone must be one of: ${AI_SUMMARY_TONES.join(', ')}` }),
  }),
  length: z.enum(AI_SUMMARY_LENGTHS, {
    errorMap: () => ({ message: `length must be one of: ${AI_SUMMARY_LENGTHS.join(', ')}` }),
  }),
});

export const aiRunHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type SummarizeBody = z.infer<typeof summarizeBodySchema>;
export type AiRunHistoryQuery = z.infer<typeof aiRunHistoryQuerySchema>;
