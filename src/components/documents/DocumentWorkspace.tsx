"use client";

import { useEffect, useState } from "react";
import { DeleteDocumentButton } from "@/components/documents/DeleteDocumentButton";
import { DocumentTitle } from "@/components/documents/DocumentTitle";
import { MembersPanel } from "@/components/documents/MembersPanel";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import type { DocRole } from "@/db/schema";
import { getCachedDoc } from "@/lib/offline/docs-cache";

type Member = { userId: string; email: string; name: string; role: DocRole };

type Meta = {
  title: string;
  role: DocRole;
  currentUserId: string | null;
  members: Member[];
};

// Rendered by AppShell when a document is open. It receives the id as a prop
// (not from the router) and loads its metadata from IndexedDB first — instant
// and the only source offline — then refreshes from the API when online.
export function DocumentWorkspace({ id, onClose }: { id: string; onClose: () => void }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound">("loading");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = await getCachedDoc(id);
      if (!cancelled && cached) {
        setMeta({
          title: cached.title,
          role: cached.role as DocRole,
          currentUserId: null,
          members: [],
        });
        setState("ready");
      }

      if (typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const res = await fetch(`/api/documents/${id}`);
          if (res.status === 404 || res.status === 403) {
            if (!cancelled) setState("notfound");
            return;
          }
          if (res.ok) {
            const data = (await res.json()) as Meta;
            if (!cancelled) {
              setMeta(data);
              setState("ready");
            }
          }
        } catch {
          // Network blip: keep whatever cached metadata we already showed.
        }
      } else if (!cached) {
        // Offline and never cached: still open the editor — its content may be
        // in IndexedDB, and the server enforces real permissions on the next sync.
        if (!cancelled) {
          setMeta({ title: "Untitled", role: "editor", currentUserId: null, members: [] });
          setState("ready");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const backButton = (
    <button
      type="button"
      onClick={onClose}
      className="self-start text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
    >
      ← All documents
    </button>
  );

  if (state === "loading") {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
        {backButton}
        <p className="mt-8 text-sm text-zinc-500">Loading document…</p>
      </main>
    );
  }

  if (state === "notfound" || !meta) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
        {backButton}
        <p className="mt-8 text-sm text-zinc-500">
          This document isn’t available. It may have been deleted, or you no longer have access.
        </p>
      </main>
    );
  }

  const editable = meta.role !== "viewer";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
      {backButton}

      <div className="mt-4 flex items-center justify-between gap-4">
        <DocumentTitle documentId={id} initialTitle={meta.title} editable={editable} />
        {meta.role === "owner" ? (
          <DeleteDocumentButton documentId={id} onDone={onClose} />
        ) : null}
      </div>
      <p className="mt-1 text-sm text-zinc-500">Your role: {meta.role}</p>

      <DocumentEditor documentId={id} editable={editable} />

      {meta.currentUserId ? (
        <MembersPanel
          documentId={id}
          currentUserId={meta.currentUserId}
          currentUserRole={meta.role}
          initialMembers={meta.members}
          onLeave={onClose}
        />
      ) : null}
    </main>
  );
}
