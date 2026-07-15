"use client";

import { useTransition } from "react";
import { deleteDocumentOffline } from "@/lib/offline/mutations";

export function DeleteDocumentButton({
  documentId,
  onDone,
}: {
  documentId: string;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm("Delete this document? This can’t be undone.")) return;
    startTransition(async () => {
      await deleteDocumentOffline(documentId);
      onDone();
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      className="shrink-0 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
