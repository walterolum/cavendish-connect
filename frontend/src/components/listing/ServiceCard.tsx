import { FiBriefcase, FiMapPin } from 'react-icons/fi';
import { Service } from '../../types';
import { formatMoney } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { CardShell, primaryImage } from './CardShell';

export function servicePrice(service: Pick<Service, 'priceMin' | 'priceMax' | 'currency' | 'priceType'>) {
  const { priceMin, priceMax, currency } = service;
  if (service.priceType === 'quote' && priceMin == null) return 'Price on request';
  if (priceMin != null && priceMax != null && Number(priceMax) > Number(priceMin)) {
    return `${formatMoney(priceMin, currency)} – ${formatMoney(priceMax, currency).replace(/^UGX /, '')}`;
  }
  if (priceMin != null) return formatMoney(priceMin, currency);
  if (priceMax != null) return `Up to ${formatMoney(priceMax, currency)}`;
  return 'Price on request';
}

const unit: Record<string, string> = { hourly: '/hr', daily: '/day' };

export default function ServiceCard({ service, showStatus }: { service: Service; showStatus?: boolean }) {
  return (
    <CardShell
      to={`/services/${service.slug}`}
      title={service.title}
      image={primaryImage(service.images)}
      fallbackIcon={FiBriefcase}
      topLeft={service.serviceCategory && <Badge variant="solid">{service.serviceCategory.name}</Badge>}
      favorited={service.isFavorited}
      status={showStatus ? service.status : undefined}
      owner={service.user}
      meta={
        service.location ? (
          <>
            <FiMapPin className="h-3 w-3" />
            <span className="max-w-[110px] truncate">{service.location}</span>
          </>
        ) : undefined
      }
    >
      <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-gray-900 group-hover:text-brand-700">
        {service.title}
      </h3>
      <p className="mt-1.5 text-base font-bold tracking-tight text-gray-900 tabular-nums">
        {servicePrice(service)}
        {service.priceType && unit[service.priceType] && (
          <span className="text-xs font-medium text-gray-500">{unit[service.priceType]}</span>
        )}
      </p>
    </CardShell>
  );
}
