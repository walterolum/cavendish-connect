import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FiBriefcase, FiExternalLink, FiHome, FiImage, FiPackage, FiShoppingBag } from 'react-icons/fi';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { formatMoney, formatRelativeTime } from '../../lib/utils';
import { PRICE_TYPE_LABELS, label, statusMeta } from '../../lib/labels';
import { PageHeader } from '../../components/ui/page';
import { Tabs, Segmented } from '../../components/ui/tabs';
import { StatusBadge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Pagination } from '../../components/ui/pagination';
import { useUrlFilters } from '../../components/browse/Browse';
import { ListState, ReasonDialog, SearchBox, Table, Td, Th, Toolbar, countLabel } from '../../components/admin/AdminParts';
import type { AdminListing, AdminStats, ListingKind, StatusCount } from '../../types/admin';

const KINDS: { key: ListingKind; label: string; path: string; noun: string; icon: typeof FiPackage; stat: keyof AdminStats['listings'] }[] = [
  { key: 'marketplace', label: 'Marketplace', path: '/marketplace', noun: 'listing', icon: FiShoppingBag, stat: 'marketplace' },
  { key: 'service', label: 'Services', path: '/services', noun: 'service', icon: FiBriefcase, stat: 'services' },
  { key: 'accommodation', label: 'Accommodation', path: '/accommodation', noun: 'property', icon: FiHome, stat: 'accommodation' },
];

