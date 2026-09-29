import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginatedMeta } from '../../types/api';
import { Button } from './Button';

interface PaginationProps {
  meta: PaginatedMeta;
  onPageChange: (page: number) => void;
}

/** Page controls driven entirely by the API's pagination metadata. */
export function Pagination({ meta, onPageChange }: PaginationProps) {
  if (meta.totalPages <= 1) return null;

  const { page, totalPages, totalItems } = meta;

  return (
    <nav className="flex items-center justify-between gap-3 px-4 py-3" aria-label="Pagination">
      <p className="text-xs text-slate-500">
        Page {page} of {totalPages} · {totalItems} item{totalItems === 1 ? '' : 's'}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!meta.hasPreviousPage}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={!meta.hasNextPage} onClick={() => onPageChange(page + 1)}>
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
