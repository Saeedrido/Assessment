import { useQuery } from '@tanstack/react-query';
import { tokenApi } from '../../lib/tokenApi';
import { getActiveUserId } from '../../lib/apiClient';
import type { TokenBalance } from '../../types/api';

/**
 * The caller's balance.
 *
 * Every token mutation invalidates `['token-balance']`, so the header and the
 * dashboard always reflect the ledger after a conversion, withdrawal or AI
 * reward.
 *
 * The query is disabled until an identity has been chosen: without an
 * `x-user-id` header every call would be a guaranteed 401.
 */
export function useTokenBalance() {
  return useQuery({
    queryKey: ['token-balance'],
    queryFn: tokenApi.balance,
    enabled: Boolean(getActiveUserId()),
  });
}

export type { TokenBalance };
