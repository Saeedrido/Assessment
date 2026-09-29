import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contentApi } from '../../lib/contentApi';
import { toErrorMessage } from '../../lib/apiClient';
import type { CreateContentInput, SummarizeInput, SummarizeResult } from '../../types/api';

/** Run history for one content item, newest first. */
export function useAiRuns(contentId: string | undefined, page = 1) {
  return useQuery({
    queryKey: ['ai-runs', contentId, page],
    queryFn: () => contentApi.listAiRuns(contentId!, page),
    enabled: Boolean(contentId),
  });
}

/**
 * Requests a summary.
 *
 * A summarisation is a *paid* action: on success the caller is credited, and
 * on failure nothing is charged. `tokensAwarded` is surfaced in the UI so the
 * reward is never invisible.
 */
export function useSummarize(contentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SummarizeInput) => contentApi.summarize(contentId, input),
    onSuccess: (_result: SummarizeResult) => {
      void queryClient.invalidateQueries({ queryKey: ['ai-runs', contentId] });
      void queryClient.invalidateQueries({ queryKey: ['token-balance'] });
    },
  });
}

export function useCreateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateContentInput) => contentApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}

export { toErrorMessage };
