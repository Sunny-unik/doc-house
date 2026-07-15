"use client";

import { Dot } from "@/components/ui/Badge";
import type { SyncStatus } from "./useDocProvider";

const config: Record<SyncStatus, { label: string; dot: string; text: string }> = {
  synced: { label: "Synced", dot: "bg-success", text: "text-text-muted" },
  syncing: { label: "Syncing…", dot: "bg-warning", text: "text-text-muted" },
  offline: { label: "Offline — saved locally", dot: "bg-text-subtle", text: "text-text-muted" },
  error: { label: "Sync failed — will retry", dot: "bg-danger", text: "text-danger" },
};

export function ConnectionStatus({ status }: { status: SyncStatus }) {
  const { label, dot, text } = config[status];
  return (
    // aria-live so a change in sync state is announced, not just recoloured.
    <span className={`flex items-center gap-1.5 text-xs ${text}`} aria-live="polite">
      <Dot className={dot} />
      {label}
    </span>
  );
}
