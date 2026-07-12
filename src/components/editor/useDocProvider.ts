"use client";

import { useEffect, useState } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { localDocKey } from "@/lib/collab";
import { base64ToBytes, bytesToBase64 } from "@/lib/sync/codec";

export type SyncStatus = "synced" | "syncing" | "offline" | "error";

// The server returns 403 when the caller has been downgraded to viewer, or 404
// when they've been removed entirely. We treat both as a signal that the local
// Y.Doc is now polluted with edits the server never accepted — the only safe
// remedy is to discard local state and restart from the server's truth.
async function discardAndReset(
  persistence: IndexeddbPersistence,
  redirectTo: string | null,
) {
  try {
    await persistence.clearData();
  } catch {
    /* store already gone or blocked — the reload will still recover */
  }
  if (typeof window === "undefined") return;
  if (redirectTo) {
    window.location.href = redirectTo;
  } else {
    window.location.reload();
  }
}

// Owns the document's Y.Doc, its local IndexedDB persistence, and the automatic
// server sync. Sync is triggered by: initial load, each local edit (debounced),
// and coming back online. No constant polling — so it's "auto-sync", not realtime.
export function useDocProvider(documentId: string, editable: boolean) {
  const [ydoc] = useState(() => new Y.Doc());
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SyncStatus>(() =>
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "synced",
  );

  useEffect(() => {
    const persistence = new IndexeddbPersistence(localDocKey(documentId), ydoc);

    let cancelled = false;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let syncing = false;
    let rerun = false;

    async function sync() {
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
      setStatus("syncing");
      try {
        const res = await fetch(`/api/documents/${documentId}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            update: bytesToBase64(Y.encodeStateAsUpdate(ydoc)),
            stateVector: bytesToBase64(Y.encodeStateVector(ydoc)),
          }),
        });
        if (res.status === 403 || res.status === 404) {
          // Role revoked or membership dropped mid-session. Stop accepting
          // further edits, wipe the polluted local store, and reload from the
          // server's canonical state. 404 also means we've lost access
          // entirely — bounce back to the doc list.
          cancelled = true;
          if (typeof window !== "undefined") {
            window.alert(
              "Your access to this document has changed. Local edits made after that will be discarded.",
            );
          }
          await discardAndReset(persistence, res.status === 404 ? "/app" : null);
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data: { update: string } = await res.json();
        // Origin "remote" so applying the server's diff doesn't re-trigger a push.
        Y.applyUpdate(ydoc, base64ToBytes(data.update), "remote");
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

    // Once local data has loaded, do the first sync (pushes offline edits, pulls server).
    const onSynced = () => {
      setLoaded(true);
      void sync();
    };
    persistence.on("synced", onSynced);

    const onOnline = () => void sync();
    const onOffline = () => setStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      if (debounce) clearTimeout(debounce);
      ydoc.off("update", onUpdate);
      persistence.off("synced", onSynced);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      void persistence.destroy();
    };
  }, [ydoc, documentId, editable]);

  return { ydoc, loaded, status };
}
