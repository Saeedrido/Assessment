import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { Alert, EmptyState } from '../../components/ui/Feedback';
import { useUserAiRuns } from './useUserAiRuns';
import { toErrorMessage } from '../../lib/apiClient';
import { formatDateTime, formatLatency, formatTokens, shortHash } from '../../utils/format';

const PAGE_SIZE = 20;

/** Every AI run the current user has triggered, with latency and reward. */
export function AiRunsPage() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useUserAiRuns({ page, pageSize: PAGE_SIZE });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-50">AI runs</h1>
        <p className="text-sm text-slate-400">
          Summarisation attempts with their outcome, latency and token reward.
        </p>
      </div>

      {isError && <Alert onRetry={() => void refetch()}>{toErrorMessage(error)}</Alert>}

      <div className="card overflow-hidden">
        {isPending ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">Loading runs…</p>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No runs yet"
              description="Open a content item and request a summary to see it recorded here."
            />
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-slate-800 bg-slate-900/40">
              <tr>
                <th className="table-header">Status</th>
                <th className="table-header">Content</th>
                <th className="table-header">Options</th>
                <th className="table-header">Provider</th>
                <th className="table-header">Latency</th>
                <th className="table-header">Reward</th>
                <th className="table-header">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data!.items.map((run) => (
                <tr key={run.id}>
                  <td className="table-cell">
                    <StatusBadge status={run.status} />
                    {run.errorMessage && <p className="mt-1 text-xs text-slate-500">{run.errorMessage}</p>}
                  </td>
                  <td className="table-cell">
                    <Link to={`/content/${run.contentId}`} className="text-brand-400 hover:underline">
                      {shortHash(run.contentId)}
                    </Link>
                  </td>
                  <td className="table-cell text-xs text-slate-400">
                    {run.tone} / {run.length}
                  </td>
                  <td className="table-cell text-xs text-slate-500">
                    {run.provider}
                    <span className="ml-1 text-slate-600">· {run.promptVersion}</span>
                  </td>
                  <td className="table-cell font-mono text-xs">{formatLatency(run.latencyMs)}</td>
                  <td className="table-cell font-mono text-xs text-emerald-400">
                    {run.tokensAwarded > 0 ? `+${formatTokens(run.tokensAwarded)}` : '—'}
                  </td>
                  <td className="table-cell whitespace-nowrap text-xs text-slate-500">
                    {formatDateTime(run.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data && <Pagination meta={data.meta} onPageChange={setPage} />}
      </div>

      <Card title="How rewards work">
        <p className="text-sm leading-relaxed text-slate-400">
          A summarisation request debits one token. If the provider returns a summary, the run is recorded as
          <span className="text-slate-200"> SUCCESS</span> and five tokens are credited in the same transaction.
          A failed or timed-out run is recorded with its status, awards nothing, and the debit is rolled back — so
          the ledger always shows what actually happened.
        </p>
      </Card>
    </div>
  );
}
