import { Response } from 'express';
import prisma from '../config/database';

/**
 * Live updates over Server-Sent Events: one long-lived HTTP response per open
 * browser tab, which the server writes events into. Works on any host that
 * supports normal HTTP (including free plans), with no extra dependencies.
 *
 * Note: this keeps connections in memory, so it assumes a single server
 * instance (true for Render's free plan). Several instances would need a
 * shared channel such as Redis pub/sub.
 */

const clients = new Map<number, Set<Response>>();

export type RealtimeEvent =
  | 'message'
  | 'message:update'
  | 'typing'
  | 'read'
  | 'presence'
  | 'call'
  | 'notification';

function write(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function isOnline(userId: number) {
  return (clients.get(userId)?.size ?? 0) > 0;
}

export function publish(userIds: number | number[], event: RealtimeEvent, data: unknown) {
  for (const id of Array.isArray(userIds) ? userIds : [userIds]) {
    for (const res of clients.get(id) ?? []) write(res, event, data);
  }
}

/** Everyone who shares a conversation with this user. */
async function contactsOf(userId: number): Promise<number[]> {
  const rows = await prisma.conversationParticipant.findMany({
    where: { conversation: { participants: { some: { userId } } }, userId: { not: userId } },
    select: { userId: true },
    distinct: ['userId'],
  });
  return rows.map((r) => r.userId);
}

async function announcePresence(userId: number, online: boolean) {
  try {
    publish(await contactsOf(userId), 'presence', { userId, online, at: new Date().toISOString() });
  } catch {
    /* presence is best-effort */
  }
}

export function connect(userId: number, res: Response) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // tell proxies not to buffer the stream
  res.flushHeaders?.();
  res.write('retry: 3000\n\n');

  const wasOnline = isOnline(userId);
  const set = clients.get(userId) ?? new Set<Response>();
  set.add(res);
  clients.set(userId, set);
  write(res, 'presence', { userId, online: true, self: true });
  if (!wasOnline) void announcePresence(userId, true);

  // Comment lines keep the connection open through hosting proxies.
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);

  res.on('close', () => {
    clearInterval(ping);
    set.delete(res);
    if (set.size === 0) {
      clients.delete(userId);
      void announcePresence(userId, false);
    }
  });
}
