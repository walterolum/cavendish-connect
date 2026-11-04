import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { toast } from 'sonner';
import { FiMic, FiMicOff, FiMonitor, FiPhone, FiPhoneOff, FiVideo, FiVideoOff } from 'react-icons/fi';
import { messagesApi } from '../../services/engagement.service';
import { useRealtime } from '../../lib/realtime';
import { useAuthStore } from '../../store/auth';
import { cn } from '../../lib/utils';
import { Avatar, AvatarPerson, fullName } from '../ui/avatar';

/**
 * One-to-one voice and video calls between browsers (WebRTC).
 * Signals travel over the live connection: ring -> accept -> offer/answer ->
 * network candidates -> connected. Only the caller writes the call log line.
 */

type Peer = AvatarPerson & { id: number };
type Status = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active';

interface CallState {
  status: Status;
  callId: string | null;
  conversationId: number | null;
  peer: Peer | null;
  video: boolean;
  caller: boolean;
  startedAt: number | null;
  muted: boolean;
  cameraOff: boolean;
  sharing: boolean;
  peerMuted: boolean;
  local: MediaStream | null;
  remote: MediaStream | null;
}

const initial: CallState = {
  status: 'idle', callId: null, conversationId: null, peer: null, video: false, caller: false, startedAt: null,
  muted: false, cameraOff: false, sharing: false, peerMuted: false, local: null, remote: null,
};

export const useCallStore = create<CallState & { patch: (p: Partial<CallState>) => void; reset: () => void }>((set) => ({
  ...initial,
  patch: (p) => set(p),
  reset: () => set(initial),
}));

// WebRTC objects live outside React state.
let pc: RTCPeerConnection | null = null;
let pendingIce: RTCIceCandidateInit[] = [];
let ringTimer: number | undefined;
let ringtone: { stop: () => void } | null = null;
let screenTrack: MediaStreamTrack | null = null;

const signal = (kind: string, extra: Record<string, unknown> = {}) => {
  const { conversationId, callId } = useCallStore.getState();
  if (!conversationId || !callId) return Promise.resolve({ delivered: false });
  return messagesApi.signal(conversationId, { kind, callId, ...extra }).catch(() => ({ delivered: false }));
};

function playRingtone(outgoing: boolean) {
  try {
    const ctx = new AudioContext();
    let stopped = false;
    const beep = () => {
      if (stopped) return;
      const t = ctx.currentTime;
      [0, 0.45].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = outgoing ? 440 : 660;
        gain.gain.setValueAtTime(0.0001, t + offset);
        gain.gain.exponentialRampToValueAtTime(outgoing ? 0.04 : 0.1, t + offset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.4);
      });
      window.setTimeout(beep, outgoing ? 3000 : 2000);
    };
    beep();
    return { stop: () => { stopped = true; window.setTimeout(() => ctx.close(), 500); } };
  } catch {
    return { stop: () => {} };
  }
}

async function getMedia(video: boolean) {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false });
}

async function createPeer() {
  let iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  try {
    iceServers = await messagesApi.iceServers();
  } catch {
    /* fall back to a public STUN server */
  }
  const conn = new RTCPeerConnection({ iceServers });
  const { local } = useCallStore.getState();
  local?.getTracks().forEach((t) => conn.addTrack(t, local));
  const remote = new MediaStream();
  useCallStore.getState().patch({ remote });
  conn.ontrack = (e) => {
    e.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
    if (!e.streams[0]) remote.addTrack(e.track);
    useCallStore.getState().patch({ remote: new MediaStream(remote.getTracks()) });
  };
  conn.onicecandidate = (e) => {
    if (e.candidate) void signal('ice', { candidate: e.candidate.toJSON() });
  };
  conn.onconnectionstatechange = () => {
    if (conn.connectionState === 'connected') {
      useCallStore.getState().patch({ status: 'active', startedAt: useCallStore.getState().startedAt ?? Date.now() });
    }
    if (conn.connectionState === 'failed') {
      toast.error("Couldn't connect the call", { description: 'One of your networks is blocking direct calls. Try Wi-Fi, or ask the admin to set up a TURN server.' });
      void endCall('failed');
    }
  };
  pc = conn;
  return conn;
}

