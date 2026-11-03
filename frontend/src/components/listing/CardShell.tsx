import { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FiHeart } from 'react-icons/fi';
import { ListingImage, ListingOwner, isVerifiedOwner } from '../../types';
import { Avatar, fullName } from '../ui/avatar';
import { StatusBadge, VerifiedBadge } from '../ui/badge';

export function primaryImage(images?: ListingImage[]) {
  return images?.find((i) => i.isPrimary)?.url || images?.[0]?.url || null;
}

/** Shared frame for listing, service and property cards so all three look and behave alike. */
export function CardShell({
  to,
  title,
  image,
  fallbackIcon: FallbackIcon,
  topLeft,
  favorited,
  status,
  children,
  owner,
  meta,
}: {
  to: string;
  title: string;
  image: string | null;
  fallbackIcon: ComponentType<{ className?: string }>;
  topLeft?: ReactNode;
  favorited?: boolean;
  /** Shown only for non-live items, e.g. on the owner's own cards. */
  status?: string;
  children: ReactNode;
  owner?: ListingOwner;
  meta?: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-raised"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
        {image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <FallbackIcon className="h-10 w-10" />
          </div>
        )}
        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {topLeft}
            {status && status !== 'ACTIVE' && <StatusBadge status={status} className="bg-white/95" />}
          </div>
          {favorited && (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-red-500 shadow-sm" aria-label="Saved">
              <FiHeart className="h-4 w-4 fill-current" />
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex-1">{children}</div>
        {(owner || meta) && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs text-gray-500">
            {owner ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <Avatar person={owner} size="xs" />
                <span className="truncate">{fullName(owner)}</span>
                {isVerifiedOwner(owner) && <VerifiedBadge className="shrink-0" />}
              </span>
            ) : (
              <span />
            )}
            {meta && <span className="flex shrink-0 items-center gap-1">{meta}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
