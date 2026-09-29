import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tokenApi } from '../../lib/tokenApi';
import type { ConvertInput, ListTokenHistoryQuery, WithdrawInput } from '../../types/api';

export function useTokenHistory(query: ListTokenHistoryQuery) {
  return useQuery({
    queryKey: ['token-history', query],
    queryFn: () => tokenApi.history(query),
    placeholderData: (previous) => previous,
  });
}

export function useConversions(query: ListTokenHistoryQuery) {
  return useQuery({
    queryKey: ['conversions', query],
    queryFn: () => tokenApi.conversions(query),
    placeholderData: (previous) => previous,
  });
}

/** Both mutations move tokens, so both invalidate the balance and the ledger. */
function useTokenMutation<TInput>(mutationFn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['token-balance'] });
      void queryClient.invalidateQueries({ queryKey: ['token-history'] });
      void queryClient.invalidateQueries({ queryKey: ['conversions'] });
      void queryClient.invalidateQueries({ queryKey: ['ai-runs'] });
    },
  });
}

export function useConvert() {
  return useTokenMutation<ConvertInput>((input) => tokenApi.convert(input));
}

export function useWithdraw() {
  return useTokenMutation<WithdrawInput>((input) => tokenApi.withdraw(input));
}
