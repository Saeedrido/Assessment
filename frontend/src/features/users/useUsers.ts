import { useQuery } from '@tanstack/react-query';
import { userApi } from '../../lib/userApi';
import type { ListUsersQuery } from '../../types/api';

/** Paginated user directory. The endpoint requires an admin caller. */
export function useUsers(query: ListUsersQuery) {
  return useQuery({
    queryKey: ['users', query],
    queryFn: () => userApi.list(query),
  });
}