async function flushIce() {
  if (!pc?.remoteDescription) return;
  for (const c of pendingIce) await pc.addIceCandidate(c).catch(() => {});
  pendingIce = [];
}

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Hang up / clean up; the caller adds a line to the chat describing the call. */
export async function endCall(reason: 'hangup' | 'declined' | 'missed' | 'busy' | 'failed' | 'remote' = 'hangup', notify = true) {
  const s = useCallStore.getState();
  if (s.status === 'idle') return;
  window.clearTimeout(ringTimer);
  ringtone?.stop();
  ringtone = null;
  if (notify && reason !== 'remote') void signal(reason === 'declined' ? 'decline' : 'end');
  pc?.close();
  pc = null;
  pendingIce = [];
  screenTrack?.stop();
  screenTrack = null;
  s.local?.getTracks().forEach((t) => t.stop());

  if (s.caller && s.conversationId) {
    const kind = s.video ? 'video call' : 'voice call';
    const secs = s.startedAt ? Math.round((Date.now() - s.startedAt) / 1000) : 0;
    const content = secs > 0 ? `${kind[0].toUpperCase()}${kind.slice(1)} · ${fmt(secs)}` : reason === 'declined' ? `Declined ${kind}` : reason === 'busy' ? `Missed ${kind} (busy)` : `Missed ${kind}`;
    void messagesApi.send(s.conversationId, { type: 'CALL', content, durationSec: secs || undefined }).catch(() => {});
  }
  s.reset();
}

/** Start a call from a conversation. */
export async function startCall(conversationId: number, peer: Peer, video: boolean) {
  if (useCallStore.getState().status !== 'idle') {
    toast.info('You are already in a call');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
    toast.error('Calls need a modern browser (Chrome, Edge, Firefox or Safari) over HTTPS');
    return;
  }
  let local: MediaStream;
  try {
    local = await getMedia(video);
  } catch {
    toast.error(video ? 'Allow camera and microphone access to start a video call' : 'Allow microphone access to start a call');
    return;
  }
  const callId = crypto.randomUUID();
  useCallStore.getState().patch({ ...initial, status: 'outgoing', callId, conversationId, peer, video, caller: true, local, cameraOff: false });
  ringtone = playRingtone(true);
  const { delivered } = await signal('ring', { video });
  if (!delivered) {
    toast.info(`${fullName(peer)} is offline`, { description: 'They will see a missed call in the chat.' });
    void endCall('missed', false);
    return;
  }
  ringTimer = window.setTimeout(() => {
    if (useCallStore.getState().status === 'outgoing') void endCall('missed');
  }, 40_000);
}

async function acceptCall() {
  const s = useCallStore.getState();
  ringtone?.stop();
  ringtone = null;
  let local: MediaStream;
  try {
    local = await getMedia(s.video);
  } catch {
    toast.error('Allow microphone (and camera) access to answer');
    void endCall('declined');
    return;
  }
  s.patch({ status: 'connecting', local });
  await createPeer();
  void signal('accept');
}

function toggleMute() {
  const s = useCallStore.getState();
  s.local?.getAudioTracks().forEach((t) => (t.enabled = s.muted));
  s.patch({ muted: !s.muted });
  void signal('media', { state: { muted: !s.muted } });
}

function toggleCamera() {
  const s = useCallStore.getState();
  s.local?.getVideoTracks().forEach((t) => (t.enabled = s.cameraOff));
  s.patch({ cameraOff: !s.cameraOff });
}

