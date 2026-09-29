import { useQuery } from '@tanstack/react-query';
import { devApi } from '../../lib/devApi';

/**
 * Populates the identity switcher.
 *
 * The console acts on behalf of a seeded account, and those ids only exist
 * after `npm run seed`, so they are discovered at runtime rather than baked
 * into the build.
 */
export function useSeedUsers() {
  return useQuery({
    queryKey: ['seed-users'],
    queryFn: devApi.seedUsers,
    staleTime: Infinity,
    retry: false,
  });
}
