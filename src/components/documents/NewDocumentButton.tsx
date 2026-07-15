"use client";

import { useTransition } from "react";
import { createDocumentOffline } from "@/lib/offline/mutations";

export function NewDocumentButton({ onOpen }: { onOpen: (id: string) => void }) {
  const [pending, startTransition] = useTransition();

  function onNew() {
    startTransition(async () => {
      const id = await createDocumentOffline();
      // Opening is client-side state, so a freshly created doc opens whether
      // we're online or offline (the create itself is queued in the outbox).
      onOpen(id);
    });
  }

  return (
    <button
      type="button"
      onClick={onNew}
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      {pending ? "Creating…" : "New document"}
    </button>
  );
}
