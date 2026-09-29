import { useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/Field';
import { Alert, EmptyState } from '../../components/ui/Feedback';
import { useContentDetail } from './useContent';
import { useAiRuns, useSummarize } from '../ai/useAi';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { toErrorMessage } from '../../lib/apiClient';
import { formatDateTime, formatLatency, formatTokens } from '../../utils/format';
import type { AiRun, SummarizeResult } from '../../types/api';

export function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: item, isPending, isError, error, refetch } = useContentDetail(id);
  const { data: runs } = useAiRuns(id);
  const { data: balance } = useTokenBalance();

  if (isPending) return <p className="text-sm text-slate-500">Loading content…</p>;
  if (isError) return <Alert onRetry={() => void refetch()}>{toErrorMessage(error)}</Alert>;
  if (!item) return null;

  const latestSuccess = runs?.items.find((run) => run.status === 'SUCCESS' && run.output);

  return (
    <div className="space-y-4">
      <div>
        <Link to="/content" className="text-xs text-slate-500 hover:text-slate-300">
          ← Back to content
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">{item.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>by {item.createdBy.displayName}</span>
          <span aria-hidden="true">·</span>
          <time>{formatDateTime(item.createdAt)}</time>
          {item.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card title="Body">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{item.body}</p>
        </Card>

        <div className="space-y-4">
          <SummarizePanel contentId={item.id} balance={balance?.balance ?? null} />

          <Card title="Latest summary" description="Most recent successful run for this item.">
            {latestSuccess?.output ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{latestSuccess.output}</p>
            ) : (
              <p className="text-sm text-slate-500">No summary has been generated yet.</p>
            )}
          </Card>
        </div>
      </div>

      <AiRunHistory runs={runs?.items ?? []} />
    </div>
  );
}

function SummarizePanel({ contentId, balance }: { contentId: string; balance: number | null }) {
  const [tone, setTone] = useState('neutral');
  const [length, setLength] = useState('short');
  const summarize = useSummarize(contentId);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    summarize.mutate({ tone, length });
  }

  // A run costs tokens up front and pays a reward back on success, so the
  // console says so rather than letting the balance silently change.
  const cannotAfford = balance !== null && balance <= 0;

  return (
    <Card title="AI summarisation" description="Costs 1 token. A successful run pays 5 tokens back.">
      <form onSubmit={onSubmit} className="space-y-3">
        {summarize.isError && (
          <Alert tone="danger" title="Summarisation failed">
            {toErrorMessage(summarize.error)}
          </Alert>
        )}

        {summarize.isSuccess && summarize.data && <SummarizeOutcome result={summarize.data} />}

        <SelectField id="summarize-tone" label="Tone" value={tone} onChange={(event) => setTone(event.target.value)}>
          <option value="neutral">Neutral</option>
          <option value="friendly">Friendly</option>
          <option value="formal">Formal</option>
          <option value="persuasive">Persuasive</option>
        </SelectField>

        <SelectField id="summarize-length" label="Length" value={length} onChange={(event) => setLength(event.target.value)}>
          <option value="short">Short</option>
          <option value="medium">Medium</option>
          <option value="long">Long</option>
        </SelectField>

        <Button
          type="submit"
          className="w-full"
          isLoading={summarize.isPending}
          disabled={cannotAfford}
          title={cannotAfford ? 'You need at least one token to request a summary.' : undefined}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Generate summary
        </Button>

        {cannotAfford && <p className="text-xs text-amber-400">Your balance is empty.</p>}
      </form>
    </Card>
  );
}

function SummarizeOutcome({ result }: { result: SummarizeResult }) {
  const { run } = result;

  if (run.status === 'SUCCESS') {
    return (
      <Alert tone="info" title={`Reward: +${formatTokens(result.tokensAwarded)} tokens`}>
        Completed in {formatLatency(result.latencyMs)} using the {run.provider} provider. New balance:{' '}
        {formatTokens(result.totalTokenBalance)} TWD.
      </Alert>
    );
  }

  return (
    <Alert tone="warning" title={`Run ${run.status.toLowerCase()}`}>
      {run.errorMessage ?? 'The provider did not return a summary.'} No tokens were charged.
    </Alert>
  );
}

function AiRunHistory({ runs }: { runs: AiRun[] }) {
  if (runs.length === 0) {
    return (
      <EmptyState
        title="No AI runs yet"
        description="Request a summary to see its latency, status and token reward here."
      />
    );
  }

  return (
    <div className="card overflow-hidden">
      <header className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-100">AI run history</h2>
      </header>
      <table className="w-full">
        <thead className="border-b border-slate-800 bg-slate-900/40">
          <tr>
            <th className="table-header">Status</th>
            <th className="table-header">Options</th>
            <th className="table-header">Latency</th>
            <th className="table-header">Reward</th>
            <th className="table-header">When</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {runs.map((run) => (
            <tr key={run.id}>
              <td className="table-cell">
                <StatusBadge status={run.status} />
              </td>
              <td className="table-cell text-xs text-slate-400">
                {run.tone} / {run.length}
                <span className="ml-1 text-slate-600">· prompt {run.promptVersion}</span>
              </td>
              <td className="table-cell font-mono text-xs">{formatLatency(run.latencyMs)}</td>
              <td className="table-cell font-mono text-xs">
                {run.tokensAwarded > 0 ? `+${formatTokens(run.tokensAwarded)}` : '0'}
              </td>
              <td className="table-cell whitespace-nowrap text-xs text-slate-500">
                {formatDateTime(run.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
