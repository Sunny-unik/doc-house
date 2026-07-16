import type { PresenceUser } from "@/lib/sync/protocol";

// Who's currently in a document, tracked in memory.
//
// Same honest trade-off as the rate limiter: this is per-process, so on a
// multi-instance deployment each instance only knows the collaborators whose
// polls landed on it. For a single-region deployment that's everyone active;
// horizontal scale would move this into shared storage (Upstash is already in
// .env.example) and the call sites wouldn't change.
//
// There's no "leave" event — a browser tab can vanish without one. Instead
// presence is a heartbeat: a collaborator counts as here only while their polls
// keep arriving, and ages out on its own once they stop.

type Entry = PresenceUser & { lastSeen: number };

// The client polls about every 2.5s, so this window forgives one dropped beat
// before it stops showing someone as present.
const ACTIVE_MS = 8_000;

// Stable per-user colours for the avatar dots. Mid-tone so white initials read
// on top and the dot itself stays visible on both light and dark surfaces.
const COLORS = [
  "#ef4444",
  "#f97316",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#0ea5e9",
];

function colorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

const rooms = new Map<string, Map<string, Entry>>();

// Record that a user is active in a document, right now.
export function markPresent(
  documentId: string,
  user: { userId: string; name: string; isGuest: boolean },
  now = Date.now(),
) {
  let room = rooms.get(documentId);
  if (!room) {
    room = new Map();
    rooms.set(documentId, room);
  }
  room.set(user.userId, {
    userId: user.userId,
    name: user.name,
    isGuest: user.isGuest,
    color: colorFor(user.userId),
    lastSeen: now,
  });
}

// Everyone currently present, pruning anyone who's gone quiet as we go.
export function listPresent(documentId: string, now = Date.now()): PresenceUser[] {
  const room = rooms.get(documentId);
  if (!room) return [];

  const active: PresenceUser[] = [];
  for (const [id, entry] of room) {
    if (now - entry.lastSeen > ACTIVE_MS) {
      room.delete(id);
      continue;
    }
    active.push({
      userId: entry.userId,
      name: entry.name,
      isGuest: entry.isGuest,
      color: entry.color,
    });
  }
  if (room.size === 0) rooms.delete(documentId);

  return active.sort((a, b) => a.name.localeCompare(b.name));
}
