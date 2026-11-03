import { Link } from 'react-router-dom';
import { LuArrowRight, LuClock, LuPackage, LuUser } from 'react-icons/lu';
import { MarketplaceListing, isVerifiedOwner } from '../../types';
import { cn, formatMoney, formatRelativeTime } from '../../lib/utils';
import { CONDITION_SHORT, label } from '../../lib/labels';
import { primaryImage } from '../listing/CardShell';
import { FavoriteHeart } from '../listing/FavoriteHeart';
import { VerifiedBadge, StatusBadge } from '../ui/badge';

/** Campus Market listing card: photo, title, price, seller, time, and a clear call to action. */
export default function MarketCard({ listing: l, showStatus, isNew }: { listing: MarketplaceListing; showStatus?: boolean; isNew?: boolean }) {
  const image = primaryImage(l.images);
  const href = `/marketplace/${l.slug}`;
  return (
    <article className={cn('lift group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card', isNew && 'just-posted')}>
      <Link to={href} className="relative block aspect-[4/3] overflow-hidden bg-gray-100" tabIndex={-1} aria-hidden="true">
        {image ? (
          <img src={image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.07]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand-300">
            <LuPackage className="h-12 w-12" />
          </div>
        )}
        {isNew && (
          <span className="animate-pop-in absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-accent-400 px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-brand-950 shadow-lg">
            Just posted
          </span>
        )}
        <span className="absolute bottom-3 left-3 rounded-full bg-brand-950/75 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {label(CONDITION_SHORT, l.condition)}
        </span>
        {showStatus && l.status !== 'ACTIVE' && <StatusBadge status={l.status} className="absolute top-3 left-3 bg-white/95" />}
      </Link>
      <FavoriteHeart type="MARKETPLACE" id={l.id} initial={l.isFavorited} className="absolute top-2.5 right-2.5" />

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-1 text-[16px] font-bold text-gray-900">
          <Link to={href} className="hover:text-brand-700">
            {l.title}
          </Link>
        </h3>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-extrabold tracking-tight whitespace-nowrap text-brand-700 tabular-nums">{formatMoney(l.price, l.currency)}</span>
          {l.isNegotiable && <span className="text-xs font-medium text-emerald-600">Negotiable</span>}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-gray-600">
          <span className="flex max-w-full items-center gap-1">
            <LuUser className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">By {l.user?.firstName ?? 'a member'}</span>
            {isVerifiedOwner(l.user) && <VerifiedBadge className="shrink-0" />}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <LuClock className="h-3.5 w-3.5" /> {formatRelativeTime(l.createdAt)}
          </span>
        </p>
        <Link
          to={href}
          className="group/btn mt-4 flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-800 text-sm font-semibold text-white transition-all hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-900/20 active:scale-[0.98]"
        >
          View Details <LuArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
        </Link>
      </div>
    </article>
  );
}
