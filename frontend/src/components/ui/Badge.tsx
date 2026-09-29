import type { ReactNode } from 'react';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-800 text-slate-300 ring-slate-700',
  info: 'bg-sky-500/10 text-sky-300 ring-sky-500/30',
  success: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  danger: 'bg-red-500/10 text-red-300 ring-red-500/30',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Maps a domain status onto a colour, so status colours stay consistent. */
export function StatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === 'SUCCESS' || status === 'PROMOTED'
      ? 'success'
      : status === 'PENDING' || status === 'PROCESSING' || status === 'STORED'
        ? 'info'
        : status === 'TIMEOUT'
          ? 'warning'
          : 'danger';

  return <Badge tone={tone}>{status}</Badge>;
}
