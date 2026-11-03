import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiSearch, FiSliders, FiX } from 'react-icons/fi';
import { PaginationMeta } from '../../types';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input, Select } from '../ui/input';
import { Pagination } from '../ui/pagination';

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'popular', label: 'Most viewed' },
  { value: 'oldest', label: 'Oldest' },
];

/** Filters live in the URL, so results are shareable and survive refresh/back. */
export function useUrlFilters() {
  const [params, setParams] = useSearchParams();
  const get = (key: string) => params.get(key) ?? '';
  const set = (updates: Record<string, string | null | undefined>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (resetPage && !('page' in updates)) next.delete('page');
    setParams(next, { replace: !('page' in updates) });
  };
  const clear = (keep: string[] = []) => {
    const next = new URLSearchParams();
    keep.forEach((k) => params.get(k) && next.set(k, params.get(k)!));
    setParams(next);
  };
  return { params, get, set, clear, page: Math.max(1, Number(params.get('page')) || 1) };
}

export function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
      {children}
    </div>
  );
}

/** Single-choice list (e.g. categories). */
export function OptionList({
  options,
  value,
  onChange,
  allLabel = 'All',
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  allLabel?: string;
}) {
  const item = (active: boolean) =>
    cn(
      'block w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
      active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    );
  return (
    <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
      <button type="button" className={item(!value)} onClick={() => onChange('')}>
        {allLabel}
      </button>
      {options.map((o) => (
        <button key={o.value} type="button" className={item(value === o.value)} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Min/max price that applies after the user stops typing. */
export function PriceRange({
  min,
  max,
  onChange,
}: {
  min: string;
  max: string;
  onChange: (min: string, max: string) => void;
}) {
  const [lo, setLo] = useState(min);
  const [hi, setHi] = useState(max);
  useEffect(() => setLo(min), [min]);
  useEffect(() => setHi(max), [max]);
  useEffect(() => {
    if (lo === min && hi === max) return;
    const t = setTimeout(() => onChange(lo, hi), 500);
    return () => clearTimeout(t);
  }, [lo, hi]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center gap-2">
      <Input type="number" inputMode="numeric" min={0} placeholder="Min" aria-label="Minimum price" value={lo} onChange={(e) => setLo(e.target.value)} />
      <span className="text-gray-300">–</span>
      <Input type="number" inputMode="numeric" min={0} placeholder="Max" aria-label="Maximum price" value={hi} onChange={(e) => setHi(e.target.value)} />
    </div>
  );
}

export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

/**
 * Standard browse page body: search + sort bar, filter sidebar (drawer on
 * mobile), active filter chips, results and pagination.
 */
export function BrowseLayout({
  searchPlaceholder,
  search,
  onSearch,
  sort,
  onSort,
  sortOptions = SORT_OPTIONS,
  filters,
  activeFilters,
  onClearAll,
  total,
  noun,
  meta,
  onPage,
  children,
}: {
  searchPlaceholder: string;
  search: string;
  onSearch: (q: string) => void;
  sort: string;
  onSort: (s: string) => void;
  sortOptions?: { value: string; label: string }[];
  filters: ReactNode;
  activeFilters: ActiveFilter[];
  onClearAll: () => void;
  total?: number;
  noun: string;
  meta?: PaginationMeta;
  onPage: (p: number) => void;
  children: ReactNode;
}) {
  const [query, setQuery] = useState(search);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setQuery(search), [search]);

  useEffect(() => {
    if (!drawer) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [drawer]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(query.trim());
  };

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <form onSubmit={submit} className="relative flex-1" role="search">
          <Input
            leadingIcon={<FiSearch />}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pr-10"
            aria-label={searchPlaceholder}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                onSearch('');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 hover:text-gray-700"
              aria-label="Clear search"
            >
              <FiX className="h-4 w-4" />
            </button>
          )}
        </form>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDrawer(true)} className="h-11 lg:hidden">
            <FiSliders className="h-4 w-4" />
            Filters
            {activeFilters.length > 0 && (
              <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white tabular-nums">{activeFilters.length}</span>
            )}
          </Button>
          <div className="w-full sm:w-52">
            <Select value={sort} onChange={(e) => onSort(e.target.value)} aria-label="Sort by">
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  Sort: {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="flex gap-8">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-24 space-y-5 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-card">{filters}</div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {total !== undefined && (
              <p className="mr-2 text-sm text-gray-500">
                <span className="font-semibold text-gray-900 tabular-nums">{total.toLocaleString()}</span> {noun}
              </p>
            )}
            {activeFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={f.onRemove}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-1 pl-3 pr-2 text-xs font-medium text-brand-800 transition-colors hover:bg-brand-100"
              >
                {f.label}
                <FiX className="h-3.5 w-3.5" aria-label={`Remove ${f.label}`} />
              </button>
            ))}
            {activeFilters.length > 1 && (
              <button type="button" onClick={onClearAll} className="text-xs font-semibold text-gray-500 hover:text-gray-900">
                Clear all
              </button>
            )}
          </div>
          {children}
          <Pagination meta={meta} onPageChange={onPage} noun={noun} />
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 animate-fade-in bg-gray-950/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm animate-fade-in flex-col bg-white shadow-overlay">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold">Filters</h2>
              <button type="button" onClick={() => setDrawer(false)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Close filters">
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">{filters}</div>
            <div className="pb-safe grid grid-cols-2 gap-2 border-t border-gray-100 p-4">
              <Button variant="outline" onClick={onClearAll}>
                Reset
              </Button>
              <Button onClick={() => setDrawer(false)}>Show {total !== undefined ? total : ''} results</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
