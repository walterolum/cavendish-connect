import { ComponentType, ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight, FiEdit2, FiFlag, FiHeart, FiMessageSquare, FiShare2 } from 'react-icons/fi';
import { toast } from 'sonner';
import { VerifiedBadge } from '../ui/badge';
import { ListingImage, ListingOwner, isVerifiedOwner } from '../../types';
import { formatDate, cn } from '../../lib/utils';
import { statusMeta } from '../../lib/labels';
import { useAuthStore } from '../../store/auth';
import { useStartConversation } from '../../lib/hooks';
import { Avatar, fullName } from '../ui/avatar';
import { Button, ButtonLink } from '../ui/button';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/loading';
import { Stars } from '../ui/stat';

/** Primary image first, then the rest in their saved order. */
export function orderImages(images?: ListingImage[]) {
  const sorted = [...(images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const primary = sorted.find((i) => i.isPrimary);
  return primary ? [primary, ...sorted.filter((i) => i.id !== primary.id)] : sorted;
}

export function ImageGallery({
  images,
  title,
  fallbackIcon: Fallback,
}: {
  images?: ListingImage[];
  title: string;
  fallbackIcon: ComponentType<{ className?: string }>;
}) {
  const ordered = orderImages(images);
  const [index, setIndex] = useState(0);
  const count = ordered.length;
  const current = ordered[Math.min(index, count - 1)];

  useEffect(() => {
    if (count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + count) % count);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  if (!count) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-gray-200/80 bg-gradient-to-br from-gray-50 to-gray-100 text-gray-300">
        <div className="text-center">
          <Fallback className="mx-auto h-14 w-14" />
          <p className="mt-2 text-sm text-gray-400">No photos yet</p>
        </div>
      </div>
    );
  }

  const nav =
    'absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-800 shadow-raised transition hover:bg-white';

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-gray-200/80 bg-gray-100">
        <img src={current.url} alt={current.alt || title} className="h-full w-full object-cover" />
        {count > 1 && (
          <>
            <button type="button" onClick={() => setIndex((i) => (i - 1 + count) % count)} className={cn(nav, 'left-3')} aria-label="Previous photo">
              <FiChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => setIndex((i) => (i + 1) % count)} className={cn(nav, 'right-3')} aria-label="Next photo">
              <FiChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-gray-900/70 px-2.5 py-1 text-xs font-medium text-white tabular-nums">
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {ordered.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              className={cn(
                'h-16 w-20 shrink-0 overflow-hidden rounded-xl ring-2 transition',
                i === index ? 'ring-brand-500' : 'ring-transparent opacity-70 hover:opacity-100'
              )}
            >
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Banner shown to the owner when their post isn't public yet. */
export function OwnerNotice({ status, editTo }: { status: string; editTo: string }) {
  const meta = statusMeta(status);
  const live = status === 'ACTIVE';
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between',
        live ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
      )}
    >
      <div className="text-sm">
        <p className={cn('font-semibold', live ? 'text-emerald-900' : 'text-amber-900')}>
          This is your post · {meta.label}
        </p>
        {meta.hint && <p className={live ? 'text-emerald-800' : 'text-amber-800'}>{meta.hint}.</p>}
      </div>
      <div className="flex gap-2">
        <ButtonLink to="/dashboard" variant="outline" size="sm">
          My posts
        </ButtonLink>
        <ButtonLink to={editTo} size="sm">
          <FiEdit2 className="h-3.5 w-3.5" />
          Edit
        </ButtonLink>
      </div>
    </div>
  );
}

/** Price + key facts + the main actions (message, save, share, report). */
export function ActionPanel({
  title,
  price,
  badges,
  facts,
  owner,
  isFavorited,
  onFavorite,
  favoritePending,
  onReport,
  contactLabel = 'Message',
}: {
  title: string;
  price: ReactNode;
  badges?: ReactNode;
  facts?: ReactNode;
  owner?: ListingOwner;
  isFavorited?: boolean;
  onFavorite: () => void;
  favoritePending?: boolean;
  onReport: () => void;
  contactLabel?: string;
}) {
  const me = useAuthStore((s) => s.user);
  const isOwner = !!owner && me?.id === owner.id;
  const { start, isPending } = useStartConversation();

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      }
    } catch {
      /* user cancelled the share sheet */
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      {badges && <div className="mb-3 flex flex-wrap gap-1.5">{badges}</div>}
      <h1 className="text-xl font-bold leading-tight text-gray-900 sm:text-2xl">{title}</h1>
      <div className="mt-3">{price}</div>
      {facts && <div className="mt-5 space-y-2.5 text-sm text-gray-600">{facts}</div>}

      {!isOwner && (
        <div className="mt-6 space-y-2">
          <Button size="lg" className="w-full" onClick={() => start(owner?.id)} loading={isPending} disabled={!owner}>
            <FiMessageSquare className="h-4 w-4" />
            {contactLabel}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onFavorite} disabled={favoritePending} aria-pressed={!!isFavorited}>
              <FiHeart className={cn('h-4 w-4', isFavorited && 'fill-red-500 text-red-500')} />
              {isFavorited ? 'Saved' : 'Save'}
            </Button>
            <Button variant="outline" onClick={share}>
              <FiShare2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      )}
      {isOwner && (
        <Button variant="outline" className="mt-6 w-full" onClick={share}>
          <FiShare2 className="h-4 w-4" />
          Share link
        </Button>
      )}

      {!isOwner && (
        <button
          type="button"
          onClick={onReport}
          className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-red-600"
        >
          <FiFlag className="h-3 w-3" />
          Report this post
        </button>
      )}
    </Card>
  );
}

