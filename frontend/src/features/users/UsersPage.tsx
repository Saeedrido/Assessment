import { useState, type FormEvent } from 'react';
import { Users as UsersIcon } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Alert, EmptyState } from '../../components/ui/Feedback';
import { Pagination } from '../../components/ui/Pagination';
import { useUsers } from './useUsers';
import { toErrorMessage } from '../../lib/apiClient';
import { formatDateTime, formatTokens } from '../../utils/format';
import type { UserRole } from '../../types/api';

const PAGE_SIZE = 20;

/** Admin-only user directory with role filter and text search. */
export function UsersPage() {
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<UserRole | ''>('');
  const [search, setSearch] = useState('');

  const query = {
    page,
    pageSize: PAGE_SIZE,
    role: role || undefined,
    q: search.trim() || undefined,
  };

  const { data, isPending, isError, error, refetch } = useUsers(query);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-50">Users</h1>
        <p className="text-sm text-slate-400">Every account and its live token balance.</p>
      </div>

      <form onSubmit={onSearch} className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="user-search">
          Search users
        </label>
        <input
          id="user-search"
          className="input max-w-xs"
          placeholder="Search by name or email…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          className="input w-40"
          value={role}
          aria-label="Filter by role"
          onChange={(event) => {
            setRole(event.target.value as UserRole | '');
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          <option value="admin">Admins</option>
          <option value="user">Members</option>
        </select>
      </form>

      {isError && <Alert onRetry={() => void refetch()}>{toErrorMessage(error)}</Alert>}

      <div className="card overflow-hidden">
        {isPending ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">Loading users…</p>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="p-4">
            <EmptyState title="No users match" description="Try a different search or role filter." />
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-slate-800 bg-slate-900/40">
              <tr>
                <th className="table-header">User</th>
                <th className="table-header">Role</th>
                <th className="table-header">Balance</th>
                <th className="table-header">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data!.items.map((user) => (
                <tr key={user.id} className="hover:bg-slate-800/40">
                  <td className="table-cell">
                    <p className="font-medium text-slate-100">{user.displayName}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </td>
                  <td className="table-cell">
                    <Badge tone={user.role === 'admin' ? 'info' : 'neutral'}>{user.role}</Badge>
                  </td>
                  <td className="table-cell font-mono text-xs">{formatTokens(user.tokenBalance)}</td>
                  <td className="table-cell whitespace-nowrap text-xs text-slate-500">
                    {formatDateTime(user.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data && <Pagination meta={data.meta} onPageChange={setPage} />}
      </div>
    </div>
  );
}

/** Placeholder view for admins without the users permission. */
export function UsersForbidden() {
  return (
    <Card>
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <UsersIcon className="h-6 w-6 text-slate-600" aria-hidden="true" />
        <p className="text-sm font-medium text-slate-200">Admins only</p>
        <p className="max-w-sm text-xs text-slate-500">
          The user directory is restricted. Switch to a seeded admin account to view it.
        </p>
      </div>
    </Card>
  );
}
