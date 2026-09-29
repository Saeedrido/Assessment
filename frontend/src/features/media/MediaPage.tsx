import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Alert, EmptyState } from '../../components/ui/Feedback';
import { mediaApi } from '../../lib/mediaApi';
import { toErrorMessage } from '../../lib/apiClient';
import { formatBytes, formatDateTime } from '../../utils/format';
import { useAuth } from '../../providers/AuthProvider';

/** Media console: upload to staging storage and promote to permanent storage. */
export function MediaPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaApi.list(1, 20),
  });

  const upload = useMutation({
    mutationFn: (file: File) => mediaApi.upload(file),
    onSuccess: () => {
      setSelectedFile(null);
      setActionError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      void queryClient.invalidateQueries({ queryKey: ['media'] });
    },
  });

  const promote = useMutation({
    mutationFn: (id: string) => mediaApi.promote(id),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['media'] });
    },
    onError: (mutationError) => setActionError(toErrorMessage(mutationError)),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedFile) return;
    upload.mutate(selectedFile, { onError: (mutationError) => setActionError(toErrorMessage(mutationError)) });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-50">Media</h1>
        <p className="text-sm text-slate-400">
          Uploads land in staging storage; promotion copies them into permanent object storage.
        </p>
      </div>

      {isError && <Alert onRetry={() => void refetch()}>{toErrorMessage(error)}</Alert>}
      {actionError && <Alert>{actionError}</Alert>}

      {isAdmin && (
        <Card title="Upload" description="Images and video up to the configured size limit.">
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <label className="label" htmlFor="media-file">
                File
              </label>
              <input
                id="media-file"
                ref={fileInputRef}
                type="file"
                className="input"
                accept="image/*,video/*,application/pdf"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <Button type="submit" isLoading={upload.isPending} disabled={!selectedFile}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload
            </Button>
          </form>
        </Card>
      )}

      <div className="card overflow-hidden">
        <header className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Assets</h2>
        </header>

        {isPending ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">Loading media…</p>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="p-4">
            <EmptyState title="No media yet" description="Uploads appear here with their storage references." />
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-slate-800 bg-slate-900/40">
              <tr>
                <th className="table-header">File</th>
                <th className="table-header">Status</th>
                <th className="table-header">Storage</th>
                <th className="table-header">Uploaded</th>
                {isAdmin && <th className="table-header" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data!.items.map((asset) => (
                <tr key={asset.id}>
                  <td className="table-cell">
                    <p className="font-medium text-slate-100">{asset.originalFilename}</p>
                    <p className="text-xs text-slate-500">
                      {asset.mimeType} · {formatBytes(asset.sizeBytes)}
                    </p>
                  </td>
                  <td className="table-cell">
                    <StatusBadge status={asset.status} />
                  </td>
                  <td className="table-cell text-xs text-slate-500">
                    <p>staging: {asset.source.provider}</p>
                    {asset.destination && <p className="text-emerald-400">permanent: {asset.destination.provider}</p>}
                  </td>
                  <td className="table-cell whitespace-nowrap text-xs text-slate-500">
                    {formatDateTime(asset.createdAt)}
                  </td>
                  {isAdmin && (
                    <td className="table-cell text-right">
                      {asset.status === 'STORED' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          isLoading={promote.isPending && promote.variables === asset.id}
                          onClick={() => promote.mutate(asset.id)}
                        >
                          Promote
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
