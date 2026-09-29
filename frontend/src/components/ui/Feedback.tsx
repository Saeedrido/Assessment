import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';

export function Alert({
  tone = 'danger',
  title,
  children,
  onRetry,
}: {
  tone?: 'danger' | 'info' | 'warning';
  title?: string;
  children: ReactNode;
  onRetry?: () => void;
}) {
  const tones = {
    danger: 'border-red-500/40 bg-red-500/10 text-red-200',
    info: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
    warning: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  } as const;

  return (
    <div role="alert" className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm ${tones[tone]}`}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        <div className="break-words">{children}</div>
      </div>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      )}
    </div>
  );
}

/** Consistent empty state: an explanation, not a blank table. */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-800 px-6 py-10 text-center">
      <Inbox className="h-6 w-6 text-slate-600" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {description && <p className="max-w-sm text-xs text-slate-500">{description}</p>}
      {action}
    </div>
  );
}
