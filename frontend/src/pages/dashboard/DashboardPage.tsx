import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiBriefcase, FiEdit2, FiEye, FiHome, FiPackage, FiPlus, FiTrash2 } from 'react-icons/fi';
import { toast } from 'sonner';
import { marketplaceApi } from '../../services/marketplace.service';
import { accommodationApi, servicesApi } from '../../services/listing.service';
import { getErrorMessage } from '../../lib/api';
import { formatMoney, formatRelativeTime } from '../../lib/utils';
import { statusMeta } from '../../lib/labels';
import { useDocumentTitle } from '../../lib/hooks';
import { useAuthStore } from '../../store/auth';
import { ListingImage } from '../../types';
import { StatusBadge } from '../../components/ui/badge';
import { Button, ButtonLink } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ConfirmDialog } from '../../components/ui/modal';
import { Page, PageHeader } from '../../components/ui/page';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/loading';
import { StatCard } from '../../components/ui/stat';
import { Tabs } from '../../components/ui/tabs';
import { primaryImage } from '../../components/listing/CardShell';
import { servicePrice } from '../../components/listing/ServiceCard';

type Kind = 'listings' | 'services' | 'properties';

interface Row {
  id: number;
  kind: Kind;
  title: string;
  slug: string;
  status: string;
  price: string;
  images?: ListingImage[];
  viewCount?: number;
  createdAt: string;
}

const KIND = {
  listings: { base: '/marketplace', noun: 'listing', icon: FiPackage, create: '/marketplace/create', createLabel: 'Sell an item' },
  services: { base: '/services', noun: 'service', icon: FiBriefcase, create: '/services/create', createLabel: 'Offer a service' },
  properties: { base: '/accommodation', noun: 'property', icon: FiHome, create: '/accommodation/create', createLabel: 'List accommodation' },
} as const;

export default function DashboardPage() {
  useDocumentTitle('My posts');
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Kind>(() => {
    const t = params.get('tab');
    return t === 'services' || t === 'properties' ? t : 'listings';
  });
  const [toDelete, setToDelete] = useState<Row | null>(null);

  // 50 is the API maximum; enough for a personal dashboard.
  const listings = useQuery({ queryKey: ['dashboard', 'listings'], queryFn: () => marketplaceApi.getMyListings(1, 50) });
  const services = useQuery({ queryKey: ['dashboard', 'services'], queryFn: () => servicesApi.getMyServices(1, 50) });
  const properties = useQuery({ queryKey: ['dashboard', 'properties'], queryFn: () => accommodationApi.getMyProperties(1, 50) });

  const rows: Record<Kind, Row[]> = {
    listings: (listings.data?.data ?? []).map((l) => ({
      id: l.id, kind: 'listings', title: l.title, slug: l.slug, status: l.status, images: l.images,
      viewCount: l.viewCount, createdAt: l.createdAt, price: formatMoney(l.price, l.currency),
    })),
    services: (services.data?.data ?? []).map((s) => ({
      id: s.id, kind: 'services', title: s.title, slug: s.slug, status: s.status, images: s.images,
      viewCount: s.viewCount, createdAt: s.createdAt, price: servicePrice(s),
    })),
    properties: (properties.data?.data ?? []).map((p) => ({
      id: p.id, kind: 'properties', title: p.title, slug: p.slug, status: p.status, images: p.images,
      viewCount: p.viewCount, createdAt: p.createdAt, price: `${formatMoney(p.monthlyPrice, p.currency)} / month`,
    })),
  };
  const queries = { listings, services, properties };
  const all = [...rows.listings, ...rows.services, ...rows.properties];
  const count = (s: string) => all.filter((r) => r.status === s).length;

  const remove = useMutation({
    mutationFn: (row: Row) =>
      row.kind === 'listings'
        ? marketplaceApi.deleteListing(row.id)
        : row.kind === 'services'
          ? servicesApi.deleteService(row.id)
          : accommodationApi.deleteProperty(row.id),
    onSuccess: (_d, row) => {
      toast.success(`Deleted “${row.title}”`);
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: [KIND[row.kind].base.slice(1)] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Couldn't delete it")),
  });

  const active = queries[tab];
  const list = rows[tab];
  const meta = KIND[tab];

  return (
    <Page>
      <PageHeader
        eyebrow={`Hi, ${user?.firstName ?? 'there'}`}
        title="My posts"
        description="Everything you've posted, its review status, and how it's doing."
        actions={
          <ButtonLink to="/post">
            <FiPlus className="h-4 w-4" />
            New post
          </ButtonLink>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Live" value={count('ACTIVE')} tone="green" hint="Visible to everyone" />
        <StatCard label="In review" value={count('PENDING_REVIEW')} tone="amber" hint="Usually within a day" />
        <StatCard label="Needs attention" value={count('REJECTED') + count('SUSPENDED')} tone="red" hint="Rejected or suspended" />
        <StatCard label="Total views" value={all.reduce((n, r) => n + (r.viewCount ?? 0), 0).toLocaleString()} tone="brand" />
      </div>

      <Card>
        <Tabs
          className="px-3 sm:px-4"
          value={tab}
          onChange={setTab}
          items={[
            { key: 'listings', label: 'Items', icon: FiPackage, count: rows.listings.length },
            { key: 'services', label: 'Services', icon: FiBriefcase, count: rows.services.length },
            { key: 'properties', label: 'Accommodation', icon: FiHome, count: rows.properties.length },
          ]}
        />

        {active.isLoading ? (
          <ListSkeleton rows={4} />
        ) : active.error ? (
          <ErrorState message={getErrorMessage(active.error, "Couldn't load your posts")} onRetry={() => active.refetch()} />
        ) : !list.length ? (
          <EmptyState icon={<meta.icon />} title={`No ${meta.noun === 'property' ? 'accommodation' : meta.noun + 's'} yet`} message="Post one in a couple of minutes.">
            <ButtonLink to={meta.create}>{meta.createLabel}</ButtonLink>
          </EmptyState>
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map((row) => {
              const image = primaryImage(row.images);
              const status = statusMeta(row.status);
              const href = `${meta.base}/${row.slug}`;
              return (
                <li key={row.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:px-5">
                  <Link to={href} className="flex min-w-0 flex-1 items-center gap-4">
                    <span className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-gray-300">
                      {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <meta.icon className="h-6 w-6" />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold text-gray-900 hover:text-brand-700">{row.title}</span>
                        <StatusBadge status={row.status} />
                      </span>
                      <span className="mt-0.5 block text-sm font-medium text-gray-700 tabular-nums">{row.price}</span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        Posted {formatRelativeTime(row.createdAt)}
                        {row.viewCount ? ` · ${row.viewCount} views` : ''}
                        {row.status !== 'ACTIVE' && status.hint ? ` · ${status.hint}` : ''}
                      </span>
                    </span>
                  </Link>
                  <div className="flex shrink-0 gap-1.5 sm:justify-end">
                    <ButtonLink to={href} variant="ghost" size="sm">
                      <FiEye className="h-3.5 w-3.5" /> View
                    </ButtonLink>
                    <ButtonLink to={`${href}/edit`} variant="outline" size="sm">
                      <FiEdit2 className="h-3.5 w-3.5" /> Edit
                    </ButtonLink>
                    <Button variant="ghost" size="sm" onClick={() => setToDelete(row)} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                      <FiTrash2 className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only">Delete</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        loading={remove.isPending}
        title="Delete this post?"
        message={<>“{toDelete?.title}” will be removed from CAV CONNECT. This can't be undone.</>}
        confirmLabel="Delete"
      />
    </Page>
  );
}
