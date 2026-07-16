"use client";

import Collaboration from "@tiptap/extension-collaboration";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { AIAssistant } from "@/components/documents/AIAssistant";
import { ChangesPanel } from "@/components/documents/ChangesPanel";
import { ShareLinksPanel } from "@/components/documents/ShareLinksPanel";
import { VersionHistoryPanel } from "@/components/documents/VersionHistoryPanel";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { YJS_FRAGMENT } from "@/lib/collab";
import { ConnectionStatus } from "./ConnectionStatus";
import { Toolbar } from "./Toolbar";
import { useDocProvider } from "./useDocProvider";
import "./editor.css";

export function Editor({
  documentId,
  editable,
  isOwner,
  membersPanel,
}: {
  documentId: string;
  editable: boolean;
  isOwner: boolean;
  // Rendered by the server component (it needs the member list and session), then
  // handed down so it can live alongside the panels that depend on the Y.Doc.
  membersPanel: React.ReactNode;
}) {
  // The provider owns the Y.Doc, local persistence, and automatic server sync.
  const { ydoc, loaded, status, synced } = useDocProvider(documentId, editable);

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

  const tabs: TabItem[] = [
    {
      id: "assistant",
      label: "Summarizer",
      content: (
        <div>
          <AIAssistant documentId={documentId} editor={editor} canEdit={editable} />
          <ChangesPanel
            documentId={documentId}
            ydoc={ydoc}
            synced={synced}
            canEdit={editable}
          />
        </div>
      ),
    },
    {
      id: "history",
      label: "Version history",
      content: (
        <VersionHistoryPanel
          documentId={documentId}
          ydoc={ydoc}
          editor={editor}
          canEdit={editable}
        />
      ),
    },
    { id: "people", label: "People", content: membersPanel },
  ];

  // Share links are an owner-only power, and the API enforces that too — this
  // just avoids showing a tab that would only ever return 403.
  if (isOwner) {
    tabs.push({
      id: "share",
      label: "Share",
      content: <ShareLinksPanel documentId={documentId} />,
    });
  }

  return (
    <div className="mt-5">
      {editable && editor ? <Toolbar editor={editor} /> : null}

      {/* Caps the writing surface so a long document scrolls inside the box
          instead of stretching the whole page. min-height (20rem, in editor.css)
          still lets it grow first; the cap only bites past that. scroll-region
          themes the scrollbar to match the rest of the app. */}
      <div className="scroll-region mt-3 max-h-[60vh] overflow-y-auto rounded-xl border border-line bg-surface px-5 py-4">
        <EditorContent editor={editor} />
      </div>

      <div className="mt-2.5 flex items-center gap-3 px-1 text-xs text-text-subtle">
        {editable ? <ConnectionStatus status={status} /> : null}
        <span>{loaded ? "Saved locally" : "Loading…"}</span>
      </div>

      <div className="mt-10">
        <Tabs label="Document tools" tabs={tabs} />
      </div>
    </div>
  );
}
