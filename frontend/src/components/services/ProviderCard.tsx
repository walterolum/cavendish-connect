import { Link } from 'react-router-dom';
import { LuArrowRight, LuBriefcase, LuStar } from 'react-icons/lu';
import { Service, isVerifiedOwner } from '../../types';
import { cn, formatMoney } from '../../lib/utils';
import { primaryImage } from '../listing/CardShell';
import { FavoriteHeart } from '../listing/FavoriteHeart';
import { Avatar, fullName } from '../ui/avatar';
import { StatusBadge, VerifiedBadge } from '../ui/badge';

function fromPrice(s: Service) {
  if (s.priceMin != null) return `From ${formatMoney(s.priceMin, s.currency)}`;
  if (s.priceMax != null) return `Up to ${formatMoney(s.priceMax, s.currency)}`;
  return 'Price on request';
}

/** Services Hub card: provider photo with rating, the service, its category and starting price. */
export default function ProviderCard({ service: s, showStatus, isNew }: { service: Service; showStatus?: boolean; isNew?: boolean }) {
  const image = primaryImage(s.images) ?? s.user?.avatar ?? null;
  const href = `/services/${s.slug}`;
  const rating = s.averageRating ? Number(s.averageRating) : null;

  return (
    <article className={cn('lift group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card', isNew && 'just-posted')}>
      <Link to={href} className="relative block aspect-[5/4] overflow-hidden bg-gray-100" tabIndex={-1} aria-hidden="true">
        {image ? (
          <img src={image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.07]" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-brand-50 to-brand-100">
            <Avatar person={s.user} size="xl" />
          </div>
        )}
        {isNew && (
          <span className="animate-pop-in absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-accent-400 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-brand-950 shadow-lg">
            Just posted
          </span>
        )}
        {rating && (
          <span className="absolute right-2.5 bottom-2.5 flex items-center gap-1 rounded-lg bg-brand-950/80 px-2 py-1 text-xs font-bold text-white backdrop-blur tabular-nums">
            <LuStar className="h-3.5 w-3.5 fill-accent-400 text-accent-400" /> {rating.toFixed(1)}
          </span>
        )}
        {showStatus && s.status !== 'ACTIVE' && <StatusBadge status={s.status} className="absolute top-2.5 left-2.5 bg-white/95" />}
      </Link>
      <FavoriteHeart type="SERVICE" id={s.id} initial={s.isFavorited} className="absolute top-2 right-2" />

      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="line-clamp-2 min-h-[2.6em] text-[15px] leading-snug font-bold text-gray-900">
          <Link to={href} className="hover:text-brand-700">
            {s.title}
          </Link>
        </h3>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-gray-500">
          <LuBriefcase className="h-3.5 w-3.5 shrink-0" /> {s.serviceCategory?.name}
        </p>
        <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-gray-600">
          by {s.user ? fullName(s.user) : 'a member'}
          {isVerifiedOwner(s.user) && <VerifiedBadge className="shrink-0" />}
        </p>
        <p className="mt-2 text-[15px] font-bold text-gray-900 tabular-nums">{fromPrice(s)}</p>
        <Link
          to={href}
          className="group/btn mt-3 flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-800 text-sm font-semibold text-white transition-all hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-900/20 active:scale-[0.98]"
        >
          View Profile <LuArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
        </Link>
      </div>
    </article>
  );
}
