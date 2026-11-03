import { FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiArrowLeft, FiSend } from 'react-icons/fi';
import { toast } from 'sonner';
import { ChatMessage, ConversationDetail, messagesApi } from '../../services/engagement.service';
import { getErrorMessage, isNotFound } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useDocumentTitle } from '../../lib/hooks';
import { useAuthStore } from '../../store/auth';
import { Avatar, fullName } from '../../components/ui/avatar';
import { Button, ButtonLink } from '../../components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/loading';

function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const key = ['messages', 'conversation', id];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => messagesApi.get(id!),
    enabled: !!id,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
  useDocumentTitle(data?.otherUser ? `Chat with ${fullName(data.otherUser)}` : 'Messages');

  // Opening the chat marks it read on the server; refresh the badges.
  useEffect(() => {
    if (data) {
      queryClient.invalidateQueries({ queryKey: ['messages', 'unread'] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'conversations'] });
    }
  }, [data?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useMutation({
    mutationFn: (content: string) => messagesApi.send(id!, content),
    // Show the message immediately; reconcile with the server afterwards.
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ConversationDetail>(key);
      const optimistic: ChatMessage = {
        id: -Date.now(),
        conversationId: Number(id),
        senderId: me!.id,
        content,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ConversationDetail>(key, (old) => (old ? { ...old, messages: [...old.messages, optimistic] } : old));
      setDraft('');
      return { previous, content };
    },
    onError: (err, _v, ctx) => {
      queryClient.setQueryData(key, ctx?.previous);
      setDraft(ctx?.content ?? '');
      toast.error(getErrorMessage(err, "Message not sent. Check your connection and try again."));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ['messages', 'conversations'] });
    },
  });

  const messages = data?.messages ?? [];

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const content = draft.trim();
    if (!content || send.isPending) return;
    send.mutate(content);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds a new line.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        {isNotFound(error) || (error as any)?.response?.status === 403 ? (
          <EmptyState title="Conversation not found" message="It may have been removed, or you're not part of it.">
            <ButtonLink to="/messages">Back to inbox</ButtonLink>
          </EmptyState>
        ) : (
          <ErrorState message={getErrorMessage(error, "Couldn't load this conversation")} onRetry={() => refetch()} />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-3 py-2.5 sm:px-4">
          <Link to="/messages" className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Back to inbox">
            <FiArrowLeft className="h-5 w-5" />
          </Link>
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </>
          ) : (
            <>
              <Avatar person={data?.otherUser} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{fullName(data?.otherUser)}</p>
                {data?.otherUser?.username && <p className="truncate text-xs text-gray-500">@{data.otherUser.username}</p>}
              </div>
            </>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-48 rounded-2xl" />
              <Skeleton className="ml-auto h-10 w-56 rounded-2xl" />
              <Skeleton className="h-10 w-40 rounded-2xl" />
            </div>
          ) : !messages.length ? (
            <div className="py-16 text-center">
              <Avatar person={data?.otherUser} size="lg" className="mx-auto" />
              <p className="mt-3 font-semibold text-gray-900">Start the conversation</p>
              <p className="mt-1 text-sm text-gray-500">Say hello and ask anything about the post. Keep payments and meet-ups safe.</p>
            </div>
          ) : (
            messages.map((m, i) => {
              const mine = m.senderId === me?.id;
              const prev = messages[i - 1];
              const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
              const grouped = prev && !newDay && prev.senderId === m.senderId;
              const pending = m.id < 0;
              return (
                <div key={m.id}>
                  {newDay && (
                    <div className="my-4 flex justify-center">
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-gray-500 shadow-card">
                        {dayLabel(new Date(m.createdAt))}
                      </span>
                    </div>
                  )}
                  <div className={cn('flex', mine ? 'justify-end' : 'justify-start', grouped ? 'mt-1' : 'mt-3')}>
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-card sm:max-w-[70%]',
                        mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-white text-gray-900',
                        pending && 'opacity-70'
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      <p className={cn('mt-0.5 text-right text-[10px]', mine ? 'text-brand-100' : 'text-gray-400')}>
                        {pending ? 'Sending…' : time(m.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pb-safe border-t border-gray-200 bg-white">
        <form onSubmit={submit} className="mx-auto flex max-w-3xl items-end gap-2 px-3 py-3 sm:px-4">
          <label htmlFor="message" className="sr-only">
            Message
          </label>
          <textarea
            id="message"
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={5000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Write a message…"
            className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-[15px] shadow-card [field-sizing:content] placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="h-11 w-11 rounded-full" disabled={!draft.trim()} aria-label="Send message">
            <FiSend className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
