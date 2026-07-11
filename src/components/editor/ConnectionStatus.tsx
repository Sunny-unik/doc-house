"use client";

import type { SyncStatus } from "./useDocProvider";

const config: Record<SyncStatus, { label: string; dot: string }> = {
  synced: { label: "Synced", dot: "bg-emerald-500" },
  syncing: { label: "Syncing…", dot: "bg-amber-500" },
  offline: { label: "Offline — saved locally", dot: "bg-zinc-400" },
  error: { label: "Sync failed — will retry", dot: "bg-red-500" },
};

export function ConnectionStatus({ status }: { status: SyncStatus }) {
  const { label, dot } = config[status];
  return (
    <span className="flex items-center gap-1.5 text-xs text-zinc-500" aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