export function Fact({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="h-4 w-4 shrink-0 text-gray-400" />
      <span>{children}</span>
    </div>
  );
}

export function OwnerCard({
  owner,
  role,
  rating,
  reviewCount,
}: {
  owner?: ListingOwner;
  role: string;
  rating?: number | null;
  reviewCount?: number;
}) {
  if (!owner) return null;
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{role}</p>
      <div className="mt-3 flex items-center gap-3">
        <Avatar person={owner} size="lg" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold text-gray-900">
            <span className="truncate">{fullName(owner)}</span>
            {isVerifiedOwner(owner) && <VerifiedBadge className="shrink-0" />}
          </p>
          {isVerifiedOwner(owner) && <p className="text-xs font-medium text-brand-700">Verified by CAV CONNECT</p>}
          <p className="truncate text-sm text-gray-500">@{owner.username}</p>
          {reviewCount ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-600">
              <Stars value={Number(rating ?? 0)} />
              <span className="font-medium tabular-nums">{Number(rating ?? 0).toFixed(1)}</span>
              <a href="#reviews" className="text-gray-400 hover:text-brand-700">
                ({reviewCount})
              </a>
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-400">No reviews yet</p>
          )}
        </div>
      </div>
      {(owner.location || owner.createdAt) && (
        <p className="mt-4 text-xs text-gray-500">
          {owner.location && <>{owner.location} · </>}
          {owner.createdAt && <>Member since {formatDate(owner.createdAt)}</>}
        </p>
      )}
      {owner.bio && <p className="mt-3 line-clamp-3 text-sm text-gray-600">{owner.bio}</p>}
    </Card>
  );
}

export function SafetyTips() {
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5 text-sm shadow-card">
      <p className="font-semibold text-gray-900">Stay safe</p>
      <ul className="mt-2 space-y-1.5 text-gray-600">
        <li>• Meet in a public place on campus.</li>
        <li>• Inspect before you pay. Never pay in advance to strangers.</li>
        <li>• Keep conversations on CAV CONNECT.</li>
      </ul>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8" role="status" aria-label="Loading">
      <Skeleton className="mb-6 h-5 w-40" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Skeleton className="aspect-[4/3] rounded-2xl" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { to?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 text-sm">
      <ol className="flex flex-wrap items-center gap-1.5 text-gray-500">
        {items.map((item, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <FiChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />}
            {item.to ? (
              <Link to={item.to} className="hover:text-gray-900">
                {item.label}
              </Link>
            ) : (
              <span className="max-w-[220px] truncate font-medium text-gray-900">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function DescriptionBlock({ title = 'Description', children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}
