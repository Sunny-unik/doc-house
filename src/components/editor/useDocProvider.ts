"use client";

import { useEffect, useRef, useState } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { localDocKey } from "@/lib/collab";
import { clearSyncState, getSyncState, putSyncState } from "@/lib/offline/sync-state";
import { base64ToBytes, bytesToBase64 } from "@/lib/sync/codec";
import type { PresenceUser } from "@/lib/sync/protocol";

export type SyncStatus = "synced" | "syncing" | "offline" | "error";

// The server's state for this document as of our last successful sync, plus
// when that was. Everything in the live Y.Doc beyond `baseline` is pending.
export type SyncedBaseline = { baseline: Uint8Array; syncedAt: number };

// How often the background poll runs. Collaboration is close-to-live rather than
// instant: on serverless we can't hold a socket, so this trades a couple of
// seconds of latency for a design that costs nothing to keep open.
const POLL_MS = 2500;

// The server returns 403 when the caller has been downgraded to viewer, or 404
// when they've been removed entirely. We treat both as a signal that the local
// Y.Doc is now polluted with edits the server never accepted — the only safe
// remedy is to discard local state and restart from the server's truth.
async function discardAndReset(
  documentId: string,
  persistence: IndexeddbPersistence,
  redirectTo: string | null,
) {
  try {
    await persistence.clearData();
  } catch {
    /* store already gone or blocked — the reload will still recover */
  }
  try {
    // The baseline describes a local doc that no longer exists. Leaving it
    // would make the next load diff against a document we just threw away.
    await clearSyncState(documentId);
  } catch {
    /* same — a stale baseline is corrected by the next successful sync */
  }
  if (typeof window === "undefined") return;
  if (redirectTo) {
    window.location.href = redirectTo;
  } else {
    window.location.reload();
  }
}

