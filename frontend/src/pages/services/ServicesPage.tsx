import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { FiBriefcase, FiPlus } from 'react-icons/fi';
import { servicesApi } from '../../services/listing.service';
import { categoriesApi } from '../../services/marketplace.service';
import { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/utils';
import { useDocumentTitle, useNewArrivals, LIVE_REFRESH_MS } from '../../lib/hooks';
import { ButtonLink } from '../../components/ui/button';
import { PageHeader } from '../../components/ui/page';
import { CardGridSkeleton, EmptyState, ErrorState } from '../../components/ui/loading';
import ProviderCard from '../../components/services/ProviderCard';
import { ActiveFilter, BrowseLayout, FilterGroup, OptionList, PriceRange, useUrlFilters } from '../../components/browse/Browse';

export default function ServicesPage() {
  useDocumentTitle('Find services');
  const f = useUrlFilters();
  const search = f.get('search');
  const category = f.get('category');
  const sort = f.get('sort') || 'newest';
  const minPrice = f.get('minPrice');
  const maxPrice = f.get('maxPrice');

  const query = {
    page: f.page,
    limit: 12,
    search: search || undefined,
    category: category || undefined,
    sort,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
  };

  const { data, isLoading, isPlaceholderData, error, refetch } = useQuery({
    queryKey: ['services', 'list', query],
    queryFn: () => servicesApi.getServices(query),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  const fresh = useNewArrivals(data?.data.map((x) => x.id));

  const { data: categories = [] } = useQuery({
    queryKey: ['service-categories'],
    queryFn: () => categoriesApi.getServiceCategories(),
    staleTime: 5 * 60_000,
  });

  const active: ActiveFilter[] = [
    search && { key: 'search', label: `“${search}”`, onRemove: () => f.set({ search: null }) },
    category && {
      key: 'category',
      label: categories.find((c) => c.slug === category)?.name ?? category,
      onRemove: () => f.set({ category: null }),
    },
    (minPrice || maxPrice) && {
      key: 'price',
      label: `${minPrice ? formatMoney(minPrice) : 'Any'} – ${maxPrice ? formatMoney(maxPrice) : 'Any'}`,
      onRemove: () => f.set({ minPrice: null, maxPrice: null }),
    },
  ].filter(Boolean) as ActiveFilter[];

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Find Services"
        description="Tutors, designers, photographers, technicians and more — from your own community."
        actions={
          <ButtonLink to="/services/create">
            <FiPlus className="h-4 w-4" />
            Offer a service
          </ButtonLink>
        }
      />
      <BrowseLayout
        searchPlaceholder="Search services, e.g. tutoring, logo design, phone repair"
        search={search}
        onSearch={(q) => f.set({ search: q })}
        sort={sort}
        onSort={(s) => f.set({ sort: s === 'newest' ? null : s })}
        activeFilters={active}
        onClearAll={() => f.clear()}
        total={data?.meta?.total}
        noun={data?.meta?.total === 1 ? 'service' : 'services'}
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
            <FilterGroup title="Budget (UGX)">
              <PriceRange min={minPrice} max={maxPrice} onChange={(lo, hi) => f.set({ minPrice: lo, maxPrice: hi })} />
            </FilterGroup>
          </>
        }
      >
        {isLoading ? (
          <CardGridSkeleton count={6} columns={3} />
        ) : error ? (
          <ErrorState message={getErrorMessage(error, "Couldn't load services")} onRetry={() => refetch()} />
        ) : !data?.data.length ? (
          <EmptyState
            icon={<FiBriefcase />}
            title={active.length ? 'No services match your filters' : 'No services yet'}
            message={active.length ? 'Try a broader search or remove a filter.' : 'Got a skill? Be the first to offer it.'}
          >
            {active.length ? (
              <ButtonLink to="/services/browse" variant="outline">
                Clear filters
              </ButtonLink>
            ) : (
              <ButtonLink to="/services/create">Offer a service</ButtonLink>
            )}
          </EmptyState>
        ) : (
          <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {data.data.map((service) => (
                <ProviderCard key={service.id} service={service} isNew={fresh.has(service.id)} />
              ))}
            </div>
          </div>
        )}
      </BrowseLayout>
    </div>
  );
}
