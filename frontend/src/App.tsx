import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ContentListPage } from './features/content/ContentListPage';
import { ContentDetailPage } from './features/content/ContentDetailPage';
import { AiRunsPage } from './features/ai/AiRunsPage';
import { TokensPage } from './features/tokens/TokensPage';
import { MediaPage } from './features/media/MediaPage';
import { UsersPage, UsersForbidden } from './features/users/UsersPage';
import { EmptyState } from './components/ui/Feedback';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useAuth } from './providers/AuthProvider';

/** Route table. Keeping it in one file makes the surface easy to review. */
export function App() {
  return (
    <AppLayout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/content" element={<ContentListPage />} />
          <Route path="/content/:id" element={<ContentDetailPage />} />
          <Route path="/ai-runs" element={<AiRunsPage />} />
          <Route path="/tokens" element={<TokensPage />} />
          <Route path="/media" element={<MediaPage />} />
          <Route
            path="/users"
            element={
              <AdminOnly>
                <UsersPage />
              </AdminOnly>
            }
          />
          <Route
            path="*"
            element={<EmptyState title="Page not found" description="Check the address in the URL bar." />}
          />
        </Routes>
      </ErrorBoundary>
    </AppLayout>
  );
}

/** Renders `children` for admins and an explanation for everyone else. */
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  return isAdmin ? <>{children}</> : <UsersForbidden />;
}
