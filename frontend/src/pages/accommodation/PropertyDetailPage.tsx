import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FiCheck,
  FiClock,
  FiDroplet,
  FiHome,
  FiKey,
  FiMapPin,
  FiNavigation,
  FiSearch,
  FiShield,
  FiTruck,
  FiWifi,
  FiX,
  FiZap,
} from 'react-icons/fi';
import { accommodationApi } from '../../services/listing.service';
import { getErrorMessage, isNotFound } from '../../lib/api';
import { formatMoney, formatRelativeTime, cn } from '../../lib/utils';
import { PROPERTY_TYPE_LABELS, label } from '../../lib/labels';
import { useAuthGate, useDocumentTitle, useFavoriteToggle } from '../../lib/hooks';
import { OrderDialog } from '../../components/orders/OrderDialog';
import { LocationMap } from '../../components/listing/LocationMap';
import { useAuthStore } from '../../store/auth';
import { Badge, StatusBadge } from '../../components/ui/badge';
import { ButtonLink } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { CardGrid, DetailList } from '../../components/ui/page';
import { EmptyState, ErrorState } from '../../components/ui/loading';
import PropertyCard from '../../components/listing/PropertyCard';
import {
  ActionPanel,
  Breadcrumbs,
  DescriptionBlock,
  DetailSkeleton,
  Fact,
  ImageGallery,
  OwnerCard,
  OwnerNotice,
  SafetyTips,
} from '../../components/listing/DetailParts';
import { ReviewsSection } from '../../components/listing/ReviewsSection';
import ReportModal, { useReportDialog } from '../../components/report/ReportModal';

const FEATURES = [
  { key: 'hasWifi', label: 'Wi-Fi', icon: FiWifi },
  { key: 'hasWater', label: 'Running water', icon: FiDroplet },
  { key: 'hasElectricity', label: 'Electricity', icon: FiZap },
  { key: 'hasSecurity', label: 'Security', icon: FiShield },
  { key: 'hasParking', label: 'Parking', icon: FiTruck },
  { key: 'isFurnished', label: 'Furnished', icon: FiHome },
] as const;

