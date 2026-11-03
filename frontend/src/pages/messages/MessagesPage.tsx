import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiMessageCircle, FiSearch } from 'react-icons/fi';
import { messagesApi } from '../../services/engagement.service';
import { getErrorMessage } from '../../lib/api';
import { formatRelativeTime, cn } from '../../lib/utils';
import { useDocumentTitle } from '../../lib/hooks';
import { useAuthStore } from '../../store/auth';
import { Avatar, fullName } from '../../components/ui/avatar';
import { ButtonLink } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Page, PageHeader } from '../../components/ui/page';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/loading';

export default function MessagesPage() {
  useDocumentTitle('Messages');
  const me = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState('');

  const { data: conversations = [], isLoading, error, refetch } = useQuery({
    queryKey: ['messages', 'conversations'],
    queryFn: messagesApi.list,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) => fullName(c.otherUser).toLowerCase().includes(q) || c.otherUser?.username?.toLowerCase().includes(q)
    );
  }, [conversations, filter]);

  const unread = conversations.reduce((n, c) => n + (c.unreadCount || 0), 0);

  return (
    <Page width="md">
      <PageHeader
        title="Messages"
        description={unread ? `${unread} unread message${unread > 1 ? 's' : ''}` : 'Your private conversations with buyers, sellers and landlords.'}
      />

      <Card className="overflow-hidden">
        {conversations.length > 5 && (
          <div className="border-b border-gray-100 p-3">
            <Input leadingIcon={<FiSearch />} placeholder="Search by name" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Search conversations" />
          </div>
        )}

        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : error ? (
          <ErrorState message={getErrorMessage(error, "Couldn't load your conversations")} onRetry={() => refetch()} />
        ) : !conversations.length ? (
          <EmptyState
            icon={<FiMessageCircle />}
            title="No conversations yet"
            message="Tap “Message” on any item, service or room to start a private chat."
          >
            <ButtonLink to="/marketplace" variant="outline">
              Browse the marketplace
            </ButtonLink>
          </EmptyState>
        ) : !visible.length ? (
          <EmptyState icon={<FiSearch />} title="No matches" message={`Nobody called “${filter}” in your inbox.`} />
        ) : (
          <ul className="divide-y divide-gray-100">
            {visible.map((c) => {
              const unreadHere = c.unreadCount > 0;
              const mine = c.lastMessage?.senderId === me?.id;
              return (
                <li key={c.id}>
                  <Link
                    to={`/messages/${c.id}`}
                    className={cn('flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50 sm:px-5', unreadHere && 'bg-brand-50/40')}
                  >
                    <Avatar person={c.otherUser} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn('truncate text-sm', unreadHere ? 'font-semibold text-gray-900' : 'font-medium text-gray-800')}>
                          {fullName(c.otherUser)}
                        </p>
                        <span className={cn('shrink-0 text-xs', unreadHere ? 'font-semibold text-brand-700' : 'text-gray-400')}>
                          {formatRelativeTime(c.lastMessage?.createdAt ?? c.updatedAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className={cn('truncate text-sm', unreadHere ? 'text-gray-800' : 'text-gray-500')}>
                          {mine && <span className="text-gray-400">You: </span>}
                          {c.lastMessage?.content ?? 'Say hello 👋'}
                        </p>
                        {unreadHere && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white tabular-nums">
                            {c.unreadCount > 99 ? '99+' : c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </Page>
  );
}
