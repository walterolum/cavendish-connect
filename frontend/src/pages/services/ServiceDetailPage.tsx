import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiBriefcase, FiCalendar, FiClock, FiExternalLink, FiEye, FiMapPin, FiSearch } from 'react-icons/fi';
import { servicesApi } from '../../services/listing.service';
import { getErrorMessage, isNotFound } from '../../lib/api';
import { formatMoney, formatRelativeTime } from '../../lib/utils';
import { PRICE_TYPE_LABELS, label } from '../../lib/labels';
import { useAuthGate, useDocumentTitle, useFavoriteToggle } from '../../lib/hooks';
import { OrderDialog } from '../../components/orders/OrderDialog';
import { LocationMap } from '../../components/listing/LocationMap';
import { useAuthStore } from '../../store/auth';
import { Badge, StatusBadge } from '../../components/ui/badge';
import { ButtonLink } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { DetailList } from '../../components/ui/page';
import { EmptyState, ErrorState } from '../../components/ui/loading';
import { servicePrice } from '../../components/listing/ServiceCard';
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

export default function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const me = useAuthStore((s) => s.user);
  const key = ['services', 'detail', slug];
  const report = useReportDialog();
  const [ordering, setOrdering] = useState(false);
  const gate = useAuthGate();

  const { data: service, isLoading, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => servicesApi.getService(slug!),
    enabled: !!slug,
  });
  const favorite = useFavoriteToggle('SERVICE', service?.id, key);
  useDocumentTitle(service?.title);

  if (isLoading) return <DetailSkeleton />;

  if (error || !service) {
    return isNotFound(error) ? (
      <EmptyState icon={<FiSearch />} title="This service isn't available" message="It may have been removed or is still waiting for review.">
        <ButtonLink to="/services">Browse services</ButtonLink>
      </EmptyState>
    ) : (
      <ErrorState message={getErrorMessage(error, "Couldn't load this service")} onRetry={() => refetch()} />
    );
  }

  const isOwner = me?.id === service.user?.id;
  const portfolios = service.portfolios ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Breadcrumbs
        items={[
          { to: '/services', label: 'Services' },
          { to: `/services/browse?category=${service.serviceCategory?.slug}`, label: service.serviceCategory?.name ?? 'Category' },
          { label: service.title },
        ]}
      />
      {isOwner && <OwnerNotice status={service.status} editTo={`/services/${service.slug}/edit`} />}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <ImageGallery images={service.images} title={service.title} fallbackIcon={FiBriefcase} />
          <DescriptionBlock title="About this service">{service.description}</DescriptionBlock>
          <LocationMap location={service.location} title="Where this service is offered" />

          {portfolios.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900">Portfolio</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {portfolios.map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    {item.imageUrl && <img src={item.imageUrl} alt={item.title} loading="lazy" className="aspect-video w-full object-cover" />}
                    <div className="p-4">
                      <p className="font-semibold text-gray-900">{item.title}</p>
                      {item.description && <p className="mt-1 text-sm text-gray-600">{item.description}</p>}
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
                        >
                          View work <FiExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">Pricing</h2>
            <Card className="mt-3 p-5">
              <DetailList
                items={[
                  ...(service.priceMin != null ? [{ label: 'From', value: formatMoney(service.priceMin, service.currency) }] : []),
                  ...(service.priceMax != null ? [{ label: 'Up to', value: formatMoney(service.priceMax, service.currency) }] : []),
                  { label: 'Pricing', value: label(PRICE_TYPE_LABELS, service.priceType ?? 'fixed') },
                  { label: 'Category', value: service.serviceCategory?.name },
                ]}
              />
            </Card>
          </section>

          <ReviewsSection targetType="SERVICE_PROVIDER" owner={service.user} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <ActionPanel
            priceText={service.priceMin != null ? `From ${formatMoney(service.priceMin, service.currency)}` : 'Price on request'}
            order={{
              label: 'Book this service',
              disabled: service.status !== 'ACTIVE',
              note: undefined,
              onClick: () => gate('Sign in to place an order') && setOrdering(true),
            }}
            title={service.title}
            badges={
              <>
                {service.serviceCategory && <Badge variant="brand">{service.serviceCategory.name}</Badge>}
                {service.status !== 'ACTIVE' && <StatusBadge status={service.status} />}
              </>
            }
            price={
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-gray-900 tabular-nums">
                {servicePrice(service)}
                <span className="ml-2 text-sm font-medium text-gray-500">{label(PRICE_TYPE_LABELS, service.priceType ?? 'fixed')}</span>
              </p>
            }
            facts={
              <>
                {service.location && <Fact icon={FiMapPin}>{service.location}</Fact>}
                {service.availability && <Fact icon={FiCalendar}>{service.availability}</Fact>}
                <Fact icon={FiClock}>Posted {formatRelativeTime(service.createdAt)}</Fact>
                {!!service.viewCount && (
                  <Fact icon={FiEye}>
                    {service.viewCount} view{service.viewCount !== 1 ? 's' : ''}
                  </Fact>
                )}
              </>
            }
            owner={service.user}
            isFavorited={service.isFavorited}
            onFavorite={favorite.toggle}
            favoritePending={favorite.isPending}
            onReport={report.openReport}
            contactLabel="Contact provider"
          />
          <OwnerCard owner={service.user} role="Service provider" rating={service.averageRating} reviewCount={service.reviewsCount} />
          <SafetyTips />
        </aside>
      </div>

      <OrderDialog

        open={ordering}

        onClose={() => setOrdering(false)}

        targetType="SERVICE"

        targetId={service.id}

        title={service.title}

        price={service.priceMin}

        currency={service.currency}

      />

      <ReportModal open={report.open} onClose={report.close} targetType="SERVICE" targetId={service.id} targetLabel="Service" />
    </div>
  );
}
