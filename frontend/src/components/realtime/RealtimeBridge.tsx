import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChatMessage, ConversationDetail, messagePreview } from '../../services/engagement.service';
import { chime, startRealtime, useLiveStore, useRealtime } from '../../lib/realtime';
import { useAuthStore } from '../../store/auth';

const convKey = (id: number) => ['messages', 'conversation', String(id)];

/** Applies live events to cached data so every screen updates instantly. */
export function RealtimeBridge() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const live = useLiveStore();

  useEffect(() => startRealtime(), []);

  useRealtime('message', ({ conversationId, message }: { conversationId: number; message: ChatMessage }) => {
    const viewing = location.pathname === `/messages/${conversationId}`;
    if (viewing) {
      // Refetching marks it read on the server, which sends the sender their ✓✓.
      queryClient.setQueryData<ConversationDetail>(convKey(conversationId), (old) =>
        old && !old.messages.some((m) => m.id === message.id) ? { ...old, messages: [...old.messages.filter((m) => m.id > 0 || m.content !== message.content), message] } : old
      );
      queryClient.invalidateQueries({ queryKey: convKey(conversationId) });
    }
    queryClient.invalidateQueries({ queryKey: ['messages', 'conversations'] });
    queryClient.invalidateQueries({ queryKey: ['messages', 'unread'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    if (message.senderId !== me?.id && !viewing) {
      chime();
      toast(`${message.sender?.firstName ?? 'New message'}`, {
        description: messagePreview(message).slice(0, 120),
        action: { label: 'Open', onClick: () => navigate(`/messages/${conversationId}`) },
      });
    }
  });

  useRealtime('message:update', ({ conversationId, message }: { conversationId: number; message: ChatMessage }) => {
    queryClient.setQueryData<ConversationDetail>(convKey(conversationId), (old) =>
      old ? { ...old, messages: old.messages.map((m) => (m.id === message.id ? message : m)) } : old
    );
  });

  useRealtime('read', ({ conversationId }: { conversationId: number }) => {
    queryClient.setQueryData<ConversationDetail>(convKey(conversationId), (old) =>
      old ? { ...old, messages: old.messages.map((m) => (m.senderId === me?.id ? { ...m, isRead: true } : m)) } : old
    );
  });

  useRealtime('typing', ({ conversationId, userId }: { conversationId: number; userId: number }) => {
    if (userId !== me?.id) live.setTyping(conversationId);
  });

  useRealtime('presence', ({ userId, online }: { userId: number; online: boolean }) => {
    live.setOnline(userId, online);
  });

  return null;
}
