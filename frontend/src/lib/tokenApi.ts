import { getOne, getPaginated, postOne } from './apiClient';
import type {
  Conversion,
  ConvertInput,
  ListTokenHistoryQuery,
  TokenBalance,
  TokenTransaction,
  WithdrawInput,
} from '../types/api';

/** Token economy endpoints: balance, ledger, conversion and withdrawal. */
export const tokenApi = {
  balance: () => getOne<TokenBalance>('/tokens/balance'),

  history: (query: ListTokenHistoryQuery) => getPaginated<TokenTransaction>('/tokens/history', { ...query }),

  conversions: (query: ListTokenHistoryQuery) => getPaginated<Conversion>('/tokens/conversions', { ...query }),

  convert: (input: ConvertInput) => postOne<Conversion, ConvertInput>('/tokens/convert', input),

  withdraw: (input: WithdrawInput) => postOne<Conversion, WithdrawInput>('/tokens/withdraw', input),
};
