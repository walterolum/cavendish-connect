import { Link } from 'react-router-dom';
import { FiHome, FiStar } from 'react-icons/fi';
import { Property, isVerifiedOwner } from '../../types';
import { cn, formatMoney } from '../../lib/utils';
import { PROPERTY_TYPE_LABELS, label } from '../../lib/labels';
import { StatusBadge } from '../ui/badge';
import { primaryImage } from './CardShell';
import { FavoriteHeart } from './FavoriteHeart';

/** Highlight shown in the photo's corner, most useful first. */
function highlight(p: Property) {
  if (p.availableRooms === 0) return { text: 'Fully booked', tone: 'bg-gray-900/85 text-white' };
  if (isVerifiedOwner(p.user)) return { text: 'Verified landlord', tone: 'bg-white text-gray-900' };
  if (p.availableRooms <= 2) return { text: `Only ${p.availableRooms} left`, tone: 'bg-accent-400 text-brand-950' };
  return { text: 'Student favourite', tone: 'bg-white text-gray-900' };
}

/** Accommodation card in the "stays" style: big photo, place, type, rent. */
export default function PropertyCard({ property: p, showStatus, isNew }: { property: Property; showStatus?: boolean; isNew?: boolean }) {
  const image = primaryImage(p.images);
  const h = highlight(p);
  const rating = p.averageRating ? Number(p.averageRating) : null;
  const area = p.location.split(',')[0];
  const features = [p.isFurnished && 'Furnished', p.hasWifi && 'Wi-Fi', p.hasSecurity && 'Security'].filter(Boolean).slice(0, 2);

  return (
    <Link
      to={`/accommodation/${p.slug}`}
      className={cn('lift group block overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card', isNew && 'just-posted')}
    >
      <div className="relative aspect-[4/3.1] overflow-hidden bg-gray-100">
        {image ? (
          <img
            src={image}
            alt={p.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand-300">
            <FiHome className="h-12 w-12" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        {isNew && (
          <span className="animate-pop-in absolute top-3 right-12 z-10 rounded-full bg-accent-400 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-brand-950 shadow-lg">
            Just posted
          </span>
        )}
        <span className={cn('absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm', h.tone)}>{h.text}</span>
        {showStatus && p.status !== 'ACTIVE' && <StatusBadge status={p.status} className="absolute bottom-3 left-3 bg-white/95" />}
        <FavoriteHeart type="ACCOMMODATION" id={p.id} initial={p.isFavorited} className="absolute top-2 right-2" />
        {p.images.length > 1 && (
          <span className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1">
            {p.images.slice(0, 5).map((img, i) => (
              <span key={img.id} className={cn('h-1.5 w-1.5 rounded-full', i === 0 ? 'bg-white' : 'bg-white/55')} />
            ))}
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate text-[15px] font-semibold text-gray-900">{p.title}</h3>
          {rating ? (
            <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-gray-900 tabular-nums">
              <FiStar className="h-3.5 w-3.5 fill-gray-900 text-gray-900" /> {rating.toFixed(2)}
              {p.reviewsCount ? <span className="font-normal text-gray-500">({p.reviewsCount})</span> : null}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-gray-500">
          {label(PROPERTY_TYPE_LABELS, p.propertyType)} · {area}
          {p.distanceFromCampus ? ` · ${p.distanceFromCampus}` : ''}
        </p>
        <div className="mt-3 flex items-end justify-between gap-2">
          <span className="truncate text-xs text-gray-500">
            {features.length ? features.join(' · ') : `${p.availableRooms} of ${p.totalRooms} rooms free`}
          </span>
          <span className="shrink-0 text-right">
            <span className="text-[15px] font-bold text-gray-900 tabular-nums">{formatMoney(p.monthlyPrice, p.currency)}</span>
            <span className="text-sm text-gray-500"> month</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
