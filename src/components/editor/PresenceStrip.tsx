"use client";

import type { PresenceUser } from "@/lib/sync/protocol";

// Two initials for the avatar dot, falling back to a dash when a name is blank.
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "–";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// How many avatars to show before collapsing the rest into a "+N".
const MAX_SHOWN = 5;

// Who else is in the document right now. Fed by the background poll, so it's
// close-to-live rather than instant — someone appears or drops within a poll or
// two, which is the honest promise of a polling design.
export function PresenceStrip({ users, selfId }: { users: PresenceUser[]; selfId: string }) {
  if (users.length === 0) return null;

  const shown = users.slice(0, MAX_SHOWN);
  const overflow = users.length - shown.length;
  const others = users.filter((u) => u.userId !== selfId).length;

  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <div className="flex -space-x-1.5">
        {shown.map((user) => {
          const isSelf = user.userId === selfId;
          return (
            <span
              key={user.userId}
              title={isSelf ? `${user.name} (you)` : user.name}
              className="grid h-6 w-6 place-items-center rounded-full border-2 border-surface text-[10px] font-semibold text-white ring-1 ring-black/5"
              style={{ backgroundColor: user.color }}
            >
              {initials(user.name)}
            </span>
          );
        })}
        {overflow > 0 ? (
          <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-surface bg-surface-muted text-[10px] font-semibold text-text-muted">
            +{overflow}
          </span>
        ) : null}
      </div>
      <span className="text-xs text-text-subtle">
        {others === 0 ? "Only you" : others === 1 ? "1 other here" : `${others} others here`}
      </span>
    </div>
  );
}
