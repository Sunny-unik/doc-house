"use client";

import { useEffect, useState } from "react";
import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { localDocKey, YJS_FRAGMENT } from "@/lib/collab";
import { Toolbar } from "./Toolbar";
import "./editor.css";

export function Editor({ documentId, editable }: { documentId: string; editable: boolean }) {
  // One Y.Doc per mount — this is the document's source of truth. Created in a
  // useState initializer so it's stable across re-renders.
  const [ydoc] = useState(() => new Y.Doc());
  const [loaded, setLoaded] = useState(false);

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
      <p className="mt-2 text-xs text-zinc-500">
        {loaded ? (
          <span className="text-emerald-600 dark:text-emerald-400">● Saved locally</span>
        ) : (
          "Loading…"
        )}
      </p>
    </div>
  );
}
