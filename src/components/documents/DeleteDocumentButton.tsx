"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { deleteDocumentOffline } from "@/lib/offline/mutations";

export function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  async function onDelete() {
    const ok = await confirm({
      title: "Delete this document?",
      body: "This removes it for everyone with access, along with its version history. It can't be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;

    startTransition(async () => {
      await deleteDocumentOffline(documentId);
      // Offline the delete is queued, not done — navigating to /app would need a
      // server render we can't reach, so say what happened and stay put.
      if (navigator.onLine) {
        router.push("/app");
      } else {
        toast("Deleted locally. It'll sync when you reconnect.", "info");
      }
    });
  }

  return (
    <Button variant="danger" size="sm" onClick={onDelete} disabled={pending}>
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
