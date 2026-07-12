"use client";

import type { Editor } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { renameDocumentOffline } from "@/lib/offline/mutations";

type Kind = "summary" | "title";
type Result = { kind: Kind; text: string } | null;
type Message = { kind: "error" | "info"; text: string } | null;

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
  const [result, setResult] = useState<Result>(null);
  const [message, setMessage] = useState<Message>(null);
  const [running, setRunning] = useState<Kind | null>(null);
  const [pending, startTransition] = useTransition();

  async function run(kind: Kind) {
    setMessage(null);
    if (!editor) return;
    const content = editor.getText().trim();
    if (!content) {
      setMessage({ kind: "info", text: "Write something first — then I'll have material to work with." });
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
          setMessage({
            kind: "error",
            text: data?.error ?? "AI request failed. Please try again.",
          });
          return;
        }
        const text = (kind === "summary" ? data.summary : data.title) as string;
        setResult({ kind, text });
      } catch {
        setMessage({ kind: "error", text: "AI request failed. Please try again." });
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
      setMessage({ kind: "info", text: `Title updated to “${newTitle}”.` });
      // Server component owns the visible title; refresh so it re-renders.
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Couldn't apply the title." });
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ kind: "info", text: "Copied to clipboard." });
    } catch {
      setMessage({ kind: "error", text: "Couldn't copy — select manually and copy." });
    }
  }

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-lg font-semibold tracking-tight">Assistant</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Summarise the document or suggest a title based on what you&apos;ve written so far.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run("summary")}
          disabled={pending || !editor}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
        >
          {running === "summary" ? "Summarising…" : "Summarise document"}
        </button>
        {canEdit ? (
          <button
            type="button"
            onClick={() => run("title")}
            disabled={pending || !editor}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
          >
            {running === "title" ? "Thinking…" : "Suggest title"}
          </button>
        ) : null}
      </div>

      {message ? (
        <p
          role="status"
          className={
            message.kind === "error"
              ? "mt-3 text-sm text-red-600 dark:text-red-400"
              : "mt-3 text-sm text-zinc-600 dark:text-zinc-400"
          }
        >
          {message.text}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            {result.kind === "summary" ? "Summary" : "Suggested title"}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-100">
            {result.text}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copy(result.text)}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium dark:border-zinc-700"
            >
              Copy
            </button>
            {result.kind === "title" && canEdit ? (
              <button
                type="button"
                onClick={() => applyTitle(result.text)}
                className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
              >
                Apply as document title
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium dark:border-zinc-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
