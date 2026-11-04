import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiExternalLink, FiFileText, FiMapPin, FiPause, FiPhone, FiPhoneMissed, FiPlay, FiVideo, FiX } from 'react-icons/fi';
import { ChatMessage } from '../../services/engagement.service';
import { cn } from '../../lib/utils';
import { stopLiveSharing, useLiveSharing } from './liveLocation';

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const dur = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const size = (b?: number | null) => (!b ? '' : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Sent / read ticks on your own messages. */
function Ticks({ read, pending }: { read: boolean; pending: boolean }) {
  if (pending) return <span className="ml-1 inline-block h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent align-middle" aria-label="Sending" />;
  return (
    <span className={cn('ml-1 inline-flex align-middle', read ? 'text-sky-300' : 'opacity-70')} aria-label={read ? 'Read' : 'Sent'}>
      <FiCheck className="h-3.5 w-3.5" />
      {read && <FiCheck className="-ml-2 h-3.5 w-3.5" />}
    </span>
  );
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="animate-fade-in fixed inset-0 z-[250] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-label="Photo" onClick={onClose}>
      <img src={src} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
      <button type="button" className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close">
        <FiX className="h-6 w-6" />
      </button>
      <a href={src} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-6 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">
        Open original
      </a>
    </div>,
    document.body
  );
}

/** Voice note player with a simple progress bar you can tap to seek. */
export function VoiceNote({ src, seconds, mine }: { src: string; seconds?: number | null; mine: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [total, setTotal] = useState(seconds ?? 0);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      document.querySelectorAll('audio').forEach((x) => x !== a && x.pause());
      void a.play();
    } else a.pause();
  };

  return (
    <div className="flex w-56 items-center gap-3 sm:w-64">
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPos(0);
        }}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setTotal(e.currentTarget.duration)}
      />
      <button
        type="button"
        onClick={toggle}
        className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95', mine ? 'bg-white text-brand-700' : 'bg-brand-600 text-white')}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
      >
        {playing ? <FiPause className="h-4 w-4" /> : <FiPlay className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={cn('relative h-6 cursor-pointer', mine ? 'text-white' : 'text-brand-600')}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            if (audio.current && total) audio.current.currentTime = ((e.clientX - r.left) / r.width) * total;
          }}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(pos)}
        >
          {/* waveform-style bars */}
          <div className="absolute inset-0 flex items-center gap-[2px]">
            {Array.from({ length: 28 }).map((_, i) => {
              const filled = total ? i / 28 < pos / total : false;
              return <span key={i} className={cn('w-[3px] rounded-full bg-current transition-opacity', filled ? 'opacity-100' : 'opacity-35')} style={{ height: `${30 + ((i * 37) % 70)}%` }} />;
            })}
          </div>
        </div>
        <p className={cn('text-[11px] tabular-nums', mine ? 'text-white/75' : 'text-gray-500')}>{dur(playing || pos ? pos : total)}</p>
      </div>
    </div>
  );
}

function LocationBubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  const sharing = useLiveSharing((s) => s.ids.includes(m.id));
  const [, tick] = useState(0);
  const live = !!m.liveUntil && new Date(m.liveUntil) > new Date();
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [live]);
  const q = `${m.latitude},${m.longitude}`;
  return (
    <div className="w-60 sm:w-72">
      <div className="relative h-36 overflow-hidden rounded-xl bg-gray-200">
        <iframe title="Shared location" src={`https://maps.google.com/maps?q=${q}&z=16&output=embed`} className="pointer-events-none h-full w-full border-0" loading="lazy" />
        {live && (
          <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white shadow">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" /> LIVE
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className={cn('flex items-center gap-1 text-xs', mine ? 'text-white/85' : 'text-gray-600')}>
          <FiMapPin className="h-3.5 w-3.5" />
          {live ? `Live until ${time(m.liveUntil!)}` : m.liveUntil ? 'Live location ended' : 'Location'}
        </p>
        <a href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noreferrer noopener" className={cn('flex items-center gap-1 text-xs font-semibold', mine ? 'text-white' : 'text-brand-700')}>
          Open <FiExternalLink className="h-3 w-3" />
        </a>
      </div>
      {mine && live && (
        <button type="button" onClick={() => stopLiveSharing(m.id)} className="mt-2 w-full rounded-lg bg-white/15 py-1.5 text-xs font-semibold text-white hover:bg-white/25">
          {sharing ? 'Stop sharing' : 'End live location'}
        </button>
      )}
    </div>
  );
}

export function MessageBubble({
  m,
  mine,
  grouped,
  onCallBack,
}: {
  m: ChatMessage & { uploadProgress?: number };
  mine: boolean;
  grouped: boolean;
  onCallBack?: (video: boolean) => void;
}) {
  const [zoom, setZoom] = useState(false);
  const pending = m.id < 0;
  const type = m.type ?? 'TEXT';

  if (type === 'CALL') {
    const missed = /missed|declined/i.test(m.content);
    const video = /video/i.test(m.content);
    return (
      <div className="my-3 flex justify-center">
        <button
          type="button"
          onClick={() => onCallBack?.(video)}
          className={cn('flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium shadow-card', missed && !mine ? 'bg-red-50 text-red-700' : 'bg-white text-gray-600')}
          title="Call back"
        >
          {missed ? <FiPhoneMissed className="h-3.5 w-3.5" /> : video ? <FiVideo className="h-3.5 w-3.5" /> : <FiPhone className="h-3.5 w-3.5" />}
          {m.content} · {time(m.createdAt)}
        </button>
      </div>
    );
  }

  const media = type === 'IMAGE' || type === 'LOCATION';
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start', grouped ? 'mt-1' : 'mt-3')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl text-[15px] leading-snug shadow-card sm:max-w-[70%]',
          media ? 'p-1.5' : 'px-3.5 py-2',
          mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-white text-gray-900',
          pending && 'opacity-80'
        )}
      >
        {type === 'IMAGE' && m.attachmentUrl && (
          <>
            <button type="button" onClick={() => !pending && setZoom(true)} className="block overflow-hidden rounded-xl" aria-label="View photo">
              <img src={m.attachmentUrl} alt={m.content || 'Photo'} loading="lazy" className="max-h-72 w-full min-w-40 object-cover" />
            </button>
            {zoom && <Lightbox src={m.attachmentUrl} onClose={() => setZoom(false)} />}
          </>
        )}
        {type === 'AUDIO' && m.attachmentUrl && <VoiceNote src={m.attachmentUrl} seconds={m.durationSec} mine={mine} />}
        {type === 'FILE' && m.attachmentUrl && (
          <a href={m.attachmentUrl} target="_blank" rel="noreferrer noopener" className={cn('flex w-60 items-center gap-3 rounded-xl p-2 sm:w-72', mine ? 'bg-white/10 hover:bg-white/15' : 'bg-gray-50 hover:bg-gray-100')}>
            <span className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500 text-[10px] font-bold text-white">PDF</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{m.attachmentName ?? 'Document'}</span>
              <span className={cn('flex items-center gap-1 text-xs', mine ? 'text-white/75' : 'text-gray-500')}>
                <FiFileText className="h-3 w-3" /> {size(m.attachmentSize)} · Open
              </span>
            </span>
          </a>
        )}
        {type === 'LOCATION' && m.latitude != null && <LocationBubble m={m} mine={mine} />}
        {m.content && <p className={cn('break-words whitespace-pre-wrap', media && 'px-2 pt-1.5')}>{m.content}</p>}
        {pending && m.uploadProgress !== undefined && m.uploadProgress < 100 && (
          <div className="mx-2 mt-1.5 h-1 overflow-hidden rounded-full bg-white/30">
            <div className="h-full bg-white transition-all" style={{ width: `${m.uploadProgress}%` }} />
          </div>
        )}
        <p className={cn('mt-0.5 text-right text-[10px]', media && 'px-2 pb-0.5', mine ? 'text-brand-100' : 'text-gray-400')}>
          {pending ? (m.uploadProgress !== undefined ? `Uploading ${m.uploadProgress}%` : 'Sending') : time(m.createdAt)}
          {mine && <Ticks read={m.isRead} pending={pending} />}
        </p>
      </div>
    </div>
  );
}
