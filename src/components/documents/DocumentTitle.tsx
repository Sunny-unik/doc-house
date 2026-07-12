"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { renameDocumentOffline } from "@/lib/offline/mutations";

export function DocumentTitle({
  documentId,
  initialTitle,
  editable,
}: {
  documentId: string;
  initialTitle: string;
  editable: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // The server component owns the canonical title. Anytime the SSR value shifts
  // (e.g. a `router.refresh()` after applying an AI-suggested title, or a live
  // rename from another surface), pull that value into local state — but never
  // clobber whatever the user is actively typing right now.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setTitle(initialTitle);
  }, [initialTitle]);

  if (!editable) {
    return (
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {initialTitle}
      </h1>
    );
  }

  function commit() {
    const next = title.trim() || "Untitled";
    setTitle(next);
    if (next === initialTitle) return;
    startTransition(() => renameDocumentOffline(documentId, next));
  }

  return (
    <input
      ref={inputRef}
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      disabled={pending}
      aria-label="Document title"
      className="w-full rounded-md border border-transparent bg-transparent px-1 text-2xl font-semibold tracking-tight text-zinc-900 outline-none hover:border-zinc-200 focus:border-zinc-300 disabled:opacity-60 dark:text-zinc-50 dark:hover:border-zinc-800 dark:focus:border-zinc-700"
    />
  );
}
