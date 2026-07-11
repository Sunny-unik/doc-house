"use client";

import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { YJS_FRAGMENT } from "@/lib/collab";
import { ConnectionStatus } from "./ConnectionStatus";
import { Toolbar } from "./Toolbar";
import { useDocProvider } from "./useDocProvider";
import "./editor.css";

export function Editor({ documentId, editable }: { documentId: string; editable: boolean }) {
  // The provider owns the Y.Doc, local persistence, and automatic server sync.
  const { ydoc, loaded, status } = useDocProvider(documentId, editable);

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
        {editable ? <ConnectionStatus status={status} /> : null}
        <span>{loaded ? "Saved locally" : "Loading…"}</span>
      </div>
    </div>
  );
}
