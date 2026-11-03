import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FiAlertTriangle,
  FiArrowRight,
  FiBriefcase,
  FiCheckCircle,
  FiDollarSign,
  FiHome,
  FiPackage,
  FiRefreshCw,
  FiShoppingBag,
  FiUsers,
} from 'react-icons/fi';
import { adminApi } from '../../services/admin.service';
import { getErrorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { cn, formatMoney, formatRelativeTime } from '../../lib/utils';
import { statusMeta } from '../../lib/labels';
import { useAuthStore } from '../../store/auth';
import { PageHeader } from '../../components/ui/page';
import { Card, CardHeader } from '../../components/ui/card';
import { StatCard } from '../../components/ui/stat';
import { Button } from '../../components/ui/button';
import { Avatar, fullName } from '../../components/ui/avatar';
import { ErrorState, Skeleton } from '../../components/ui/loading';
import type { StatusCount } from '../../types/admin';

const count = (rows: StatusCount[] | undefined, status?: string) =>
  rows?.reduce((n, r) => n + (!status || r.status === status ? r._count : 0), 0) ?? 0;

/** Fixed order and colour per status, so the bars read the same on every visit. */
const STATUS_ORDER: { status: string; color: string }[] = [
  { status: 'ACTIVE', color: 'bg-emerald-500' },
  { status: 'PENDING_REVIEW', color: 'bg-amber-400' },
  { status: 'SUSPENDED', color: 'bg-red-600' },
  { status: 'REJECTED', color: 'bg-red-300' },
  { status: 'SOLD', color: 'bg-brand-400' },
  { status: 'DRAFT', color: 'bg-gray-300' },
  { status: 'EXPIRED', color: 'bg-gray-400' },
];

const TYPES = [
  { key: 'marketplace', label: 'Marketplace', icon: FiShoppingBag, kind: '' },
  { key: 'services', label: 'Services', icon: FiBriefcase, kind: 'service' },
  { key: 'accommodation', label: 'Accommodation', icon: FiHome, kind: 'accommodation' },
] as const;

function listingsLink(kind: string, status?: string) {
  const q = new URLSearchParams();
  if (kind) q.set('kind', kind);
  if (status) q.set('status', status);
  const s = q.toString();
  return `/admin/listings${s ? `?${s}` : ''}`;
}

function StatusBar({ rows, kind }: { rows: StatusCount[]; kind: string }) {
  const total = count(rows);
  const parts = STATUS_ORDER.map((s) => ({ ...s, n: count(rows, s.status) })).filter((p) => p.n > 0);
  if (!total) return <p className="py-3 text-sm text-gray-400">No posts yet</p>;
  return (
    <>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${statusMeta(p.status).label}: ${p.n}`).join(', ')}>
        {parts.map((p) => (
          <div
            key={p.status}
            className={cn('h-full first:rounded-l-full last:rounded-r-full', p.color)}
            style={{ width: `${(p.n / total) * 100}%`, minWidth: 4 }}
            title={`${statusMeta(p.status).label}: ${p.n} (${Math.round((p.n / total) * 100)}%)`}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.status}>
            <Link to={listingsLink(kind, p.status)} className="flex items-center justify-between gap-2 rounded-md text-gray-600 hover:text-gray-900">
              <span className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', p.color)} aria-hidden="true" />
                {statusMeta(p.status).label}
              </span>
              <span className="font-medium text-gray-900 tabular-nums">{p.n.toLocaleString()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function AdminDashboard() {
  useDocumentTitle('Dashboard · Admin');
  const user = useAuthStore((s) => s.user);
  const { data: stats, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: () => adminApi.getDashboardStats(),
    refetchInterval: 60_000,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (error) {
    return (
      <Card>
        <ErrorState message={getErrorMessage(error, 'Could not load the dashboard')} onRetry={() => refetch()} />
      </Card>
    );
  }

  const L = stats?.listings;
  const pending = {
    marketplace: count(L?.marketplace, 'PENDING_REVIEW'),
    service: count(L?.services, 'PENDING_REVIEW'),
    accommodation: count(L?.accommodation, 'PENDING_REVIEW'),
  };
  const pendingPosts = pending.marketplace + pending.service + pending.accommodation;
  const livePosts = count(L?.marketplace, 'ACTIVE') + count(L?.services, 'ACTIVE') + count(L?.accommodation, 'ACTIVE');
  const allPosts = count(L?.marketplace) + count(L?.services) + count(L?.accommodation);
  const openReports = stats?.reports.open ?? 0;
  const pendingVerifications = stats?.pendingVerifications ?? 0;
  const queueTotal = pendingPosts + openReports + pendingVerifications;
  // Send moderators to the type with the most waiting, so one click lands on real work.
  const busiestKind = (Object.entries(pending).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'marketplace') as string;

  return (
    <div>
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        title={`${greeting}, ${user?.firstName || 'admin'}`}
        description={
          isLoading
            ? 'Loading the latest numbers…'
            : queueTotal
              ? `${queueTotal.toLocaleString()} item${queueTotal === 1 ? ' needs' : 's need'} your attention.`
              : 'Everything is up to date. Nothing is waiting for review.'
        }
        actions={
          <Button variant="outline" onClick={() => refetch()} loading={isFetching && !isLoading}>
            <FiRefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Work queues */}
          <section aria-labelledby="queues">
            <h2 id="queues" className="mb-3 text-sm font-semibold text-gray-900">
              Needs attention
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: 'Posts to review',
                  value: pendingPosts,
                  hint: `${pending.marketplace} marketplace · ${pending.service} services · ${pending.accommodation} accommodation`,
                  icon: FiPackage,
                  to: listingsLink(busiestKind === 'marketplace' ? '' : busiestKind, 'PENDING_REVIEW'),
                },
                { label: 'Open reports', value: openReports, hint: `${stats?.reports.total ?? 0} reports all time`, icon: FiAlertTriangle, to: '/admin/reports' },
                { label: 'Verifications waiting', value: pendingVerifications, hint: 'Members asking for a verified badge', icon: FiCheckCircle, to: '/admin/verification' },
              ].map((q) => (
                <Link
                  key={q.label}
                  to={q.to}
                  className={cn(
                    'group rounded-2xl border bg-white p-5 shadow-card transition-shadow hover:shadow-raised',
                    q.value ? 'border-amber-200 ring-1 ring-amber-100' : 'border-gray-200/80'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', q.value ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500')}>
                      <q.icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                      {q.value ? 'Review' : 'Open'}
                      <FiArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  <p className="mt-4 font-[family-name:var(--font-display)] text-[32px] leading-none font-bold text-gray-900 tabular-nums">
                    {q.value.toLocaleString()}
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-gray-700">{q.label}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{q.value ? q.hint : 'All clear'}</p>
                </Link>
              ))}
            </div>
          </section>

          {/* Headline numbers */}
          <section aria-labelledby="overview">
            <h2 id="overview" className="mb-3 text-sm font-semibold text-gray-900">
              Platform overview
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Members" value={(stats?.totalUsers ?? 0).toLocaleString()} hint={`${(stats?.activeUsers ?? 0).toLocaleString()} active`} icon={FiUsers} to="/admin/users" />
              <StatCard label="Live posts" value={livePosts.toLocaleString()} hint={`${allPosts.toLocaleString()} posts in total`} icon={FiPackage} tone="green" to={listingsLink('', 'ACTIVE')} />
              <StatCard label="Revenue" value={formatMoney(Number(stats?.revenue ?? 0))} hint="From successful promotion payments" icon={FiDollarSign} tone="accent" />
              <StatCard label="Reports" value={(stats?.reports.total ?? 0).toLocaleString()} hint={`${openReports} still open`} icon={FiAlertTriangle} tone={openReports ? 'amber' : 'gray'} to="/admin/reports?status=all" />
            </div>
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-5">
            {/* Posts by status */}
            <Card className="lg:col-span-3">
              <CardHeader title="Posts by status" description="Every post on the platform, by where it is in its life. Click a status to see those posts." />
              <div className="divide-y divide-gray-100">
                {TYPES.map((t) => (
                  <div key={t.key} className="px-5 py-4 sm:px-6">
                    <div className="mb-2.5 flex items-center justify-between">
                      <Link to={listingsLink(t.kind)} className="flex items-center gap-2 font-medium text-gray-900 hover:text-brand-700">
                        <t.icon className="h-4 w-4 text-gray-400" /> {t.label}
                      </Link>
                      <span className="text-sm text-gray-500 tabular-nums">{count(L?.[t.key]).toLocaleString()} total</span>
                    </div>
                    <StatusBar rows={L?.[t.key] ?? []} kind={t.kind} />
                  </div>
                ))}
              </div>
            </Card>

            {/* Recent sign-ups */}
            <Card className="lg:col-span-2">
              <CardHeader
                title="New members"
                actions={
                  <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
                    All users <FiArrowRight className="h-4 w-4" />
                  </Link>
                }
              />
              {stats?.recentUsers.length ? (
                <ul className="divide-y divide-gray-100">
                  {stats.recentUsers.map((u) => (
                    <li key={u.id}>
                      <Link to={`/admin/users?search=${encodeURIComponent(u.username)}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 sm:px-6">
                        <Avatar person={u} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{fullName(u)}</p>
                          <p className="truncate text-xs text-gray-500">{u.email}</p>
                        </div>
                        <span className="shrink-0 text-xs text-gray-400">{formatRelativeTime(u.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-6 py-8 text-center text-sm text-gray-400">No one has signed up yet</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
