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
      <h1 className="truncate text-2xl font-semibold tracking-tight text-text">{initialTitle}</h1>
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
      // Borderless until hovered/focused so it reads as a heading, but still
      // signals it's editable when you reach for it.
      className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-2xl font-semibold tracking-tight text-text outline-none transition-colors hover:border-line focus:border-line-strong focus:bg-surface disabled:opacity-60"
    />
  );
}
