import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiCheckCircle, FiClock, FiEye, FiLayers, FiMapPin, FiPackage, FiSearch } from 'react-icons/fi';
import { marketplaceApi } from '../../services/marketplace.service';
import { getErrorMessage, isNotFound } from '../../lib/api';
import { formatMoney, formatRelativeTime } from '../../lib/utils';
import { CONDITION_LABELS, label } from '../../lib/labels';
import { useDocumentTitle, useFavoriteToggle } from '../../lib/hooks';
import { useAuthStore } from '../../store/auth';
import { Badge, StatusBadge } from '../../components/ui/badge';
import { ButtonLink } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { DetailList } from '../../components/ui/page';
import { EmptyState, ErrorState } from '../../components/ui/loading';
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

export default function ListingDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const me = useAuthStore((s) => s.user);
  const key = ['marketplace', 'listing', slug];
  const report = useReportDialog();

  const { data: listing, isLoading, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => marketplaceApi.getListing(slug!),
    enabled: !!slug,
  });
  const favorite = useFavoriteToggle('MARKETPLACE', listing?.id, key);
  useDocumentTitle(listing?.title);

  if (isLoading) return <DetailSkeleton />;

  if (error || !listing) {
    return isNotFound(error) ? (
      <EmptyState
        icon={<FiSearch />}
        title="This listing isn't available"
        message="It may have been sold, removed, or is still waiting for review."
      >
        <ButtonLink to="/marketplace">Browse the marketplace</ButtonLink>
      </EmptyState>
    ) : (
      <ErrorState message={getErrorMessage(error, "Couldn't load this listing")} onRetry={() => refetch()} />
    );
  }

  const isOwner = me?.id === listing.user?.id;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Breadcrumbs
        items={[
          { to: '/marketplace', label: 'Campus Market' },
          { to: `/marketplace/browse?category=${listing.category?.slug}`, label: listing.category?.name ?? 'Category' },
          { label: listing.title },
        ]}
      />
      {isOwner && <OwnerNotice status={listing.status} editTo={`/marketplace/${listing.slug}/edit`} />}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <ImageGallery images={listing.images} title={listing.title} fallbackIcon={FiPackage} />
          <DescriptionBlock>{listing.description}</DescriptionBlock>

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">Details</h2>
            <Card className="mt-3 p-5">
              <DetailList
                items={[
                  { label: 'Category', value: listing.category?.name },
                  { label: 'Condition', value: label(CONDITION_LABELS, listing.condition) },
                  { label: 'Quantity', value: listing.quantity },
                  { label: 'Price', value: listing.isNegotiable ? 'Negotiable' : 'Fixed' },
                  ...(listing.location ? [{ label: 'Location', value: listing.location }] : []),
                ]}
              />
            </Card>
          </section>

          <ReviewsSection targetType="SELLER" owner={listing.user} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <ActionPanel
            title={listing.title}
            badges={
              <>
                <Badge variant="brand">{label(CONDITION_LABELS, listing.condition)}</Badge>
                {listing.status !== 'ACTIVE' && <StatusBadge status={listing.status} />}
              </>
            }
            price={
              <p className="flex items-baseline gap-2">
                <span className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-gray-900 tabular-nums">
                  {formatMoney(listing.price, listing.currency)}
                </span>
                {listing.isNegotiable && <span className="text-sm font-medium text-emerald-700">Negotiable</span>}
              </p>
            }
            facts={
              <>
                {listing.location && <Fact icon={FiMapPin}>{listing.location}</Fact>}
                {listing.quantity > 1 && <Fact icon={FiLayers}>{listing.quantity} available</Fact>}
                <Fact icon={FiClock}>Posted {formatRelativeTime(listing.createdAt)}</Fact>
                {listing.viewCount > 0 && (
                  <Fact icon={FiEye}>
                    {listing.viewCount} view{listing.viewCount !== 1 ? 's' : ''}
                  </Fact>
                )}
                {listing.status === 'ACTIVE' && <Fact icon={FiCheckCircle}>Reviewed by CAV CONNECT moderators</Fact>}
              </>
            }
            owner={listing.user}
            isFavorited={listing.isFavorited}
            onFavorite={favorite.toggle}
            favoritePending={favorite.isPending}
            onReport={report.openReport}
            contactLabel="Message seller"
          />
          <OwnerCard owner={listing.user} role="Seller" />
          <SafetyTips />
        </aside>
      </div>

      <ReportModal open={report.open} onClose={report.close} targetType="LISTING" targetId={listing.id} targetLabel="Listing" />
    </div>
  );
}
