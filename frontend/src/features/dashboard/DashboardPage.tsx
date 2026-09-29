import { useQuery } from '@tanstack/react-query';
import { StatCard } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Feedback';
import { useContentList } from '../content/useContent';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { useAuth } from '../../providers/AuthProvider';
import { userApi } from '../../lib/userApi';
import { formatDateTime, formatTokens } from '../../utils/format';

/** Landing view: the numbers a reviewer should see first. */
export function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { data: balance, isError, refetch } = useTokenBalance();
  const { data: recentContent } = useContentList({ page: 1, pageSize: 5 });

  // Admin-only totals: the endpoint rejects non-admins, so it is not even
  // requested for a member.
  const { data: userDirectory } = useQuery({
    queryKey: ['users', 'count'],
    queryFn: () => userApi.list({ page: 1, pageSize: 1 }),
    enabled: isAdmin,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-50">Dashboard</h1>
        <p className="text-sm text-slate-400">
          {user ? `Welcome back, ${user.displayName}.` : 'No user selected.'} This account was created{' '}
          {formatDateTime(user?.createdAt)}.
        </p>
      </div>

      {isError && <Alert onRetry={() => void refetch()}>Could not load the token balance.</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Token balance"
          value={balance ? formatTokens(balance.balance) : '—'}
          hint="TWD available to spend"
        />
        <StatCard
          label="Earned"
          value={balance ? formatTokens(balance.earned) : '—'}
          hint="Lifetime rewards, including AI summaries"
        />
        <StatCard
          label="Converted"
          value={balance ? formatTokens(balance.converted) : '—'}
          hint="Spent on mock on-chain assets"
        />
        <StatCard
          label="Withdrawn"
          value={balance ? formatTokens(balance.withdrawn) : '—'}
          hint="Transferred to an external wallet"
        />
      </div>

      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Registered users"
            value={userDirectory ? formatTokens(userDirectory.meta.totalItems) : '—'}
            hint="Visible to admins only"
          />
          <StatCard
            label="Content items"
            value={recentContent ? formatTokens(recentContent.meta.totalItems) : '—'}
            hint="Total published items"
          />
        </div>
      )}

      <section className="card">
        <header className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Latest content</h2>
        </header>
        <ul className="divide-y divide-slate-800">
          {(recentContent?.items ?? []).map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-100">{item.title}</p>
                <p className="truncate text-xs text-slate-500">{item.tags.join(', ')}</p>
              </div>
              <time className="shrink-0 text-xs text-slate-500">{formatDateTime(item.createdAt)}</time>
            </li>
          ))}
          {(recentContent?.items.length ?? 0) === 0 && (
            <li className="px-4 py-6 text-center text-sm text-slate-500">No content yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