export default function PropertyDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const me = useAuthStore((s) => s.user);
  const key = ['accommodation', 'detail', slug];
  const report = useReportDialog();
  const [ordering, setOrdering] = useState(false);
  const gate = useAuthGate();

  const { data: property, isLoading, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => accommodationApi.getProperty(slug!),
    enabled: !!slug,
  });
  const favorite = useFavoriteToggle('ACCOMMODATION', property?.id, key);
  useDocumentTitle(property?.title);

  const { data: similar } = useQuery({
    queryKey: ['accommodation', 'similar', property?.propertyCategory?.slug],
    queryFn: () => accommodationApi.getProperties({ limit: 5, category: property?.propertyCategory?.slug }),
    enabled: !!property?.propertyCategory?.slug,
  });

  if (isLoading) return <DetailSkeleton />;

  if (error || !property) {
    return isNotFound(error) ? (
      <EmptyState icon={<FiSearch />} title="This place isn't available" message="It may have been taken, removed, or is still waiting for review.">
        <ButtonLink to="/accommodation">Browse accommodation</ButtonLink>
      </EmptyState>
    ) : (
      <ErrorState message={getErrorMessage(error, "Couldn't load this property")} onRetry={() => refetch()} />
    );
  }

  const isOwner = me?.id === property.user?.id;
  const similarProperties = (similar?.data ?? []).filter((p) => p.id !== property.id).slice(0, 4);
  const full = property.availableRooms === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Breadcrumbs
        items={[
          { to: '/accommodation', label: 'Accommodation' },
          { to: `/accommodation/search?category=${property.propertyCategory?.slug}`, label: property.propertyCategory?.name ?? 'Category' },
          { label: property.title },
        ]}
      />
      {isOwner && <OwnerNotice status={property.status} editTo={`/accommodation/${property.slug}/edit`} />}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <ImageGallery images={property.images} title={property.title} fallbackIcon={FiHome} />
          <DescriptionBlock title="About this place">{property.description}</DescriptionBlock>
          <LocationMap location={property.location} title="Location" />

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">What's included</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FEATURES.map(({ key: k, label: l, icon: Icon }) => {
                const on = !!property[k];
                return (
                  <div
                    key={k}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm',
                      on ? 'border-gray-200 bg-white text-gray-800' : 'border-dashed border-gray-200 text-gray-400'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', on ? 'text-brand-600' : 'text-gray-300')} />
                    <span className={cn(!on && 'line-through')}>{l}</span>
                    {on ? <FiCheck className="ml-auto h-4 w-4 text-emerald-600" /> : <FiX className="ml-auto h-4 w-4" />}
                  </div>
                );
              })}
            </div>
            {!!property.amenities?.length && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {property.amenities.map(({ amenity }) => (
                  <Badge key={amenity.id} variant="gray">
                    {amenity.name}
                  </Badge>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">Rooms & costs</h2>
            <Card className="mt-3 p-5">
              <DetailList
                items={[
                  { label: 'Type', value: label(PROPERTY_TYPE_LABELS, property.propertyType) },
                  ...(property.roomType ? [{ label: 'Room type', value: property.roomType }] : []),
                  { label: 'Rooms available', value: `${property.availableRooms} of ${property.totalRooms}` },
                  { label: 'Monthly rent', value: formatMoney(property.monthlyPrice, property.currency) },
                  {
                    label: 'Deposit',
                    value: property.depositAmount && Number(property.depositAmount) > 0 ? formatMoney(property.depositAmount, property.currency) : 'None',
                  },
                ]}
              />
            </Card>
          </section>

          {property.rules && <DescriptionBlock title="House rules">{property.rules}</DescriptionBlock>}

          <ReviewsSection targetType="LANDLORD" owner={property.user} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <ActionPanel
            priceText={`${formatMoney(property.monthlyPrice, property.currency)} / month`}
            order={{
              label: 'Request a viewing',
              disabled: property.status !== 'ACTIVE' || property.availableRooms === 0,
              note: property.availableRooms === 0 ? 'Fully booked right now' : undefined,
              onClick: () => gate('Sign in to place an order') && setOrdering(true),
            }}
            title={property.title}
            badges={
              <>
                <Badge variant="brand">{label(PROPERTY_TYPE_LABELS, property.propertyType)}</Badge>
                {full ? <Badge variant="red">Fully booked</Badge> : <Badge variant="green">{property.availableRooms} available</Badge>}
                {property.status !== 'ACTIVE' && <StatusBadge status={property.status} />}
              </>
            }
            price={
              <p className="flex items-baseline gap-1.5">
                <span className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-gray-900 tabular-nums">
                  {formatMoney(property.monthlyPrice, property.currency)}
                </span>
                <span className="text-sm font-medium text-gray-500">/ month</span>
              </p>
            }
            facts={
              <>
                <Fact icon={FiMapPin}>{property.location}</Fact>
                {property.distanceFromCampus && <Fact icon={FiNavigation}>{property.distanceFromCampus} from campus</Fact>}
                {property.depositAmount != null && Number(property.depositAmount) > 0 && (
                  <Fact icon={FiKey}>Deposit {formatMoney(property.depositAmount, property.currency)}</Fact>
                )}
                <Fact icon={FiClock}>Listed {formatRelativeTime(property.createdAt)}</Fact>
              </>
            }
            owner={property.user}
            isFavorited={property.isFavorited}
            onFavorite={favorite.toggle}
            favoritePending={favorite.isPending}
            onReport={report.openReport}
            contactLabel="Contact landlord"
          />
          <OwnerCard owner={property.user} role="Landlord" rating={property.averageRating} reviewCount={property.reviewsCount} />
          <SafetyTips />
        </aside>
      </div>

      {similarProperties.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 text-xl font-bold text-gray-900">Similar places</h2>
          <CardGrid>
            {similarProperties.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </CardGrid>
        </section>
      )}

      <OrderDialog

        open={ordering}

        onClose={() => setOrdering(false)}

        targetType="PROPERTY"

        targetId={property.id}

        title={property.title}

        price={property.monthlyPrice}

        currency={property.currency}

        maxQuantity={property.availableRooms}

      />

      <ReportModal open={report.open} onClose={report.close} targetType="ACCOMMODATION" targetId={property.id} targetLabel="Property" />
    </div>
  );
}
