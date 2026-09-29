import { Badge } from '../ui/Badge';
import { formatTokens } from '../../utils/format';
import { useAuth } from '../../providers/AuthProvider';
import { useSeedUsers } from '../../features/users/useSeedUsers';
import { useTokenBalance } from '../../features/tokens/useTokenBalance';

/**
 * Top bar doubles as the identity switcher: the backend authenticates with an
 * `x-user-id` header, so choosing a seeded account is how a reviewer exercises
 * both the member and admin experiences.
 */
export function TopBar() {
  const { user, isAdmin, activeUserId, switchUser } = useAuth();
  const { data: balance } = useTokenBalance();
  const { data: seedData } = useSeedUsers();

  const accounts = seedData?.users ?? [];

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/40 px-4 py-3">
      <div className="flex items-center gap-3">
        <p className="text-sm text-slate-400">
          Acting as <span className="font-medium text-slate-100">{user?.displayName ?? 'unknown user'}</span>
        </p>
        {isAdmin && <Badge tone="info">admin</Badge>}
      </div>

      <div className="flex items-center gap-3">
        <p className="text-sm text-slate-400">
          Balance{' '}
          <span className="font-mono font-medium text-slate-100">
            {balance ? formatTokens(balance.balance) : '—'}
          </span>{' '}
          <span className="text-xs text-slate-500">TWD</span>
        </p>

        <label className="flex items-center gap-2 text-xs text-slate-500">
          <span>Switch user</span>
          <select
            className="input w-64 py-1.5 text-xs"
            value={activeUserId}
            onChange={(event) => switchUser(event.target.value)}
          >
            {accounts.length === 0 && <option value="">No seeded accounts found</option>}
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.email}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