async function toggleScreen() {
  const s = useCallStore.getState();
  const sender = pc?.getSenders().find((x) => x.track?.kind === 'video');
  if (!sender) return;
  if (s.sharing && screenTrack) {
    screenTrack.stop();
    screenTrack = null;
    await sender.replaceTrack(s.local?.getVideoTracks()[0] ?? null);
    s.patch({ sharing: false });
    return;
  }
  try {
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
    screenTrack = display.getVideoTracks()[0];
    await sender.replaceTrack(screenTrack);
    screenTrack.onended = () => void toggleScreen();
    s.patch({ sharing: true });
  } catch {
    /* user cancelled the screen picker */
  }
}

function Video({ stream, muted, className, mirror }: { stream: MediaStream | null; muted?: boolean; className?: string; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={cn('bg-black object-cover', mirror && '-scale-x-100', className)} />;
}

function Timer({ since }: { since: number | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <>{since ? fmt(Math.round((Date.now() - since) / 1000)) : ''}</>;
}

const ctrl = 'flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95';

/** Listens for calls and shows the incoming-call and in-call screens. Mount once. */
export function CallManager() {
  const s = useCallStore();
  const me = useAuthStore((st) => st.user);

  useRealtime('call', async (d: { kind: string; callId: string; conversationId: number; from: Peer; video?: boolean; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; state?: { muted?: boolean } }) => {
    const st = useCallStore.getState();
    if (d.from?.id === me?.id) return;

    if (d.kind === 'ring') {
      if (st.status !== 'idle') {
        void messagesApi.signal(d.conversationId, { kind: 'busy', callId: d.callId }).catch(() => {});
        return;
      }
      st.patch({ ...initial, status: 'incoming', callId: d.callId, conversationId: d.conversationId, peer: d.from, video: !!d.video, caller: false });
      ringtone = playRingtone(false);
      ringTimer = window.setTimeout(() => {
        if (useCallStore.getState().status === 'incoming') void endCall('missed', false);
      }, 40_000);
      return;
    }
    if (d.callId !== st.callId) return;

    switch (d.kind) {
      case 'accept': {
        window.clearTimeout(ringTimer);
        ringtone?.stop();
        ringtone = null;
        st.patch({ status: 'connecting' });
        const conn = await createPeer();
        const offer = await conn.createOffer();
        await conn.setLocalDescription(offer);
        void signal('offer', { sdp: offer });
        break;
      }
      case 'offer': {
        if (!pc) await createPeer();
        await pc!.setRemoteDescription(d.sdp!);
        await flushIce();
        const answer = await pc!.createAnswer();
        await pc!.setLocalDescription(answer);
        void signal('answer', { sdp: answer });
        break;
      }
      case 'answer':
        await pc?.setRemoteDescription(d.sdp!);
        await flushIce();
        break;
      case 'ice':
        if (d.candidate) {
          if (pc?.remoteDescription) await pc.addIceCandidate(d.candidate).catch(() => {});
          else pendingIce.push(d.candidate);
        }
        break;
      case 'media':
        st.patch({ peerMuted: !!d.state?.muted });
        break;
      case 'decline':
        toast.info(`${fullName(st.peer)} declined the call`);
        void endCall('declined', false);
        break;
      case 'busy':
        toast.info(`${fullName(st.peer)} is on another call`);
        void endCall('busy', false);
        break;
      case 'end':
        if (st.status !== 'idle') toast.info('Call ended');
        void endCall('remote', false);
        break;
    }
  });

  // Leaving the page ends the call cleanly.
  useEffect(() => {
    const bye = () => void endCall('hangup');
    window.addEventListener('pagehide', bye);
    return () => window.removeEventListener('pagehide', bye);
  }, []);

  if (s.status === 'idle') return null;

  if (s.status === 'incoming') {
    return (
      <div className="fixed inset-x-0 top-4 z-[300] flex justify-center px-4" role="alertdialog" aria-label="Incoming call">
        <div className="animate-pop-in flex w-full max-w-sm items-center gap-3 rounded-3xl bg-brand-950 p-4 text-white shadow-overlay ring-1 ring-white/10">
          <span className="relative">
            <Avatar person={s.peer} size="md" />
            <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-emerald-400" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{fullName(s.peer)}</p>
            <p className="text-sm text-white/70">Incoming {s.video ? 'video' : 'voice'} call…</p>
          </div>
          <button type="button" onClick={() => void endCall('declined')} className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 hover:bg-red-600" aria-label="Decline">
            <FiPhoneOff className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => void acceptCall()} className="flex h-12 w-12 animate-[wiggle_1.2s_ease-in-out_infinite] items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600" aria-label="Accept">
            {s.video ? <FiVideo className="h-5 w-5" /> : <FiPhone className="h-5 w-5" />}
          </button>
        </div>
      </div>
    );
  }

  const remoteVideo = s.video && (s.remote?.getVideoTracks().length ?? 0) > 0 && s.status === 'active';
  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-brand-950 text-white" role="dialog" aria-label="Call">
      <div className="relative min-h-0 flex-1">
        {remoteVideo ? (
          <Video stream={s.remote} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <Avatar person={s.peer} size="xl" className="ring-4 ring-white/10" />
            <audio autoPlay ref={(el) => { if (el && s.remote && el.srcObject !== s.remote) el.srcObject = s.remote; }} />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-5 text-center">
          <p className="text-lg font-semibold">{fullName(s.peer)}</p>
          <p className="text-sm text-white/75">
            {s.status === 'outgoing' ? 'Ringing…' : s.status === 'connecting' ? 'Connecting…' : <Timer since={s.startedAt} />}
            {s.peerMuted && s.status === 'active' && ' · muted'}
            {s.sharing && ' · sharing your screen'}
          </p>
        </div>
        {s.video && s.local && (
          <Video stream={s.local} muted mirror={!s.sharing} className={cn('absolute right-4 bottom-4 h-40 w-28 rounded-2xl shadow-overlay ring-2 ring-white/20 sm:h-48 sm:w-36', s.cameraOff && 'opacity-30')} />
        )}
      </div>
      <div className="pb-safe flex items-center justify-center gap-4 bg-black/30 px-4 py-5">
        <button type="button" onClick={toggleMute} className={cn(ctrl, s.muted ? 'bg-white text-brand-950' : 'bg-white/15 hover:bg-white/25')} aria-label={s.muted ? 'Unmute' : 'Mute'} aria-pressed={s.muted}>
          {s.muted ? <FiMicOff className="h-6 w-6" /> : <FiMic className="h-6 w-6" />}
        </button>
        {s.video && (
          <button type="button" onClick={toggleCamera} className={cn(ctrl, s.cameraOff ? 'bg-white text-brand-950' : 'bg-white/15 hover:bg-white/25')} aria-label={s.cameraOff ? 'Turn camera on' : 'Turn camera off'} aria-pressed={s.cameraOff}>
            {s.cameraOff ? <FiVideoOff className="h-6 w-6" /> : <FiVideo className="h-6 w-6" />}
          </button>
        )}
        {s.video && s.status === 'active' && typeof navigator.mediaDevices?.getDisplayMedia === 'function' && (
          <button type="button" onClick={() => void toggleScreen()} className={cn(ctrl, 'hidden sm:flex', s.sharing ? 'bg-white text-brand-950' : 'bg-white/15 hover:bg-white/25')} aria-label={s.sharing ? 'Stop sharing screen' : 'Share screen'} aria-pressed={s.sharing}>
            <FiMonitor className="h-6 w-6" />
          </button>
        )}
        <button type="button" onClick={() => void endCall('hangup')} className={cn(ctrl, 'bg-red-500 hover:bg-red-600')} aria-label="Hang up">
          <FiPhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
