import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { api } from './api';
import { useAuthStore } from '../store/auth';

/**
 * One live connection per tab (Server-Sent Events) for new messages, typing,
 * read receipts, online status and call signals. Reconnects by itself, and
 * refreshes the sign-in token first when the old one has expired.
 */

export type RealtimeEventName = 'message' | 'message:update' | 'typing' | 'read' | 'presence' | 'call';
const EVENTS: RealtimeEventName[] = ['message', 'message:update', 'typing', 'read', 'presence', 'call'];
const BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api/v1';

type Handler = (data: any) => void;
const handlers = new Map<RealtimeEventName, Set<Handler>>();

let source: EventSource | null = null;
let currentToken: string | null = null;
let retry: number | undefined;
let attempts = 0;

/** Who is online and who is typing, kept up to date by the live connection. */
export const useLiveStore = create<{
  online: Record<number, boolean>;
  typing: Record<number, number>; // conversationId -> show "typing…" until this time
  connected: boolean;
  setOnline: (userId: number, online: boolean) => void;
  setTyping: (conversationId: number) => void;
  setConnected: (c: boolean) => void;
}>((set) => ({
  online: {},
  typing: {},
  connected: false,
  setOnline: (userId, online) => set((s) => ({ online: { ...s.online, [userId]: online } })),
  setTyping: (conversationId) => set((s) => ({ typing: { ...s.typing, [conversationId]: Date.now() + 4000 } })),
  setConnected: (connected) => set({ connected }),
}));

function dispatch(name: RealtimeEventName, raw: string) {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return;
  }
  handlers.get(name)?.forEach((h) => h(data));
}

function close() {
  source?.close();
  source = null;
  window.clearTimeout(retry);
  useLiveStore.getState().setConnected(false);
}

function open(token: string) {
  close();
  currentToken = token;
  const es = new EventSource(`${BASE}/realtime?token=${encodeURIComponent(token)}`);
  source = es;
  for (const name of EVENTS) es.addEventListener(name, (e) => dispatch(name, (e as MessageEvent).data));
  es.onopen = () => {
    attempts = 0;
    useLiveStore.getState().setConnected(true);
  };
  es.onerror = () => {
    useLiveStore.getState().setConnected(false);
    // The browser retries by itself unless the server refused us (e.g. expired token).
    if (es.readyState === EventSource.CLOSED) scheduleReconnect();
  };
}

function scheduleReconnect() {
  window.clearTimeout(retry);
  const delay = Math.min(30_000, 1000 * 2 ** attempts++);
  retry = window.setTimeout(async () => {
    if (!useAuthStore.getState().isAuthenticated) return;
    try {
      // Any authenticated call refreshes an expired token through the API client.
      await api.get('/messages/unread-count');
    } catch {
      /* offline: try again later */
    }
    const token = useAuthStore.getState().accessToken;
    if (token) open(token);
    else scheduleReconnect();
  }, delay);
}

/** Starts and stops the live connection with the signed-in session. */
export function startRealtime() {
  const sync = () => {
    const { isAuthenticated, accessToken } = useAuthStore.getState();
    if (!isAuthenticated || !accessToken) close();
    else if (!source || accessToken !== currentToken) open(accessToken);
  };
  sync();
  const unsubscribe = useAuthStore.subscribe(sync);
  // Coming back online or to the tab: reconnect straight away.
  const wake = () => {
    if (useAuthStore.getState().isAuthenticated && (!source || source.readyState === EventSource.CLOSED)) {
      attempts = 0;
      scheduleReconnect();
    }
  };
  window.addEventListener('online', wake);
  document.addEventListener('visibilitychange', wake);
  return () => {
    unsubscribe();
    window.removeEventListener('online', wake);
    document.removeEventListener('visibilitychange', wake);
    close();
  };
}

/** Subscribe a component to one kind of live event. */
export function useRealtime(name: RealtimeEventName, handler: Handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn: Handler = (d) => ref.current(d);
    const set = handlers.get(name) ?? new Set<Handler>();
    set.add(fn);
    handlers.set(name, set);
    return () => {
      set.delete(fn);
    };
  }, [name]);
}

/** A short two-tone chime for new messages (no audio file needed). */
export function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.22);
    });
    window.setTimeout(() => ctx.close(), 600);
  } catch {
    /* audio not allowed yet (no user interaction); stay silent */
  }
}
