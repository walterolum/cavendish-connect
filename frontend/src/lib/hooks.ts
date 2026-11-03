import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '../store/auth';
import { messagesApi } from '../services/engagement.service';
import { notificationsApi } from '../services/notifications.service';
import { favoritesApi, FavoriteType } from '../services/favorites.service';
import { getErrorMessage } from './api';

/** Path to the sign-in page that returns the user to where they were. */
export function loginPath(from: string) {
  return `/login?redirect=${encodeURIComponent(from)}`;
}

/**
 * Returns a guard for actions that need an account. When signed out it sends
 * the user to sign in, then back to this page, instead of failing with an error.
 */
export function useAuthGate() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (reason: string) => {
      if (isAuthenticated) return true;
      toast.info(reason);
      navigate(loginPath(location.pathname + location.search));
      return false;
    },
    [isAuthenticated, navigate, location.pathname, location.search]
  );
}

/** Opens (or reuses) a private conversation with another user. */
export function useStartConversation() {
  const navigate = useNavigate();
  const gate = useAuthGate();
  const me = useAuthStore((s) => s.user);

  const mutation = useMutation({
    mutationFn: (userId: number) => messagesApi.start(userId),
    onSuccess: (conversation) => navigate(`/messages/${conversation.id}`),
    onError: (err) => toast.error(getErrorMessage(err, "Couldn't open the conversation")),
  });

  const start = (userId: number | undefined) => {
    if (!userId || !gate('Sign in to send a message')) return;
    if (me?.id === userId) {
      toast.info('This is your own post');
      return;
    }
    mutation.mutate(userId);
  };

  return { start, isPending: mutation.isPending };
}

/**
 * Save/unsave toggle with an optimistic update on the detail query, so the
 * heart responds instantly and rolls back if the request fails.
 */
export function useFavoriteToggle(type: FavoriteType, id: number | undefined, detailKey: unknown[]) {
  const queryClient = useQueryClient();
  const gate = useAuthGate();

  const mutation = useMutation({
    mutationFn: () => favoritesApi.toggleFavorite(type, id!),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<{ isFavorited?: boolean }>(detailKey);
      queryClient.setQueryData(detailKey, (old: any) => (old ? { ...old, isFavorited: !old.isFavorited } : old));
      return { previous };
    },
    onError: (err, _v, ctx) => {
      queryClient.setQueryData(detailKey, ctx?.previous);
      toast.error(getErrorMessage(err, "Couldn't update your saved items"));
    },
    onSuccess: (res) => {
      toast.success(res?.favorited ? 'Saved to your favourites' : 'Removed from favourites');
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const toggle = () => {
    if (!id || !gate('Sign in to save items')) return;
    mutation.mutate();
  };

  return { toggle, isPending: mutation.isPending };
}

/** Unread message + notification counts for the navigation badges. */
export function useUnreadCounts() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const opts = { enabled: isAuthenticated, refetchInterval: 30_000, refetchOnWindowFocus: true, staleTime: 10_000 };

  const messages = useQuery({ queryKey: ['messages', 'unread'], queryFn: messagesApi.unreadCount, ...opts });
  const notifications = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: notificationsApi.unreadCount,
    ...opts,
  });

  return {
    messages: isAuthenticated ? messages.data ?? 0 : 0,
    notifications: isAuthenticated ? notifications.data ?? 0 : 0,
  };
}

/** Sets the browser tab title for the current page. */
export function useDocumentTitle(title?: string) {
  const full = title ? `${title} · CAV CONNECT` : 'CAV CONNECT · Connect. Buy. Sell. Serve. Find.';
  if (typeof document !== 'undefined' && document.title !== full) document.title = full;
}

/** How often lists check for newly posted items. */
export const LIVE_REFRESH_MS = 20_000;

/**
 * Remembers which items were already on screen, so items that arrive in a
 * later refresh can be highlighted as "just posted". Nothing is highlighted
 * on the first load.
 */
export function useNewArrivals(ids: (number | undefined)[] | undefined) {
  const seen = useRef<Set<number> | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(() => new Set());
  const key = (ids ?? []).join(',');

  useEffect(() => {
    if (!ids) return;
    const current = ids.filter((x): x is number => typeof x === 'number');
    if (seen.current === null) {
      seen.current = new Set(current);
      return;
    }
    const added = current.filter((id) => !seen.current!.has(id));
    added.forEach((id) => seen.current!.add(id));
    if (added.length) {
      setFresh((prev) => new Set([...prev, ...added]));
      // The highlight fades after a while, like a notification.
      const t = window.setTimeout(() => setFresh((prev) => new Set([...prev].filter((id) => !added.includes(id)))), 15_000);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return fresh;
}
