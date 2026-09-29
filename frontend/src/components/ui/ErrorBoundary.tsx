import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Shown instead of the default panel; receives the error. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors so a single broken view cannot blank the console.
 *
 * Resetting remounts the subtree, which is enough to recover from a transient
 * data problem without a full page reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaced in the browser console; the API is the source of truth for
    // server-side failures, so this is only a last-resort breadcrumb.
    console.error('Unhandled UI error', error, info.componentStack);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;
    if (fallback) return fallback(error, this.reset);

    return (
      <div role="alert" className="card mx-auto max-w-lg p-6 text-center">
        <h2 className="text-sm font-semibold text-slate-100">Something went wrong</h2>
        <p className="mt-2 text-xs text-slate-400">{error.message}</p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-4 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500"
        >
          Try again
        </button>
      </div>
    );
  }
}
