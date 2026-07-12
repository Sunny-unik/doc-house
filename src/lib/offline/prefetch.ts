"use client";

import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { localDocKey } from "@/lib/collab";
import { base64ToBytes } from "@/lib/sync/codec";

// Warm a document's local IndexedDB store from the server snapshot so the doc
// opens instantly next time and — critically — works offline even if the user
// never opened it in this browser before. Safe to call for docs that are
// already fully synced: Yjs merges the incoming update as a no-op.
export async function prefetchDocument(documentId: string, signal?: AbortSignal): Promise<void> {
  if (typeof window === "undefined") return;
  if (!navigator.onLine || signal?.aborted) return;

  const ydoc = new Y.Doc();
  const persistence = new IndexeddbPersistence(localDocKey(documentId), ydoc);

  try {
    await persistence.whenSynced;
    if (signal?.aborted) return;

    const res = await fetch(`/api/documents/${documentId}/snapshot`, { signal });
    if (!res.ok) return;
    const data = (await res.json()) as { update: string };
    Y.applyUpdate(ydoc, base64ToBytes(data.update), "prefetch");
    // Let y-indexeddb's write queue drain before we tear the provider down.
    await new Promise((resolve) => setTimeout(resolve, 0));
  } catch {
    // Prefetch is best-effort — network hiccups or aborts just mean this doc
    // won't be warm offline until the user opens it explicitly.
  } finally {
    try {
      await persistence.destroy();
    } catch {
      /* already destroyed */
    }
    ydoc.destroy();
  }
}

// Prefetch a batch sequentially so we don't hammer the server or blow through
// the browser's connection budget on a large doc list.
export async function prefetchDocuments(ids: string[], signal?: AbortSignal): Promise<void> {
  for (const id of ids) {
    if (signal?.aborted) return;
    await prefetchDocument(id, signal);
  }
}
