import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { PaginationMeta } from '../../types';
import { cn } from '../../lib/utils';

function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('…');
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

/** The one pagination control used across public pages and the admin console. */
export function Pagination({
  meta,
  onPageChange,
  noun = 'results',
  className,
}: {
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
  noun?: string;
  className?: string;
}) {
  if (!meta || meta.totalPages <= 1) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  const go = (p: number) => {
    onPageChange(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navBtn =
    'inline-flex h-9 items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-card transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-col items-center justify-between gap-3 pt-6 sm:flex-row', className)}
    >
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium text-gray-900 tabular-nums">{from}–{to}</span> of{' '}
        <span className="font-medium text-gray-900 tabular-nums">{meta.total}</span> {noun}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className={navBtn} disabled={!meta.hasPrev} onClick={() => go(meta.page - 1)}>
          <FiChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </button>
        <div className="hidden items-center gap-1 sm:flex">
          {pageList(meta.page, meta.totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="px-1.5 text-sm text-gray-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => go(p)}
                aria-current={p === meta.page ? 'page' : undefined}
                className={cn(
                  'h-9 min-w-9 rounded-lg px-2 text-sm font-medium tabular-nums transition-colors',
                  p === meta.page ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                {p}
              </button>
            )
          )}
        </div>
        <span className="px-2 text-sm text-gray-600 sm:hidden">
          {meta.page} / {meta.totalPages}
        </span>
        <button type="button" className={navBtn} disabled={!meta.hasNext} onClick={() => go(meta.page + 1)}>
          <span className="hidden sm:inline">Next</span>
          <FiChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

export default Pagination;
