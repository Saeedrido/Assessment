import { useQuery } from '@tanstack/react-query';
import { getPaginated } from '../../lib/apiClient';
import type { AiRun, PaginationQuery } from '../../types/api';

/** The caller's AI runs across every content item. */
export function useUserAiRuns(query: PaginationQuery) {
  return useQuery({
    queryKey: ['ai-runs', 'me', query],
    queryFn: () => getPaginated<AiRun>('/ai/runs', { ...query }),
    placeholderData: (previous) => previous,
  });
}
