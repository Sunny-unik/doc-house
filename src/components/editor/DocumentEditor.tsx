"use client";

import dynamic from "next/dynamic";

// The editor touches browser-only APIs (IndexedDB, ProseMirror), so it must not
// render on the server. next/dynamic with ssr:false is only allowed inside a
// client component, which is what this thin wrapper is for.
const Editor = dynamic(() => import("./Editor").then((m) => m.Editor), {
  ssr: false,
  loading: () => <p className="mt-5 text-sm text-text-muted">Loading editor…</p>,
});

export function DocumentEditor(props: {
  documentId: string;
  editable: boolean;
  membersPanel: React.ReactNode;
}) {
  return <Editor {...props} />;
}
