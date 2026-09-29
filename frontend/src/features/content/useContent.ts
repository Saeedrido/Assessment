import { useQuery } from '@tanstack/react-query';
import { contentApi } from '../../lib/contentApi';
import type { ListContentQuery } from '../../types/api';

/** Paginated content list with server-side search. */
export function useContentList(query: ListContentQuery) {
  return useQuery({
    queryKey: ['content', query],
    queryFn: () => contentApi.list(query),
    // Keeps the previous page on screen while the next one loads, instead of
    // flashing an empty table.
    placeholderData: (previous) => previous,
  });
}

export function useContentDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['content', 'detail', id],
    queryFn: () => contentApi.getById(id!),
    enabled: Boolean(id),
  });
}
