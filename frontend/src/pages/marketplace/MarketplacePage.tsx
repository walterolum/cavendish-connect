import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { FiPackage, FiPlus } from 'react-icons/fi';
import { marketplaceApi, categoriesApi } from '../../services/marketplace.service';
import { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/utils';
import { CONDITION_LABELS } from '../../lib/labels';
import { useDocumentTitle, useNewArrivals, LIVE_REFRESH_MS } from '../../lib/hooks';
import { ButtonLink } from '../../components/ui/button';
import { PageHeader } from '../../components/ui/page';
import { CardGridSkeleton, EmptyState, ErrorState } from '../../components/ui/loading';
import MarketCard from '../../components/market/MarketCard';
import { ActiveFilter, BrowseLayout, FilterGroup, OptionList, PriceRange, useUrlFilters } from '../../components/browse/Browse';

export default function MarketplacePage() {
  useDocumentTitle('Browse items');
  const f = useUrlFilters();
  const search = f.get('search');
  const category = f.get('category');
  const condition = f.get('condition');
  const sort = f.get('sort') || 'newest';
  const minPrice = f.get('minPrice');
  const maxPrice = f.get('maxPrice');

  const query = {
    page: f.page,
    limit: 12,
    search: search || undefined,
    category: category || undefined,
    condition: condition || undefined,
    sort,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
  };

  const { data, isLoading, isPlaceholderData, error, refetch } = useQuery({
    queryKey: ['marketplace', 'listings', query],
    queryFn: () => marketplaceApi.getListings(query),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  const fresh = useNewArrivals(data?.data.map((l) => l.id));

  const { data: categories = [] } = useQuery({
    queryKey: ['marketplace', 'categories'],
    queryFn: () => categoriesApi.getCategories(),
    staleTime: 5 * 60_000,
  });

  const categoryName = categories.find((c) => c.slug === category)?.name ?? category;
  const active: ActiveFilter[] = [
    search && { key: 'search', label: `“${search}”`, onRemove: () => f.set({ search: null }) },
    category && { key: 'category', label: categoryName, onRemove: () => f.set({ category: null }) },
    condition && { key: 'condition', label: CONDITION_LABELS[condition] ?? condition, onRemove: () => f.set({ condition: null }) },
    (minPrice || maxPrice) && {
      key: 'price',
      label: `${minPrice ? formatMoney(minPrice) : 'Any'} – ${maxPrice ? formatMoney(maxPrice) : 'Any'}`,
      onRemove: () => f.set({ minPrice: null, maxPrice: null }),
    },
  ].filter(Boolean) as ActiveFilter[];

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Browse Items"
        description="Second-hand and new items from verified members of the Cavendish community."
        actions={
          <ButtonLink to="/marketplace/create">
            <FiPlus className="h-4 w-4" />
            Sell an item
          </ButtonLink>
        }
      />
      <BrowseLayout
        searchPlaceholder="Search items, e.g. laptop, calculator, mattress"
        search={search}
        onSearch={(q) => f.set({ search: q })}
        sort={sort}
        onSort={(s) => f.set({ sort: s === 'newest' ? null : s })}
        activeFilters={active}
        onClearAll={() => f.clear()}
        total={data?.meta?.total}
        noun={data?.meta?.total === 1 ? 'item' : 'items'}
        meta={data?.meta}
        onPage={(p) => f.set({ page: String(p) })}
        filters={
          <>
            <FilterGroup title="Category">
              <OptionList
                allLabel="All categories"
                value={category}
                onChange={(v) => f.set({ category: v })}
                options={categories.map((c) => ({ value: c.slug, label: c.name }))}
              />
            </FilterGroup>
            <FilterGroup title="Condition">
              <OptionList
                allLabel="Any condition"
                value={condition}
                onChange={(v) => f.set({ condition: v })}
                options={Object.entries(CONDITION_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </FilterGroup>
            <FilterGroup title="Price (UGX)">
              <PriceRange min={minPrice} max={maxPrice} onChange={(lo, hi) => f.set({ minPrice: lo, maxPrice: hi })} />
            </FilterGroup>
          </>
        }
      >
        {isLoading ? (
          <CardGridSkeleton count={6} columns={3} />
        ) : error ? (
          <ErrorState message={getErrorMessage(error, "Couldn't load listings")} onRetry={() => refetch()} />
        ) : !data?.data.length ? (
          <EmptyState
            icon={<FiPackage />}
            title={active.length ? 'No items match your filters' : 'No items yet'}
            message={active.length ? 'Try a broader search or remove a filter.' : 'Be the first to sell something to the community.'}
          >
            {active.length ? (
              <ButtonLink to="/marketplace/browse" variant="outline">
                Clear filters
              </ButtonLink>
            ) : (
              <ButtonLink to="/marketplace/create">Sell an item</ButtonLink>
            )}
          </EmptyState>
        ) : (
          <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <div className="stagger grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {data.data.map((listing) => (
                <MarketCard key={listing.id} listing={listing} isNew={fresh.has(listing.id)} />
              ))}
            </div>
          </div>
        )}
      </BrowseLayout>
    </div>
  );
}
