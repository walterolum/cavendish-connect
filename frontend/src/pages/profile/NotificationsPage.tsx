import { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FiAlertTriangle,
  FiBell,
  FiCheckCircle,
  FiClock,
  FiMessageSquare,
  FiShield,
  FiStar,
  FiTrendingUp,
  FiXCircle, FiShoppingBag } from 'react-icons/fi';
import { getErrorMessage } from '../../lib/api';
import { AppNotification, notificationsApi } from '../../services/notifications.service';
import { formatRelativeTime, cn } from '../../lib/utils';
import { useDocumentTitle } from '../../lib/hooks';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Page, PageHeader } from '../../components/ui/page';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/loading';

const TYPE_META: Record<string, { icon: ComponentType<{ className?: string }>; tone: string }> = {
  NEW_MESSAGE: { icon: FiMessageSquare, tone: 'bg-brand-50 text-brand-700' },
  NEW_INQUIRY: { icon: FiMessageSquare, tone: 'bg-brand-50 text-brand-700' },
  LISTING_APPROVED: { icon: FiCheckCircle, tone: 'bg-emerald-50 text-emerald-700' },
  LISTING_REJECTED: { icon: FiXCircle, tone: 'bg-red-50 text-red-600' },
  LISTING_EXPIRED: { icon: FiClock, tone: 'bg-gray-100 text-gray-600' },
  REVIEW_RECEIVED: { icon: FiStar, tone: 'bg-accent-50 text-accent-600' },
  VERIFICATION_STATUS: { icon: FiShield, tone: 'bg-brand-50 text-brand-700' },
  PROMOTION_ACTIVE: { icon: FiTrendingUp, tone: 'bg-accent-50 text-accent-600' },
  SYSTEM_ANNOUNCEMENT: { icon: FiAlertTriangle, tone: 'bg-amber-50 text-amber-700' },
  ORDER_RECEIVED: { icon: FiShoppingBag, tone: 'bg-emerald-50 text-emerald-700' },
  ORDER_UPDATE: { icon: FiShoppingBag, tone: 'bg-brand-50 text-brand-700' },
};

/** Where a notification should take the user, if anywhere. */
function destination(n: AppNotification): string | null {
  if (n.targetType === 'CONVERSATION' && n.targetId) return `/messages/${n.targetId}`;
  if (n.type === 'VERIFICATION_STATUS') return '/profile';
  if (n.type === 'ORDER_RECEIVED') return '/orders?role=seller';
  if (n.type === 'ORDER_UPDATE') return '/orders';
  if (n.targetType === 'REPORT') return null;
  if (n.type.startsWith('LISTING_') || n.targetType === 'MARKETPLACE') return '/dashboard';
  return null;
}

export default function NotificationsPage() {
  useDocumentTitle('Notifications');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.getNotifications(),
    refetchOnWindowFocus: true,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const markRead = useMutation({ mutationFn: (id: number) => notificationsApi.markAsRead(id), onSuccess: refresh });
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      refresh();
      toast.success('All caught up');
    },
    onError: (err) => toast.error(getErrorMessage(err, "Couldn't update notifications")),
  });

  const notifications = data?.data ?? [];
  const unread = notifications.filter((n) => !n.isRead).length;

  const open = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    const to = destination(n);
    if (to) navigate(to);
  };

  return (
    <Page width="md">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up."}
        actions={
          <Button variant="outline" size="sm" disabled={!unread} loading={markAll.isPending} onClick={() => markAll.mutate()}>
            Mark all as read
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : error ? (
          <ErrorState message={getErrorMessage(error, "Couldn't load notifications")} onRetry={() => refetch()} />
        ) : !notifications.length ? (
          <EmptyState icon={<FiBell />} title="Nothing yet" message="Messages, review decisions and verification updates will show up here." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {notifications.map((n) => {
              const meta = TYPE_META[n.type] ?? { icon: FiBell, tone: 'bg-gray-100 text-gray-600' };
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-gray-50 sm:px-5',
                      !n.isRead && 'bg-brand-50/40'
                    )}
                  >
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', meta.tone)}>
                      <meta.icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className={cn('text-sm', n.isRead ? 'font-medium text-gray-800' : 'font-semibold text-gray-900')}>{n.title}</span>
                        <span className="shrink-0 text-xs text-gray-400">{formatRelativeTime(n.createdAt)}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-sm text-gray-600">{n.message}</span>
                      {n.actor && <span className="mt-1 block text-xs text-gray-400">from @{n.actor.username}</span>}
                    </span>
                    {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </Page>
  );
}
