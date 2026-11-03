import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { FiHome, FiPlus } from 'react-icons/fi';
import { accommodationApi } from '../../services/listing.service';
import { categoriesApi } from '../../services/marketplace.service';
import { getErrorMessage } from '../../lib/api';
import { formatMoney } from '../../lib/utils';
import { PROPERTY_TYPE_LABELS } from '../../lib/labels';
import { useDocumentTitle, useNewArrivals, LIVE_REFRESH_MS } from '../../lib/hooks';
import { ButtonLink } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/input';
import { Page, PageHeader } from '../../components/ui/page';
import { CardGridSkeleton, EmptyState, ErrorState } from '../../components/ui/loading';
import PropertyCard from '../../components/listing/PropertyCard';
import { ActiveFilter, BrowseLayout, FilterGroup, OptionList, PriceRange, SORT_OPTIONS, useUrlFilters } from '../../components/browse/Browse';

const FEATURES = [
  { key: 'hasWifi', label: 'Wi-Fi' },
  { key: 'hasWater', label: 'Running water' },
  { key: 'hasSecurity', label: 'Security' },
  { key: 'hasParking', label: 'Parking' },
  { key: 'isFurnished', label: 'Furnished' },
] as const;

const SORTS = SORT_OPTIONS.map((o) =>
  o.value === 'price_asc' ? { ...o, label: 'Rent: low to high' } : o.value === 'price_desc' ? { ...o, label: 'Rent: high to low' } : o
);

export default function AccommodationPage() {
  useDocumentTitle('Search stays');
  const f = useUrlFilters();
  const search = f.get('search');
  const category = f.get('category');
  const propertyType = f.get('propertyType');
  const sort = f.get('sort') || 'newest';
  const minPrice = f.get('minPrice');
  const maxPrice = f.get('maxPrice');
  const location = f.get('location');
  const minRooms = f.get('minRooms');
  const features = FEATURES.filter((x) => f.get(x.key) === 'true');

  const query = {
    page: f.page,
    limit: 12,
    search: search || undefined,
    category: category || undefined,
    propertyType: propertyType || undefined,
    sort,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    location: location || undefined,
    minRooms: minRooms ? Number(minRooms) : undefined,
    ...Object.fromEntries(features.map((x) => [x.key, 'true'])),
  };

  const { data, isLoading, isPlaceholderData, error, refetch } = useQuery({
    queryKey: ['accommodation', 'list', query],
    queryFn: () => accommodationApi.getProperties(query),
    placeholderData: keepPreviousData,
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  const fresh = useNewArrivals(data?.data.map((p) => p.id));

  const { data: categories = [] } = useQuery({
    queryKey: ['property-categories'],
    queryFn: () => categoriesApi.getPropertyCategories(),
    staleTime: 5 * 60_000,
  });

  const active: ActiveFilter[] = [
    search && { key: 'search', label: `“${search}”`, onRemove: () => f.set({ search: null }) },
    location && { key: 'location', label: `Near ${location}`, onRemove: () => f.set({ location: null }) },
    minRooms && { key: 'rooms', label: `${minRooms}+ rooms free`, onRemove: () => f.set({ minRooms: null }) },
    category && {
      key: 'category',
      label: categories.find((c) => c.slug === category)?.name ?? category,
      onRemove: () => f.set({ category: null }),
    },
    propertyType && { key: 'type', label: PROPERTY_TYPE_LABELS[propertyType] ?? propertyType, onRemove: () => f.set({ propertyType: null }) },
    (minPrice || maxPrice) && {
      key: 'price',
      label: `${minPrice ? formatMoney(minPrice) : 'Any'} – ${maxPrice ? formatMoney(maxPrice) : 'Any'} / month`,
      onRemove: () => f.set({ minPrice: null, maxPrice: null }),
    },
    ...features.map((x) => ({ key: x.key, label: x.label, onRemove: () => f.set({ [x.key]: null }) })),
  ].filter(Boolean) as ActiveFilter[];

  return (
    <Page>
      <PageHeader
        back={{ to: '/accommodation', label: 'Accommodation' }}
        title="Search stays"
        description="Hostels, rooms and apartments near campus, listed by landlords in the community."
        actions={
          <ButtonLink to="/accommodation/create">
            <FiPlus className="h-4 w-4" />
            List a place
          </ButtonLink>
        }
      />
      <BrowseLayout
        searchPlaceholder="Search by area or keyword, e.g. Nsambya, self-contained"
        search={search}
        onSearch={(q) => f.set({ search: q })}
        sort={sort}
        onSort={(s) => f.set({ sort: s === 'newest' ? null : s })}
        sortOptions={SORTS}
        activeFilters={active}
        onClearAll={() => f.clear()}
        total={data?.meta?.total}
        noun={data?.meta?.total === 1 ? 'place' : 'places'}
        meta={data?.meta}
        onPage={(p) => f.set({ page: String(p) })}
        filters={
          <>
            <FilterGroup title="Type">
              <OptionList
                allLabel="Any type"
                value={propertyType}
                onChange={(v) => f.set({ propertyType: v })}
                options={Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </FilterGroup>
            {categories.length > 0 && (
              <FilterGroup title="Category">
                <OptionList
                  allLabel="All categories"
                  value={category}
                  onChange={(v) => f.set({ category: v })}
                  options={categories.map((c) => ({ value: c.slug, label: c.name }))}
                />
              </FilterGroup>
            )}
            <FilterGroup title="Monthly rent (UGX)">
              <PriceRange min={minPrice} max={maxPrice} onChange={(lo, hi) => f.set({ minPrice: lo, maxPrice: hi })} />
            </FilterGroup>
            <FilterGroup title="Must have">
              <div className="space-y-2">
                {FEATURES.map((x) => (
                  <Checkbox
                    key={x.key}
                    label={x.label}
                    checked={f.get(x.key) === 'true'}
                    onChange={(e) => f.set({ [x.key]: e.target.checked ? 'true' : null })}
                    className="p-2.5"
                  />
                ))}
              </div>
            </FilterGroup>
          </>
        }
      >
        {isLoading ? (
          <CardGridSkeleton count={6} columns={3} />
        ) : error ? (
          <ErrorState message={getErrorMessage(error, "Couldn't load accommodation")} onRetry={() => refetch()} />
        ) : !data?.data.length ? (
          <EmptyState
            icon={<FiHome />}
            title={active.length ? 'No places match your filters' : 'No places listed yet'}
            message={active.length ? 'Try a wider rent range or fewer must-haves.' : 'Landlords: list your rooms for students.'}
          >
            {active.length ? (
              <ButtonLink to="/accommodation/search" variant="outline">
                Clear filters
              </ButtonLink>
            ) : (
              <ButtonLink to="/accommodation/create">List a place</ButtonLink>
            )}
          </EmptyState>
        ) : (
          <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <div className="stagger grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {data.data.map((property) => (
                <PropertyCard key={property.id} property={property} isNew={fresh.has(property.id)} />
              ))}
            </div>
          </div>
        )}
      </BrowseLayout>
    </Page>
  );
}
