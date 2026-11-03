import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FiCalendar, FiImage, FiInbox, FiMapPin, FiMessageSquare, FiPhone, FiShoppingBag } from 'react-icons/fi';
import { ordersApi, Order, OrderAction } from '../../services/orders.service';
import { messagesApi } from '../../services/engagement.service';
import { getErrorMessage } from '../../lib/api';
import { useDocumentTitle, useOrderCounts } from '../../lib/hooks';
import { cn, formatMoney, formatRelativeTime } from '../../lib/utils';
import { useUrlFilters } from '../../components/browse/Browse';
import { Page, PageHeader } from '../../components/ui/page';
import { Tabs, Segmented } from '../../components/ui/tabs';
import { Badge, StatusBadge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Avatar } from '../../components/ui/avatar';
import { ConfirmDialog } from '../../components/ui/modal';
import { Pagination } from '../../components/ui/pagination';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/loading';
import { ReasonDialog } from '../../components/admin/AdminParts';

const KIND: Record<Order['targetType'], { label: string; noun: string }> = {
  LISTING: { label: 'Item', noun: 'order' },
  SERVICE: { label: 'Service', noun: 'booking' },
  PROPERTY: { label: 'Viewing', noun: 'viewing request' },
};

const STATUS_TABS = [
  { key: 'open', label: 'Open' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'DECLINED', label: 'Declined' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

/** What happens next, in plain words, for each status and side. */
function nextStep(o: Order, seller: boolean) {
  if (o.status === 'PENDING') return seller ? 'Accept or decline this request.' : 'Waiting for the seller to respond.';
  if (o.status === 'ACCEPTED') return seller ? 'Arrange the hand-over, then mark it completed.' : 'Accepted. Arrange payment and pick-up in chat.';
  return null;
}

function OrderCard({ order: o, seller, onAction, busy }: { order: Order; seller: boolean; onAction: (o: Order, a: OrderAction) => void; busy: boolean }) {
  const navigate = useNavigate();
  const other = seller ? o.buyer : o.seller;
  const phone = seller ? o.contactPhone : other.phone;
  const tel = phone?.replace(/[^\d+]/g, '');
  const total = o.unitPrice != null ? Number(o.unitPrice) * (o.targetType === 'SERVICE' ? 1 : o.quantity) : null;
  const step = nextStep(o, seller);

  const chat = useMutation({
    mutationFn: () => messagesApi.start(other.id),
    onSuccess: (c) => navigate(`/messages/${c.id}`),
    onError: (err) => toast.error(getErrorMessage(err, "Couldn't open the chat")),
  });

  return (
    <li className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-card sm:p-5">
      <div className="flex gap-4">
        <Link to={o.target?.url ?? '#'} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-24 sm:w-24">
          {o.target?.image ? (
            <img src={o.target.image} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-gray-400">
              <FiImage className="h-6 w-6" />
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="gray">{KIND[o.targetType].label}</Badge>
            <StatusBadge status={o.status} />
            <span className="text-xs text-gray-400">#{o.id} · {formatRelativeTime(o.createdAt)}</span>
          </div>
          <h3 className="mt-1.5 truncate font-semibold text-gray-900">
            {o.target ? (
              <Link to={o.target.url} className="hover:text-brand-700">
                {o.title}
              </Link>
            ) : (
              o.title
            )}
          </h3>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
            {o.targetType !== 'SERVICE' && <span>{o.targetType === 'PROPERTY' ? 'Rooms' : 'Qty'}: {o.quantity}</span>}
            {total !== null && <span className="font-semibold text-gray-900 tabular-nums">{formatMoney(total, o.currency)}{o.targetType === 'PROPERTY' ? ' / month' : ''}</span>}
            {o.preferredDate && (
              <span className="flex items-center gap-1">
                <FiCalendar className="h-3.5 w-3.5" /> {new Date(o.preferredDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            )}
            {(o.meetingPlace || o.target?.location) && (
              <span className="flex items-center gap-1">
                <FiMapPin className="h-3.5 w-3.5" /> {o.meetingPlace || o.target?.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {o.message && <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-sm whitespace-pre-line text-gray-700">“{o.message}”</p>}
      {o.sellerNote && <p className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">Seller’s note: {o.sellerNote}</p>}

      <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar person={other} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {other.firstName} {other.lastName} <span className="font-normal text-gray-400">· {seller ? 'customer' : 'seller'}</span>
            </p>
            {phone && <p className="text-xs text-gray-500 tabular-nums">{phone}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tel && (
            <a href={`tel:${tel}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50">
              <FiPhone className="h-4 w-4" /> Call
            </a>
          )}
          <Button
            size="sm"
            variant="outline"
            loading={chat.isPending}
            onClick={() => (o.conversationId ? navigate(`/messages/${o.conversationId}`) : chat.mutate())}
          >
            <FiMessageSquare className="h-4 w-4" /> Chat
          </Button>
          {seller && o.status === 'PENDING' && (
            <>
              <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" disabled={busy} onClick={() => onAction(o, 'decline')}>
                Decline
              </Button>
              <Button size="sm" variant="success" loading={busy} onClick={() => onAction(o, 'accept')}>
                Accept
              </Button>
            </>
          )}
          {seller && o.status === 'ACCEPTED' && (
            <Button size="sm" variant="success" loading={busy} onClick={() => onAction(o, 'complete')}>
              Mark completed
            </Button>
          )}
          {!seller && (o.status === 'PENDING' || o.status === 'ACCEPTED') && (
            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" disabled={busy} onClick={() => onAction(o, 'cancel')}>
              Cancel
            </Button>
          )}
        </div>
      </div>
      {step && <p className={cn('mt-3 text-xs font-medium', o.status === 'PENDING' ? 'text-amber-700' : 'text-brand-700')}>{step}</p>}
    </li>
  );
}

export default function OrdersPage() {
  useDocumentTitle('Orders');
  const queryClient = useQueryClient();
  const { get, set, page } = useUrlFilters();
  const counts = useOrderCounts();
  const role = get('role') === 'seller' ? 'seller' : 'buyer';
  const status = get('status') || 'open';
  const [pending, setPending] = useState<{ order: Order; action: OrderAction } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['orders', role, status, page],
    queryFn: () => ordersApi.list(role, status === 'all' ? undefined : status, page),
    placeholderData: (prev) => prev,
    refetchInterval: 30_000,
  });

  const act = useMutation({
    mutationFn: ({ order, action, note }: { order: Order; action: OrderAction; note?: string }) => ordersApi.act(order.id, action, note),
    onSuccess: (_d, { action }) => {
      const msg: Record<OrderAction, string> = {
        accept: 'Accepted. The customer has been notified.',
        decline: 'Declined. The customer has been notified.',
        complete: 'Marked as completed. Thank you!',
        cancel: 'Your request was cancelled.',
      };
      toast.success(msg[action]);
      setPending(null);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Could not update this order')),
  });

  const onAction = (order: Order, action: OrderAction) => {
    if (action === 'accept') act.mutate({ order, action });
    else setPending({ order, action });
  };
  const orders = data?.data ?? [];

  return (
    <Page width="md">
      <PageHeader title="Orders" description="Everything you've ordered or booked, and requests from your customers." />
      <Tabs
        className="mb-4"
        value={role}
        onChange={(r) => set({ role: r === 'seller' ? 'seller' : null, status: null })}
        items={[
          { key: 'buyer', label: 'My orders', icon: FiShoppingBag, count: counts.mine || undefined },
          { key: 'seller', label: 'Received', icon: FiInbox, count: counts.incoming || undefined },
        ]}
      />
      <Segmented className="mb-5" value={status} onChange={(s) => set({ status: s === 'open' ? null : s })} items={STATUS_TABS} />

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load your orders")} onRetry={() => refetch()} />
      ) : !orders.length ? (
        <EmptyState
          icon={role === 'seller' ? <FiInbox /> : <FiShoppingBag />}
          title={role === 'seller' ? 'No requests here' : 'No orders here'}
          message={role === 'seller' ? 'When customers order your items, book your services or ask to view your rooms, the requests appear here.' : 'Find something you like and choose “Order now”, “Book this service” or “Request a viewing”.'}
        >
          {role === 'buyer' && (
            <Link to="/marketplace" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
              Browse the Campus Market →
            </Link>
          )}
        </EmptyState>
      ) : (
        <>
          <ul className="stagger space-y-4">
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} seller={role === 'seller'} onAction={onAction} busy={act.isPending && act.variables?.order.id === o.id} />
            ))}
          </ul>
          <Pagination meta={data?.meta} onPageChange={(p) => set({ page: String(p) }, false)} noun="orders" className="mt-6" />
        </>
      )}

      <ReasonDialog
        open={pending?.action === 'decline'}
        onClose={() => setPending(null)}
        loading={act.isPending}
        title="Decline this request?"
        description="The customer is notified. A short reason helps them."
        label="Reason"
        placeholder="e.g. Sorry, it was sold to someone else"
        confirmLabel="Decline"
        onConfirm={(note) => pending && act.mutate({ order: pending.order, action: 'decline', note })}
      />
      <ReasonDialog
        open={pending?.action === 'complete'}
        onClose={() => setPending(null)}
        loading={act.isPending}
        tone="success"
        title="Mark as completed?"
        description={pending?.order.targetType === 'LISTING' ? 'Use this after the hand-over. The quantity is taken off your listing, and it is marked sold when none are left.' : 'Use this once the job or viewing is done.'}
        label="Note for the customer"
        placeholder="e.g. Thanks for your purchase!"
        confirmLabel="Mark completed"
        onConfirm={(note) => pending && act.mutate({ order: pending.order, action: 'complete', note })}
      />
      <ConfirmDialog
        open={pending?.action === 'cancel'}
        onClose={() => setPending(null)}
        onConfirm={() => pending && act.mutate({ order: pending.order, action: 'cancel' })}
        loading={act.isPending}
        title="Cancel this request?"
        message="The seller is notified. You can send a new request later."
        confirmLabel="Cancel request"
      />
    </Page>
  );
}
