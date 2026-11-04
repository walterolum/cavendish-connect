import { create } from 'zustand';
import { messagesApi } from '../../services/engagement.service';

/**
 * Live location sharing: after a LOCATION message with a "live until" time is
 * sent, the browser keeps sending its position while the tab is open, until
 * the time runs out or the person taps Stop.
 */

interface Sharing {
  watchId: number;
  timer: number;
  last: number;
  lat?: number;
  lng?: number;
}

const active = new Map<number, Sharing>();

export const useLiveSharing = create<{ ids: number[]; sync: () => void }>((set) => ({
  ids: [],
  sync: () => set({ ids: [...active.keys()] }),
}));

/** Distance in metres between two coordinates. */
function metres(a: [number, number], b: [number, number]) {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function startLiveSharing(messageId: number, until: Date) {
  if (active.has(messageId) || !navigator.geolocation) return;
  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const s = active.get(messageId);
      if (!s) return;
      const { latitude, longitude } = pos.coords;
      const moved = s.lat == null || metres([s.lat, s.lng!], [latitude, longitude]) > 10;
      if (!moved || Date.now() - s.last < 8000) return;
      s.last = Date.now();
      s.lat = latitude;
      s.lng = longitude;
      void messagesApi.moveLiveLocation(messageId, latitude, longitude).catch(() => stopLiveSharing(messageId, false));
    },
    () => {
      /* permission revoked or no signal: keep the last known pin */
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
  );
  const timer = window.setTimeout(() => stopLiveSharing(messageId, false), Math.max(0, until.getTime() - Date.now()));
  active.set(messageId, { watchId, timer, last: Date.now() });
  useLiveSharing.getState().sync();
}

export function stopLiveSharing(messageId: number, tellServer = true) {
  const s = active.get(messageId);
  if (s) {
    navigator.geolocation.clearWatch(s.watchId);
    window.clearTimeout(s.timer);
    active.delete(messageId);
    useLiveSharing.getState().sync();
  }
  if (tellServer) void messagesApi.stopLiveLocation(messageId).catch(() => {});
}

/** Current position, as a promise. */
export function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error('Location is not available on this device'));
    else navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
  });
}
