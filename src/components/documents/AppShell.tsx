"use client";

import { useCallback, useEffect, useState } from "react";
import { DocumentList } from "@/components/documents/DocumentList";
import { DocumentWorkspace } from "@/components/documents/DocumentWorkspace";
import { NewDocumentButton } from "@/components/documents/NewDocumentButton";
import type { CachedDoc } from "@/lib/offline/db";

// The open document is tracked in client state, and the URL is kept in sync with
// history.pushState — deliberately NOT Next's router. Router navigation fetches
// the target route's RSC, which fails offline; pushState is a pure client-side
// URL change with zero network, so opening any already-cached document works
// fully offline.
export function AppShell({
  initialDocs,
  initialHasMore,
  initialOpenId,
}: {
  initialDocs: CachedDoc[];
  initialHasMore: boolean;
  initialOpenId: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId);

  const openDocument = useCallback((id: string) => {
    window.history.pushState(null, "", `/app?id=${id}`);
    setOpenId(id);
  }, []);

  const closeDocument = useCallback(() => {
    window.history.pushState(null, "", "/app");
    setOpenId(null);
  }, []);

  // Keep state in sync with the browser back/forward buttons.
  useEffect(() => {
    const onPopState = () => {
      setOpenId(new URLSearchParams(window.location.search).get("id"));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (openId) {
    return <DocumentWorkspace key={openId} id={openId} onClose={closeDocument} />;
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Documents
        </h1>
        <NewDocumentButton onOpen={openDocument} />
      </div>

      <DocumentList
        initialDocs={initialDocs}
        initialHasMore={initialHasMore}
        onOpen={openDocument}
      />
    </main>
  );
}
