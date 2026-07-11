"use client";

import { useEffect, useState } from "react";
import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { localDocKey, YJS_FRAGMENT } from "@/lib/collab";
import { base64ToBytes, bytesToBase64 } from "@/lib/sync/codec";
import { Toolbar } from "./Toolbar";
import "./editor.css";

export function Editor({ documentId, editable }: { documentId: string; editable: boolean }) {
  // One Y.Doc per mount — this is the document's source of truth. Created in a
  // useState initializer so it's stable across re-renders.
  const [ydoc] = useState(() => new Y.Doc());
  const [loaded, setLoaded] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "error">("idle");

  // Temporary manual sync (CP6). One request pushes our local update and pulls
  // whatever the server has that we're missing; the automatic provider is CP7.
  async function syncNow() {
    setSyncState("syncing");
    try {
      const res = await fetch(`/api/documents/${documentId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          update: bytesToBase64(Y.encodeStateAsUpdate(ydoc)),
          stateVector: bytesToBase64(Y.encodeStateVector(ydoc)),
        }),
      });
      if (!res.ok) throw new Error(`Sync failed (${res.status})`);
      const data: { update: string } = await res.json();
      // Origin "remote" so the future outbox (CP7) won't re-send server content.
      Y.applyUpdate(ydoc, base64ToBytes(data.update), "remote");
      setSyncState("idle");
    } catch (error) {
      console.error(error);
      setSyncState("error");
    }
  }

  useEffect(() => {
    // IndexedDB is authoritative: edits persist across reloads and fully offline.
    // No network is involved yet — server sync arrives in the next checkpoint.
    const persistence = new IndexeddbPersistence(localDocKey(documentId), ydoc);
    const onSynced = () => setLoaded(true);
    persistence.on("synced", onSynced);

    return () => {
      persistence.off("synced", onSynced);
      // Destroy only the persistence provider, not the Y.Doc — under React
      // StrictMode the effect remounts and would otherwise reuse a dead doc.
      void persistence.destroy();
    };
  }, [ydoc, documentId]);

  const editor = useEditor({
    editable,
    immediatelyRender: false,
    extensions: [
      // Yjs owns undo/redo history, so StarterKit's own history is disabled.
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: ydoc, field: YJS_FRAGMENT }),
    ],
    editorProps: {
      attributes: { class: "editor-content" },
    },
  });

  return (
    <div className="mt-4">
      {editable && editor ? <Toolbar editor={editor} /> : null}
      <div className="mt-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <EditorContent editor={editor} />
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
        <span>
          {loaded ? (
            <span className="text-emerald-600 dark:text-emerald-400">● Saved locally</span>
          ) : (
            "Loading…"
          )}
        </span>
        {editable ? (
          <button
            type="button"
            onClick={syncNow}
            disabled={syncState === "syncing"}
            className="rounded border border-zinc-300 px-2 py-1 font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {syncState === "syncing" ? "Syncing…" : "Sync now"}
          </button>
        ) : null}
        {syncState === "error" ? (
          <span className="text-red-600 dark:text-red-400">Sync failed — see console</span>
        ) : null}
      </div>
    </div>
  );
}
