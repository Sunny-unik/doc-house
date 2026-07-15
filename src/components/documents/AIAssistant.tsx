"use client";

import type { Editor } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { renameDocumentOffline } from "@/lib/offline/mutations";

type Kind = "summary" | "title";
type Result = { kind: Kind; text: string } | null;

export function AIAssistant({
  documentId,
  editor,
  canEdit,
}: {
  documentId: string;
  editor: Editor | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [result, setResult] = useState<Result>(null);
  const [running, setRunning] = useState<Kind | null>(null);
  const [pending, startTransition] = useTransition();

  async function run(kind: Kind) {
    if (!editor) return;
    const content = editor.getText().trim();
    if (!content) {
      toast("Write something first — then I'll have material to work with.", "info");
      return;
    }

    setRunning(kind);
    startTransition(async () => {
      const path = kind === "summary" ? "summarize" : "suggest-title";
      try {
        const res = await fetch(`/api/documents/${documentId}/ai/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          toast(data?.error ?? "AI request failed. Please try again.", "error");
          return;
        }
        setResult({ kind, text: (kind === "summary" ? data.summary : data.title) as string });
      } catch {
        toast("AI request failed. Please try again.", "error");
      } finally {
        setRunning(null);
      }
    });
  }

  async function applyTitle(newTitle: string) {
    if (!canEdit) return;
    setResult(null);
    try {
      await renameDocumentOffline(documentId, newTitle);
      toast(`Title updated to “${newTitle}”.`, "success");
      // Server component owns the visible title; refresh so it re-renders.
      router.refresh();
    } catch {
      toast("Couldn't apply the title.", "error");
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard.", "success");
    } catch {
      toast("Couldn't copy — select the text and copy manually.", "error");
    }
  }

  return (
    <div>
      <p className="text-sm text-text-muted">
        Summarise the document or suggest a title based on what you&apos;ve written so far.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => run("summary")} disabled={pending || !editor}>
          {running === "summary" ? "Summarising…" : "Summarise document"}
        </Button>
        {canEdit ? (
          <Button variant="secondary" onClick={() => run("title")} disabled={pending || !editor}>
            {running === "title" ? "Thinking…" : "Suggest title"}
          </Button>
        ) : null}
      </div>

      {result ? (
        <div className="mt-5 rounded-xl border border-line bg-surface-muted p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-subtle">
            {result.kind === "summary" ? "Summary" : "Suggested title"}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text">{result.text}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => copy(result.text)}>
              Copy
            </Button>
            {result.kind === "title" && canEdit ? (
              <Button size="sm" onClick={() => applyTitle(result.text)}>
                Apply as title
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
