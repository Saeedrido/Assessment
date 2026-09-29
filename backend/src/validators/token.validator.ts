import { z } from 'zod';
import { CONVERSION_ASSETS, TOKEN_TRANSACTION_TYPES } from '../constants/domain';
import { MAX_CONVERSION_TOKENS, MIN_CONVERSION_TOKENS } from '../constants/token';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/pagination';
import { optionalQuery } from './query';

export const tokenHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  type: optionalQuery(z.enum(TOKEN_TRANSACTION_TYPES)),
});

export const convertTokensBodySchema = z.object({
  toAsset: z.enum(CONVERSION_ASSETS, {
    errorMap: () => ({ message: `toAsset must be one of: ${CONVERSION_ASSETS.join(', ')}` }),
  }),
  amount: z.coerce
    .number()
    .int('amount must be a whole number of tokens')
    .min(MIN_CONVERSION_TOKENS, `amount must be at least ${MIN_CONVERSION_TOKENS}`)
    .max(MAX_CONVERSION_TOKENS, `amount must not exceed ${MAX_CONVERSION_TOKENS}`),
});

export const withdrawBodySchema = z.object({
  conversionId: z.string().min(1, 'conversionId is required'),
});

export type TokenHistoryQuery = z.infer<typeof tokenHistoryQuerySchema>;
export type ConvertTokensBody = z.infer<typeof convertTokensBodySchema>;
export type WithdrawBody = z.infer<typeof withdrawBodySchema>;
