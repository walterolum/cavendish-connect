import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiArrowLeft, FiFileText, FiImage, FiMapPin, FiMic, FiNavigation, FiPaperclip, FiPhone, FiSend, FiTrash2, FiVideo } from 'react-icons/fi';
import { toast } from 'sonner';
import { ChatMessage, ConversationDetail, messagesApi, NewMessage } from '../../services/engagement.service';
import { getErrorMessage, isNotFound } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useDocumentTitle } from '../../lib/hooks';
import { useLiveStore } from '../../lib/realtime';
import { useAuthStore } from '../../store/auth';
import { Avatar, fullName } from '../../components/ui/avatar';
import { Button, ButtonLink } from '../../components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/loading';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { currentPosition, startLiveSharing, useLiveSharing } from '../../components/chat/liveLocation';
import { startCall } from '../../components/calls/CallManager';

type Pending = ChatMessage & { uploadProgress?: number };

function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

const MAX_FILE = 10 * 1024 * 1024;
const MAX_RECORDING = 300; // seconds
const recorderType = () =>
  ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? '';

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const connected = useLiveStore((s) => s.connected);
  const onlineMap = useLiveStore((s) => s.online);
  const typingUntil = useLiveStore((s) => s.typing[Number(id)] ?? 0);
  const sharingIds = useLiveSharing((s) => s.ids);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState<'attach' | 'live' | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [recording, setRecording] = useState<{ started: number; seconds: number } | null>(null);
  const [, tick] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const lastTyping = useRef(0);
  const key = ['messages', 'conversation', id];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => messagesApi.get(id!),
    enabled: !!id,
    // Messages arrive live; fall back to checking every 15s if the live link is down.
    refetchInterval: connected ? false : 15_000,
    refetchOnWindowFocus: true,
  });
  const other = data?.otherUser ?? null;
  const online = other ? onlineMap[other.id] ?? other.online ?? false : false;
  const typing = typingUntil > Date.now();
  useDocumentTitle(other ? `Chat with ${fullName(other)}` : 'Messages');

  // Re-render while "typing…" is showing so it disappears on time.
  useEffect(() => {
    if (!typing) return;
    const t = window.setTimeout(() => tick((n) => n + 1), typingUntil - Date.now() + 50);
    return () => window.clearTimeout(t);
  }, [typing, typingUntil]);

  useEffect(() => {
    if (data) {
      queryClient.invalidateQueries({ queryKey: ['messages', 'unread'] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'conversations'] });
    }
  }, [data?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const messages: Pending[] = [...(data?.messages ?? []), ...pending];

  // Stay pinned to the newest message while content grows (photos loading,
  // new messages), unless the person has scrolled up to read older ones.
  const stick = useRef(true);
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, typing]);
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };
    const ro = new ResizeObserver(() => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    });
    el.addEventListener('scroll', onScroll, { passive: true });
    ro.observe(content);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [isLoading]);

  // ---- sending ----------------------------------------------------------
  const addPending = (partial: Partial<ChatMessage>, uploadProgress?: number) => {
    stick.current = true;
    const temp: Pending = { id: -Date.now() - Math.random(), conversationId: Number(id), senderId: me!.id, content: '', isRead: false, createdAt: new Date().toISOString(), ...partial, uploadProgress };
    setPending((p) => [...p, temp]);
    return temp.id;
  };
  const patchPending = (tempId: number, patch: Partial<Pending>) => setPending((p) => p.map((m) => (m.id === tempId ? { ...m, ...patch } : m)));
  const dropPending = (tempId: number) => setPending((p) => p.filter((m) => m.id !== tempId));

  const deliver = async (tempId: number, msg: NewMessage) => {
    try {
      const saved = await messagesApi.send(id!, msg);
      queryClient.setQueryData<ConversationDetail>(key, (old) => (old && !old.messages.some((m) => m.id === saved.id) ? { ...old, messages: [...old.messages, saved] } : old));
      queryClient.invalidateQueries({ queryKey: ['messages', 'conversations'] });
      return saved;
    } finally {
      dropPending(tempId);
    }
  };

  const sendText = useMutation({
    mutationFn: async (content: string) => {
      const tempId = addPending({ content });
      return deliver(tempId, { content });
    },
    onError: (err, content) => {
      setDraft(content);
      toast.error(getErrorMessage(err, 'Message not sent. Check your connection and try again.'));
    },
  });

  const sendFile = async (file: Blob, name: string, type: 'IMAGE' | 'AUDIO' | 'FILE', extra: Partial<NewMessage> = {}) => {
    if (file.size > MAX_FILE) {
      toast.error('That file is larger than 10 MB');
      return;
    }
    const preview = type === 'IMAGE' ? URL.createObjectURL(file) : null;
    const tempId = addPending({ type, attachmentUrl: preview ?? 'about:blank', attachmentName: name, attachmentSize: file.size, durationSec: extra.durationSec ?? null }, 0);
    try {
      const up = await messagesApi.upload(file, name, (pct) => patchPending(tempId, { uploadProgress: pct }));
      await deliver(tempId, { type, attachmentUrl: up.url, attachmentName: up.name, attachmentMime: up.mime, attachmentSize: up.size, ...extra });
    } catch (err) {
      dropPending(tempId);
      toast.error(getErrorMessage(err, 'Could not send the file'));
    } finally {
      if (preview) URL.revokeObjectURL(preview);
    }
  };

  const onPick = (type: 'IMAGE' | 'FILE') => (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    setMenu(null);
    files.slice(0, 5).forEach((f) => void sendFile(f, f.name, type));
  };

  const shareLocation = async (liveMinutes?: number) => {
    setMenu(null);
    try {
      const pos = await currentPosition();
      const tempId = addPending({ type: 'LOCATION', latitude: pos.coords.latitude, longitude: pos.coords.longitude, liveUntil: liveMinutes ? new Date(Date.now() + liveMinutes * 60000).toISOString() : null });
      const saved = await deliver(tempId, { type: 'LOCATION', latitude: pos.coords.latitude, longitude: pos.coords.longitude, liveMinutes });
      if (liveMinutes && saved?.liveUntil) {
        startLiveSharing(saved.id, new Date(saved.liveUntil));
        toast.success(`Sharing your live location for ${liveMinutes >= 60 ? `${liveMinutes / 60} hour${liveMinutes > 60 ? 's' : ''}` : `${liveMinutes} minutes`}`, { description: 'Keep this tab open. Tap “Stop sharing” any time.' });
      }
    } catch (err) {
      toast.error((err as GeolocationPositionError)?.code === 1 ? 'Allow location access to share where you are' : getErrorMessage(err, 'Could not get your location'));
    }
  };

  // ---- voice notes --------------------------------------------------------
  const startRecording = async () => {
    if (typeof MediaRecorder === 'undefined') {
      toast.error('Voice notes are not supported in this browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mimeType = recorderType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 48_000 } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.start(250);
      recorder.current = rec;
      setRecording({ started: Date.now(), seconds: 0 });
    } catch {
      toast.error('Allow microphone access to record a voice note');
    }
  };

  const stopRecording = (send: boolean) => {
    const rec = recorder.current;
    if (!rec) return;
    const seconds = recording ? Math.round((Date.now() - recording.started) / 1000) : 0;
    rec.onstop = () => {
      rec.stream.getTracks().forEach((t) => t.stop());
      const type = (rec.mimeType || 'audio/webm').split(';')[0];
      const blob = new Blob(chunks.current, { type });
      if (send && seconds >= 1 && blob.size > 0) {
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        void sendFile(blob, `voice-note-${Date.now()}.${ext}`, 'AUDIO', { durationSec: seconds });
      } else if (send) toast.info('Hold on a little longer to record a voice note');
    };
    rec.stop();
    recorder.current = null;
    setRecording(null);
  };

  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => {
      const seconds = Math.round((Date.now() - recording.started) / 1000);
      setRecording((r) => (r ? { ...r, seconds } : r));
      if (seconds >= MAX_RECORDING) stopRecording(true);
    }, 250);
    return () => window.clearInterval(t);
  }, [recording?.started]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop the microphone if the person leaves mid-recording.
  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  // ---- text ---------------------------------------------------------------
  const onDraft = (value: string) => {
    setDraft(value);
    if (value && Date.now() - lastTyping.current > 3000) {
      lastTyping.current = Date.now();
      void messagesApi.typing(id!).catch(() => {});
    }
  };
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    sendText.mutate(content);
    inputRef.current?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const call = (video: boolean) => other && void startCall(Number(id), { ...other, id: other.id }, video);

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

  const menuItem = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100';

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
              <span className="relative shrink-0">
                <Avatar person={other} size="md" />
                {online && <span className="absolute right-0 bottom-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{fullName(other)}</p>
                <p className={cn('truncate text-xs', typing ? 'font-medium text-emerald-600' : 'text-gray-500')}>
                  {typing ? 'typing…' : online ? 'online' : other?.username ? `@${other.username}` : ''}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => call(false)} aria-label="Voice call" title="Voice call">
                <FiPhone className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => call(true)} aria-label="Video call" title="Video call">
                <FiVideo className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
        {sharingIds.length > 0 && (
          <div className="flex items-center justify-center gap-2 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
            <FiNavigation className="h-3.5 w-3.5" /> Sharing your live location. Keep this tab open.
          </div>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div ref={contentRef} className="mx-auto max-w-3xl px-3 py-4 sm:px-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-48 rounded-2xl" />
              <Skeleton className="ml-auto h-10 w-56 rounded-2xl" />
              <Skeleton className="h-10 w-40 rounded-2xl" />
            </div>
          ) : !messages.length ? (
            <div className="py-16 text-center">
              <Avatar person={other} size="lg" className="mx-auto" />
              <p className="mt-3 font-semibold text-gray-900">Start the conversation</p>
              <p className="mt-1 text-sm text-gray-500">Send a message, photo, voice note or your location. Keep payments and meet-ups safe.</p>
            </div>
          ) : (
            messages.map((m, i) => {
              const prev = messages[i - 1];
              const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
              const grouped = !!prev && !newDay && prev.senderId === m.senderId && prev.type !== 'CALL';
              return (
                <div key={m.id}>
                  {newDay && (
                    <div className="my-4 flex justify-center">
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-gray-500 shadow-card">{dayLabel(new Date(m.createdAt))}</span>
                    </div>
                  )}
                  <MessageBubble m={m} mine={m.senderId === me?.id} grouped={grouped} onCallBack={call} />
                </div>
              );
            })
          )}
          {typing && (
            <div className="mt-3 flex">
              <span className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-card" aria-label="typing">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="pb-safe relative border-t border-gray-200 bg-white">
        {menu && (
          <>
            <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Close menu" onClick={() => setMenu(null)} />
            <div className="animate-pop-in absolute bottom-full left-3 z-20 mb-2 w-64 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-raised sm:left-[calc(50%-24rem+1rem)]">
              {menu === 'attach' ? (
                <>
                  <button type="button" className={menuItem} onClick={() => photoInput.current?.click()}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><FiImage className="h-4 w-4" /></span> Photo
                  </button>
                  <button type="button" className={menuItem} onClick={() => pdfInput.current?.click()}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600"><FiFileText className="h-4 w-4" /></span> PDF document
                  </button>
                  <button type="button" className={menuItem} onClick={() => void shareLocation()}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><FiMapPin className="h-4 w-4" /></span> Current location
                  </button>
                  <button type="button" className={menuItem} onClick={() => setMenu('live')}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700"><FiNavigation className="h-4 w-4" /></span> Share live location…
                  </button>
                </>
              ) : (
                <>
                  <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-500">Share live location for</p>
                  {[15, 60, 480].map((mins) => (
                    <button key={mins} type="button" className={menuItem} onClick={() => void shareLocation(mins)}>
                      <FiNavigation className="h-4 w-4 text-sky-600" /> {mins < 60 ? `${mins} minutes` : `${mins / 60} hour${mins > 60 ? 's' : ''}`}
                    </button>
                  ))}
                </>
              )}
            </div>
          </>
        )}
        <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={onPick('IMAGE')} />
        <input ref={pdfInput} type="file" accept="application/pdf" className="hidden" onChange={onPick('FILE')} />

        {recording ? (
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-3 py-3 sm:px-4">
            <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-50" onClick={() => stopRecording(false)} aria-label="Cancel recording">
              <FiTrash2 className="h-5 w-5" />
            </Button>
            <div className="flex flex-1 items-center gap-3 rounded-full bg-red-50 px-4 py-2.5">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <span className="text-sm font-medium text-red-700 tabular-nums">
                Recording {Math.floor(recording.seconds / 60)}:{String(recording.seconds % 60).padStart(2, '0')}
              </span>
              <span className="ml-auto text-xs text-red-600/70">max 5:00</span>
            </div>
            <Button size="icon" className="h-11 w-11 rounded-full" onClick={() => stopRecording(true)} aria-label="Send voice note">
              <FiSend className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mx-auto flex max-w-3xl items-end gap-2 px-3 py-3 sm:px-4">
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full" onClick={() => setMenu(menu ? null : 'attach')} aria-label="Attach" aria-expanded={!!menu} disabled={isLoading}>
              <FiPaperclip className="h-5 w-5" />
            </Button>
            <label htmlFor="message" className="sr-only">
              Message
            </label>
            <textarea
              id="message"
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={5000}
              onChange={(e) => onDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Write a message…"
              className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-[15px] shadow-card [field-sizing:content] placeholder:text-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none"
              disabled={isLoading}
            />
            {draft.trim() ? (
              <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-full" aria-label="Send message">
                <FiSend className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" size="icon" className="h-11 w-11 shrink-0 rounded-full" onClick={() => void startRecording()} aria-label="Record voice note" title="Record a voice note" disabled={isLoading}>
                <FiMic className="h-5 w-5" />
              </Button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