const STATUSES = ['PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'SOLD', 'EXPIRED', 'DRAFT'] as const;

type Action = { listing: AdminListing; status: 'REJECTED' | 'SUSPENDED' };

const count = (rows: StatusCount[] | undefined, status?: string) =>
  rows?.reduce((n, r) => n + (!status || r.status === status ? r._count : 0), 0) ?? 0;

function price(l: AdminListing) {
  if (l.price == null) return 'On request';
  const base = formatMoney(l.price, l.currency);
  if (l.kind === 'accommodation') return `${base} / month`;
  if (l.kind === 'service' && l.priceMax != null && Number(l.priceMax) > Number(l.price)) {
    return `${base} – ${formatMoney(l.priceMax, l.currency).replace(/^UGX /, '')}`;
  }
  return base;
}

export default function AdminListings() {
  useDocumentTitle('Listings · Admin');
  const queryClient = useQueryClient();
  const { get, set, page } = useUrlFilters();
  const [action, setAction] = useState<Action | null>(null);

  const kind = (KINDS.find((k) => k.key === get('kind'))?.key ?? 'marketplace') as ListingKind;
  const kindMeta = KINDS.find((k) => k.key === kind)!;
  const status = get('status');
  const search = get('search');

  const stats = useQuery({ queryKey: ['admin', 'dashboard', 'stats'], queryFn: () => adminApi.getDashboardStats() });
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'listings', kind, { page, status, search }],
    queryFn: () =>
      adminApi.getListings(kind, { page, limit: 20, status: status || undefined, search: search || undefined }),
    placeholderData: (prev) => prev,
  });

  const mutation = useMutation({
    mutationFn: (v: { listing: AdminListing; status: string; reason?: string }) =>
      adminApi.updateListingStatus(v.listing.kind, v.listing.id, v.status, v.reason),
    onSuccess: (_d, v) => {
      const verb: Record<string, string> = { ACTIVE: 'is now live', REJECTED: 'was rejected', SUSPENDED: 'was suspended' };
      toast.success(`“${v.listing.title}” ${verb[v.status] ?? `marked ${statusMeta(v.status).label.toLowerCase()}`}`, {
        description: v.status !== 'ACTIVE' || v.listing.status === 'PENDING_REVIEW' ? 'The owner has been notified.' : undefined,
      });
      setAction(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'listings'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not update this post')),
  });

  const rows = data?.data ?? [];
  const statusRows = stats.data?.listings[kindMeta.stat];
  const filtered = Boolean(status || search);
  const statusTabs = [
    { key: '', label: 'All', count: count(statusRows) },
    ...STATUSES.filter((s) => s !== 'SOLD' || kind === 'marketplace').map((s) => ({
      key: s,
      label: statusMeta(s).label,
      count: count(statusRows, s),
    })),
  ];

  return (
    <div>
      <PageHeader
        title="Listings"
        description="Review new posts before they go live, and take down anything that breaks the rules."
      />

      <Tabs
        className="mb-4"
        value={kind}
        onChange={(k) => set({ kind: k === 'marketplace' ? null : k, status: status || null })}
        items={KINDS.map((k) => ({
          key: k.key,
          label: k.label,
          icon: k.icon,
          count: stats.data ? count(stats.data.listings[k.stat], 'PENDING_REVIEW') || undefined : undefined,
        }))}
      />

      <Toolbar>
        <SearchBox
          value={search}
          onSearch={(v) => set({ search: v })}
          placeholder={`Search ${kindMeta.label.toLowerCase()} by title, description or username`}
        />
        <Segmented
          value={status}
          onChange={(s) => set({ status: s })}
          items={statusTabs.map((t) => ({ ...t, count: stats.data ? t.count : undefined }))}
        />
      </Toolbar>

      <p className="mb-3 text-sm text-gray-500" aria-live="polite">
        {countLabel(data?.meta.total, kindMeta.noun, kindMeta.noun === 'property' ? 'properties' : undefined)}
        {status && ` · ${statusMeta(status).label}`}
        {search && ` · matching “${search}”`}
      </p>

      <ListState
        isLoading={isLoading}
        error={error}
        isEmpty={!rows.length}
        onRetry={() => refetch()}
        errorFallback="Could not load listings"
        empty={
          status === 'PENDING_REVIEW' && !search
            ? { icon: <FiPackage />, title: 'Review queue is clear', message: `No ${kindMeta.label.toLowerCase()} posts are waiting for review.` }
            : {
                icon: <FiPackage />,
                title: 'No posts found',
                message: filtered ? 'Nothing matches these filters.' : `No ${kindMeta.label.toLowerCase()} posts yet.`,
                action: filtered ? 'Clear filters' : undefined,
                onAction: () => set({ status: null, search: null }),
              }
        }
      >
        <Table
          head={
            <>
              <Th>Post</Th>
              <Th>Owner</Th>
              <Th>Price</Th>
              <Th>Status</Th>
              <Th>Posted</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
          footer={
            data?.meta && data.meta.totalPages > 1 ? (
              <Pagination meta={data.meta} onPageChange={(p) => set({ page: String(p) }, false)} noun={`${kindMeta.noun}s`} />
            ) : undefined
          }
        >
          {rows.map((l) => {
            const busy = mutation.isPending && mutation.variables?.listing.id === l.id;
            return (
              <tr key={`${l.kind}-${l.id}`} className="transition-colors hover:bg-gray-50/70">
                <Td className="max-w-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-400">
                      {l.image ? <img src={l.image} alt="" className="h-full w-full object-cover" loading="lazy" /> : <FiImage className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`${kindMeta.path}/${l.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="group inline-flex max-w-full items-center gap-1 font-medium text-gray-900 hover:text-brand-700"
                        title={l.title}
                      >
                        <span className="truncate">{l.title}</span>
                        <FiExternalLink className="h-3 w-3 shrink-0 text-gray-400 group-hover:text-brand-600" aria-label="Opens in a new tab" />
                      </Link>
                      <p className="truncate text-xs text-gray-500">
                        {[l.category?.name, l.location].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                  </div>
                </Td>
                <Td>
                  {l.user ? (
                    <Link to={`/admin/users?search=${encodeURIComponent(l.user.username)}`} className="hover:text-brand-700">
                      <span className="block font-medium text-gray-900">{`${l.user.firstName} ${l.user.lastName}`.trim()}</span>
                      <span className="text-xs text-gray-500">@{l.user.username}</span>
                    </Link>
                  ) : (
                    <span className="text-gray-400">Deleted user</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap">
                  <span className="font-semibold text-gray-900 tabular-nums">{price(l)}</span>
                  {l.kind === 'service' && l.priceType && (
                    <span className="block text-xs text-gray-500">{label(PRICE_TYPE_LABELS, l.priceType)}</span>
                  )}
                </Td>
                <Td>
                  <StatusBadge status={l.status} />
                </Td>
                <Td className="whitespace-nowrap">
                  <span title={new Date(l.createdAt).toLocaleString()}>{formatRelativeTime(l.createdAt)}</span>
                  <span className="block text-xs text-gray-400 tabular-nums">{l.viewCount.toLocaleString()} views</span>
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1.5">
                    {l.status === 'PENDING_REVIEW' && (
                      <>
                        <Button size="sm" variant="success" loading={busy} onClick={() => mutation.mutate({ listing: l, status: 'ACTIVE' })}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setAction({ listing: l, status: 'REJECTED' })}>
                          Reject
                        </Button>
                      </>
                    )}
                    {l.status === 'ACTIVE' && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setAction({ listing: l, status: 'SUSPENDED' })}>
                        Suspend
                      </Button>
                    )}
                    {['SUSPENDED', 'REJECTED', 'EXPIRED', 'DRAFT'].includes(l.status) && (
                      <Button size="sm" variant="outline" loading={busy} onClick={() => mutation.mutate({ listing: l, status: 'ACTIVE' })}>
                        Restore
                      </Button>
                    )}
                    {l.status === 'SOLD' && <span className="text-xs text-gray-400">No action needed</span>}
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
      </ListState>

      <ReasonDialog
        open={!!action}
        onClose={() => setAction(null)}
        loading={mutation.isPending}
        required
        title={action?.status === 'REJECTED' ? 'Reject this post?' : 'Suspend this post?'}
        description={
          action && (
            <>
              <span className="font-medium text-gray-900">“{action.listing.title}”</span>{' '}
              {action.status === 'REJECTED' ? 'will not be published.' : 'will be hidden from everyone except its owner.'} The
              owner will see your note.
            </>
          )
        }
        label="Reason"
        placeholder={action?.status === 'REJECTED' ? 'e.g. Photos do not show the actual item' : 'e.g. Reported as a scam by several users'}
        confirmLabel={action?.status === 'REJECTED' ? 'Reject post' : 'Suspend post'}
        onConfirm={(reason) => action && mutation.mutate({ listing: action.listing, status: action.status, reason })}
      />
    </div>
  );
}
