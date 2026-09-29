import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useAuth } from '../../providers/AuthProvider';
import { useSeedUsers } from '../../features/users/useSeedUsers';
import { Alert } from '../ui/Feedback';
import type { ReactNode } from 'react';

/**
 * Application chrome.
 *
 * The backend identifies callers by `x-user-id`, so the console needs an
 * identity before it can do anything. `useSeedUsers` discovers the seeded
 * accounts and selects an admin by default, which makes a fresh clone usable
 * immediately after `npm run seed`.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin, isLoading, error, activeUserId, switchUser } = useAuth();
  const { data: seedData } = useSeedUsers();

  useEffect(() => {
    const users = seedData?.users;
    if (users && users.length > 0 && !activeUserId) {
      const admin = users.find((candidate) => candidate.role === 'admin') ?? users[0]!;
      switchUser(admin.id);
    }
  }, [activeUserId, seedData, switchUser]);

  if (error && !user) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <Alert title="Could not reach the API">
          {error} Start the backend with <code className="font-mono">npm run dev:backend</code> and run{' '}
          <code className="font-mono">npm run seed</code> to create the demo accounts.
        </Alert>
      </main>
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          {isLoading ? <p className="text-sm text-slate-500">Loading console…</p> : children}
        </main>
      </div>
    </div>
  );
}
