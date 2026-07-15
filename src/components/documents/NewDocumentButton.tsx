"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { createDocumentOffline } from "@/lib/offline/mutations";

export function NewDocumentButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function onNew() {
    startTransition(async () => {
      const id = await createDocumentOffline();
      // Online: the doc now exists server-side, so open it. Offline: it's queued
      // and cached, and opening it would need a server render we can't reach —
      // so stay put and say what happened instead of navigating into an error.
      if (navigator.onLine) {
        router.push(`/app/${id}`);
      } else {
        toast("Document created offline. It'll sync when you reconnect.", "info");
        router.refresh();
      }
    });
  }

  return (
    <Button onClick={onNew} disabled={pending}>
      {pending ? "Creating…" : "New document"}
    </Button>
  );
}
