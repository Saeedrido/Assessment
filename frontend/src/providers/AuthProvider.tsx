import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getActiveUserId, setActiveUserId } from '../lib/apiClient';
import { userApi } from '../lib/userApi';
import type { User } from '../types/api';

/**
 * Development identity for the console.
 *
 * The backend authenticates with an `x-user-id` header, so the console needs
 * to know which seeded account to act as. In a real deployment this context
 * would be replaced by an OIDC/JWT session; everything downstream only depends
 * on `user` and `isAdmin`.
 */

interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  activeUserId: string;
  switchUser: (userId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState(getActiveUserId);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['current-user', userId],
    queryFn: userApi.me,
    // The identity is only re-read when the user is explicitly switched.
    staleTime: Infinity,
    retry: false,
    // Nothing can be fetched before a seeded account is chosen.
    enabled: userId !== '',
  });

  const switchUser = useCallback(
    (nextUserId: string) => {
      if (nextUserId === userId) return;

      // Every cached response belongs to the account that requested it, and the
      // query keys are not identity-scoped. Dropping the cache is what stops
      // the previous user's balances and ledgers from lingering on screen.
      queryClient.clear();
      setActiveUserId(nextUserId);
      setUserId(nextUserId);
    },
    [queryClient, userId],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data ?? null,
      isAdmin: data?.role === 'admin',
      isLoading: isLoading || userId === '',
      error: error instanceof Error ? error.message : null,
      activeUserId: userId,
      switchUser,
    }),
    [data, error, isLoading, switchUser, userId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
