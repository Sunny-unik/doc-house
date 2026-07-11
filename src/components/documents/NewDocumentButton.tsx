"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createDocumentOffline } from "@/lib/offline/mutations";

export function NewDocumentButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onNew() {
    startTransition(async () => {
      const id = await createDocumentOffline();
      // Online: the doc now exists server-side, so open it. Offline: it's queued
      // and cached; opening it offline needs the service worker (next step).
      if (navigator.onLine) router.push(`/app/${id}`);
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
