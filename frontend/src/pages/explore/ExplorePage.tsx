import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { FiArrowRight, FiBriefcase, FiHome, FiPackage, FiSearch } from 'react-icons/fi';
import { api, getErrorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import type { ApiResponse, MarketplaceListing, PaginationMeta, Property, Service } from '../../types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { CardGrid, Page } from '../../components/ui/page';
import { CardGridSkeleton, EmptyState, ErrorState } from '../../components/ui/loading';
import { Segmented } from '../../components/ui/tabs';
import { Pagination } from '../../components/ui/pagination';
import ListingCard from '../../components/listing/ListingCard';
import ServiceCard from '../../components/listing/ServiceCard';
import PropertyCard from '../../components/listing/PropertyCard';
import { useUrlFilters } from '../../components/browse/Browse';

type Group<T> = { items: T[]; total: number };
interface SearchResult {
  marketplace?: Group<MarketplaceListing>;
  services?: Group<Service>;
  accommodation?: Group<Property>;
}
type Tab = 'all' | 'marketplace' | 'services' | 'accommodation';

const SUGGESTIONS = ['Laptop', 'Textbooks', 'Tutoring', 'Hostel', 'Phone repair', 'Furniture'];
const LIMIT = 12;

export default function ExplorePage() {
  const f = useUrlFilters();
  const q = f.get('q');
  const tab = (f.get('type') || 'all') as Tab;
  const [input, setInput] = useState(q);
  useEffect(() => setInput(q), [q]);
  useDocumentTitle(q ? `Search: ${q}` : 'Search');

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['search', q, tab, f.page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<SearchResult>>('/search', {
        params: { q, type: tab, page: f.page, limit: LIMIT },
      });
      return res.data.data!;
    },
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    f.set({ q: input.trim(), type: null });
  };

  const total = (data?.marketplace?.total ?? 0) + (data?.services?.total ?? 0) + (data?.accommodation?.total ?? 0);
  const groupTotal = tab === 'all' ? total : data?.[tab]?.total ?? 0;
  const meta: PaginationMeta | undefined =
    tab === 'all'
      ? undefined
      : {
          total: groupTotal,
          page: f.page,
          limit: LIMIT,
          totalPages: Math.ceil(groupTotal / LIMIT),
          hasNext: f.page * LIMIT < groupTotal,
          hasPrev: f.page > 1,
        };

  const sections = [
    { key: 'marketplace' as const, title: 'Items', icon: FiPackage, browse: '/marketplace', items: data?.marketplace?.items ?? [], total: data?.marketplace?.total ?? 0 },
    { key: 'services' as const, title: 'Services', icon: FiBriefcase, browse: '/services', items: data?.services?.items ?? [], total: data?.services?.total ?? 0 },
    { key: 'accommodation' as const, title: 'Accommodation', icon: FiHome, browse: '/accommodation', items: data?.accommodation?.items ?? [], total: data?.accommodation?.total ?? 0 },
  ];

  const renderCards = (key: Tab, items: unknown[]) =>
    items.map((item: any) =>
      key === 'marketplace' ? (
        <ListingCard key={`m${item.id}`} listing={item} />
      ) : key === 'services' ? (
        <ServiceCard key={`s${item.id}`} service={item} />
      ) : (
        <PropertyCard key={`a${item.id}`} property={item} />
      )
    );

  return (
    <Page>
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Search CAV CONNECT</h1>
        <p className="mt-2 text-gray-500">Items, services and accommodation — all in one place.</p>
        <form onSubmit={submit} className="mt-6 flex gap-2" role="search">
          <div className="flex-1">
            <Input
              leadingIcon={<FiSearch />}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What are you looking for?"
              className="h-12 text-base"
              aria-label="Search"
              autoFocus={!q}
            />
          </div>
          <Button type="submit" size="lg">
            Search
          </Button>
        </form>
        {!q && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => f.set({ q: s })}
                className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-sm text-gray-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {q && (
        <div className="mt-10">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              {isLoading ? 'Searching…' : (
                <>
                  <span className="font-semibold text-gray-900 tabular-nums">{groupTotal}</span> result{groupTotal !== 1 ? 's' : ''} for “{q}”
                </>
              )}
            </p>
            <Segmented<Tab>
              value={tab}
              onChange={(t) => f.set({ type: t === 'all' ? null : t })}
              items={[
                { key: 'all', label: 'All' },
                { key: 'marketplace', label: 'Items', icon: FiPackage },
                { key: 'services', label: 'Services', icon: FiBriefcase },
                { key: 'accommodation', label: 'Accommodation', icon: FiHome },
              ]}
            />
          </div>

          {isLoading ? (
            <CardGridSkeleton count={8} />
          ) : error ? (
            <ErrorState message={getErrorMessage(error, 'Search failed')} onRetry={() => refetch()} />
          ) : groupTotal === 0 ? (
            <EmptyState icon={<FiSearch />} title={`Nothing found for “${q}”`} message="Check the spelling, try a more general word, or browse by category." />
          ) : tab === 'all' ? (
            <div className={isFetching ? 'space-y-12 opacity-60' : 'space-y-12'}>
              {sections
                .filter((s) => s.items.length)
                .map((s) => (
                  <section key={s.key}>
                    <div className="mb-4 flex items-end justify-between">
                      <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <s.icon className="h-5 w-5 text-gray-400" />
                        {s.title}
                        <span className="text-sm font-normal text-gray-400 tabular-nums">{s.total}</span>
                      </h2>
                      {s.total > 4 && (
                        <button
                          type="button"
                          onClick={() => f.set({ type: s.key })}
                          className="group inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
                        >
                          See all {s.total}
                          <FiArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      )}
                    </div>
                    <CardGrid>{renderCards(s.key, s.items.slice(0, 4))}</CardGrid>
                  </section>
                ))}
            </div>
          ) : (
            <div className={isFetching ? 'opacity-60' : ''}>
              <CardGrid>{renderCards(tab, data?.[tab]?.items ?? [])}</CardGrid>
              <Pagination meta={meta} onPageChange={(p) => f.set({ page: String(p) })} noun="results" />
            </div>
          )}

          <p className="mt-10 text-center text-sm text-gray-500">
            Looking for something specific?{' '}
            <Link to="/marketplace" className="font-semibold text-brand-700">
              Browse with filters
            </Link>
          </p>
        </div>
      )}
    </Page>
  );
}