// Owns the document's Y.Doc, its local IndexedDB persistence, and server sync.
// Sync fires on: initial load, each local edit (debounced), reconnect, and a
// steady background poll so you see collaborators' edits and they see yours.
// Editors push-and-pull; viewers only ever pull.
export function useDocProvider(documentId: string, editable: boolean) {
  const [ydoc] = useState(() => new Y.Doc());
  const [loaded, setLoaded] = useState(false);
  const [synced, setSynced] = useState<SyncedBaseline | null>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [status, setStatus] = useState<SyncStatus>(() =>
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "synced",
  );

  // Held in a ref rather than an effect dependency: re-running the sync effect
  // would tear down the Y.Doc's persistence and resync for nothing.
  const confirm = useConfirm();
  const confirmRef = useRef(confirm);
  useEffect(() => {
    confirmRef.current = confirm;
  }, [confirm]);

  useEffect(() => {
    const persistence = new IndexeddbPersistence(localDocKey(documentId), ydoc);

    let cancelled = false;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let syncing = false;
    let rerun = false;
    let pulling = false;

    // Last known server state, restored from a previous session. Until the
    // first sync of this session lands, this is the only thing that can tell
    // an offline reader what's still unpushed.
    void (async () => {
      try {
        const stored = await getSyncState(documentId);
        if (stored && !cancelled) {
          setSynced({ baseline: stored.baseline, syncedAt: stored.syncedAt });
        }
      } catch {
        /* no baseline yet — the first successful sync writes one */
      }
    })();

    // Downgraded to viewer (403) or removed (404) mid-session. Shared by both
    // the push and pull paths since either can be the first to hear about it.
    async function handleAccessLoss(kind: 403 | 404) {
      cancelled = true;
      // Acknowledge-only, and deliberately blocking: the reset reloads the
      // page, so anything non-blocking would vanish before it was read.
      await confirmRef.current({
        title: "Your access to this document changed",
        body:
          kind === 404
            ? "You no longer have access. Any edits made since then can't be saved and will be discarded."
            : "You're now a viewer. Any edits made since the change can't be saved and will be discarded.",
        confirmLabel: "Continue",
        hideCancel: true,
      });
      await discardAndReset(documentId, persistence, kind === 404 ? "/app" : null);
    }

    // Editor path: push local changes and pull the server's in one round-trip.
    // `background` is the periodic poll — it stays quiet (no "Syncing…" flash)
    // so an idle document doesn't blink its status every couple of seconds.
    async function sync(background = false) {
      if (cancelled || !editable) return;
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      // Coalesce: if a sync is in flight, run once more when it finishes.
      if (syncing) {
        rerun = true;
        return;
      }
      syncing = true;
      if (!background) setStatus("syncing");
      try {
        // Snapshot both halves of the payload together, before the round-trip.
        // The pushed bytes are what the baseline is rebuilt from below, so they
        // have to be the exact bytes the server saw — not "whatever the doc
        // holds by the time the response lands".
        const pushed = Y.encodeStateAsUpdate(ydoc);
        const stateVector = Y.encodeStateVector(ydoc);

        const res = await fetch(`/api/documents/${documentId}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            update: bytesToBase64(pushed),
            stateVector: bytesToBase64(stateVector),
          }),
        });
        if (res.status === 403 || res.status === 404) {
          await handleAccessLoss(res.status);
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data: { update: string; presence?: PresenceUser[] } = await res.json();
        const serverDiff = base64ToBytes(data.update);
        // Origin "remote" so applying the server's diff doesn't re-trigger a push.
        Y.applyUpdate(ydoc, serverDiff, "remote");
        if (data.presence && !cancelled) setPresence(data.presence);

        // The server accepted `pushed` and answered with everything we were
        // missing, so those two merged *are* the server's state — no guessing,
        // and no extra request to go ask for it. Anything the doc has picked up
        // beyond this point (including edits typed during the round-trip) is
        // correctly left out, and shows up as pending.
        const baseline = Y.mergeUpdates([pushed, serverDiff]);
        const syncedAt = Date.now();
        if (!cancelled) setSynced({ baseline, syncedAt });
        // Persisted so a reader who reloads offline still knows what's unpushed.
        void putSyncState(documentId, baseline, syncedAt).catch(() => {
          /* the next successful sync rewrites it */
        });

        if (!cancelled) setStatus("synced");
      } catch {
        if (!cancelled) setStatus(navigator.onLine ? "error" : "offline");
      } finally {
        syncing = false;
        if (rerun && !cancelled) {
          rerun = false;
          void sync();
        }
      }
    }

    // Viewer path: pull the server's changes, push nothing. A viewer never has
    // local edits, so after applying there's nothing "pending" to track — this
    // stays deliberately lighter than sync() and skips the baseline bookkeeping.
    async function pullOnly() {
      if (cancelled || editable) return;
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      if (pulling) return;
      pulling = true;
      try {
        const res = await fetch(`/api/documents/${documentId}/pull`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stateVector: bytesToBase64(Y.encodeStateVector(ydoc)) }),
        });
        if (res.status === 403 || res.status === 404) {
          await handleAccessLoss(res.status);
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data: { update: string; presence?: PresenceUser[] } = await res.json();
        Y.applyUpdate(ydoc, base64ToBytes(data.update), "remote");
        if (data.presence && !cancelled) setPresence(data.presence);
        if (!cancelled) setStatus("synced");
      } catch {
        if (!cancelled) setStatus(navigator.onLine ? "error" : "offline");
      } finally {
        pulling = false;
      }
    }

    // One tick of the background loop: refresh unless the tab is hidden (no one
    // is watching) or we're offline (nothing to reach).
    function refresh(background = true) {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      if (!navigator.onLine) return;
      if (editable) void sync(background);
      else void pullOnly();
    }

    function startPolling() {
      if (poll) return;
      poll = setInterval(() => refresh(true), POLL_MS);
    }
    function stopPolling() {
      if (poll) {
        clearInterval(poll);
        poll = null;
      }
    }

    function scheduleSync() {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void sync(), 1200);
    }

    // Fires on every Y.Doc change. Ignore server applies ("remote") and the
    // IndexedDB load (origin === persistence); everything else is a user edit.
    function onUpdate(_update: Uint8Array, origin: unknown) {
      if (origin === "remote" || origin === persistence) return;
      scheduleSync();
    }
    ydoc.on("update", onUpdate);

    // Once local data has loaded, do the first sync (pushes offline edits, pulls
    // server) and start the background loop.
    const onSynced = () => {
      setLoaded(true);
      refresh(false);
      if (typeof document === "undefined" || !document.hidden) startPolling();
    };
    persistence.on("synced", onSynced);

    // Coming back online, or returning to the tab, both want an immediate
    // refresh — and the tab returning also restarts the loop we paused on hide.
    const onOnline = () => refresh(false);
    const onOffline = () => setStatus("offline");
    const onVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        refresh(false);
        startPolling();
      }
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (debounce) clearTimeout(debounce);
      stopPolling();
      ydoc.off("update", onUpdate);
      persistence.off("synced", onSynced);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
      void persistence.destroy();
    };
  }, [ydoc, documentId, editable]);

  return { ydoc, loaded, status, synced, presence };
}
