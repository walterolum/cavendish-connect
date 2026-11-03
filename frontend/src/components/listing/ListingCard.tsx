import { FiMapPin, FiPackage } from 'react-icons/fi';
import { MarketplaceListing } from '../../types';
import { formatMoney } from '../../lib/utils';
import { CONDITION_SHORT, label } from '../../lib/labels';
import { Badge } from '../ui/badge';
import { CardShell, primaryImage } from './CardShell';

export default function ListingCard({ listing, showStatus }: { listing: MarketplaceListing; showStatus?: boolean }) {
  return (
    <CardShell
      to={`/marketplace/${listing.slug}`}
      title={listing.title}
      image={primaryImage(listing.images)}
      fallbackIcon={FiPackage}
      topLeft={<Badge variant="solid">{label(CONDITION_SHORT, listing.condition)}</Badge>}
      favorited={listing.isFavorited}
      status={showStatus ? listing.status : undefined}
      owner={listing.user}
      meta={
        listing.location ? (
          <>
            <FiMapPin className="h-3 w-3" />
            <span className="max-w-[110px] truncate">{listing.location}</span>
          </>
        ) : undefined
      }
    >
      <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-gray-900 group-hover:text-brand-700">
        {listing.title}
      </h3>
      <p className="mt-1.5 flex items-baseline gap-2">
        <span className="text-lg font-bold tracking-tight text-gray-900 tabular-nums">
          {formatMoney(listing.price, listing.currency)}
        </span>
        {listing.isNegotiable && <span className="text-xs font-medium text-emerald-700">Negotiable</span>}
      </p>
    </CardShell>
  );
}
