import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { TextAreaField, TextField } from '../../components/ui/Field';
import { Alert, EmptyState } from '../../components/ui/Feedback';
import { Pagination } from '../../components/ui/Pagination';
import { useContentList } from './useContent';
import { useCreateContent } from '../ai/useAi';
import { toErrorMessage } from '../../lib/apiClient';
import { formatDateTime, truncate } from '../../utils/format';

const PAGE_SIZE = 10;

/** Content library: server-side search, tag filter and creation. */
export function ContentListPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [isCreateOpen, setCreateOpen] = useState(false);

  const { data, isPending, isError, error, refetch } = useContentList({ page, pageSize: PAGE_SIZE, q: query || undefined });

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(searchInput.trim());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Content</h1>
          <p className="text-sm text-slate-400">Published items, searchable with MongoDB full-text search.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New content
        </Button>
      </div>

      <form onSubmit={onSearch} className="flex gap-2">
        <label className="sr-only" htmlFor="content-search">
          Search content
        </label>
        <input
          id="content-search"
          className="input max-w-md"
          placeholder="Search title and body…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          <Search className="h-4 w-4" aria-hidden="true" />
          Search
        </Button>
        {query && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearchInput('');
              setQuery('');
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {isError && <Alert onRetry={() => void refetch()}>{toErrorMessage(error)}</Alert>}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-800 bg-slate-900/40">
            <tr>
              <th className="table-header">Title</th>
              <th className="table-header">Tags</th>
              <th className="table-header">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {(data?.items ?? []).map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/40">
                <td className="table-cell">
                  <Link to={`/content/${item.id}`} className="font-medium text-slate-100 hover:text-brand-400">
                    {item.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500">{truncate(item.body, 120)}</p>
                </td>
                <td className="table-cell">
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                </td>
                <td className="table-cell whitespace-nowrap text-xs text-slate-500">
                  {formatDateTime(item.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {isPending && <p className="px-4 py-6 text-center text-sm text-slate-500">Loading content…</p>}

        {!isPending && (data?.items.length ?? 0) === 0 && (
          <div className="p-4">
            <EmptyState
              title="No content found"
              description={query ? `Nothing matches “${query}”.` : 'Publish the first item to get started.'}
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New content
                </Button>
              }
            />
          </div>
        )}

        {data && <Pagination meta={data.meta} onPageChange={setPage} />}
      </div>

      <CreateContentModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateContentModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const createContent = useCreateContent();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await createContent.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        // Comma-separated input is friendlier than a tag picker for this scope.
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      setTitle('');
      setBody('');
      setTags('');
      onClose();
    } catch {
      // The error is rendered from the mutation state below.
    }
  }

  return (
    <Modal isOpen={isOpen} title="New content" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        {createContent.isError && <Alert>{toErrorMessage(createContent.error)}</Alert>}

        <TextField
          id="content-title"
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={200}
        />
        <TextAreaField
          id="content-body"
          label="Body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          rows={6}
          hint="Between 10 and 20,000 characters."
        />
        <TextField
          id="content-tags"
          label="Tags"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="ai, tokens, architecture"
          hint="Comma separated."
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={createContent.isPending}>
            Publish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
