"use client";

import Collaboration from "@tiptap/extension-collaboration";
import StarterKit from "@tiptap/starter-kit";
import { Editor as CoreEditor } from "@tiptap/react";
import { useEffect, useState, useTransition } from "react";
import * as Y from "yjs";
import { YJS_FRAGMENT } from "@/lib/collab";
import { base64ToBytes, bytesToBase64 } from "@/lib/sync/codec";
import type { Editor as ReactEditor } from "@tiptap/react";

type Version = {
  id: string;
  label: string;
  createdAt: string;
  createdById: string;
  createdByName: string;
  createdByEmail: string;
};

type Preview = { versionId: string; label: string; html: string } | null;
type Message = { kind: "success" | "error"; text: string } | null;

// Instantiate a headless Tiptap editor bound to a temporary Y.Doc so we can
// pull the snapshot's content out as prosemirror JSON. Doing the round-trip
// through Tiptap guarantees the JSON we hand to `setContent` matches the
// schema the live editor is running.
function extractSnapshot(bytes: Uint8Array) {
  const tempDoc = new Y.Doc();
  Y.applyUpdate(tempDoc, bytes);

  const el = typeof document === "undefined" ? undefined : document.createElement("div");
  const editor = new CoreEditor({
    element: el,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: tempDoc, field: YJS_FRAGMENT }),
    ],
  });

  const json = editor.getJSON();
  const html = editor.getHTML();
  editor.destroy();
  tempDoc.destroy();
  return { json, html };
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function VersionHistoryPanel({
  documentId,
  ydoc,
  editor,
  canEdit,
}: {
  documentId: string;
  ydoc: Y.Doc;
  editor: ReactEditor | null;
  canEdit: boolean;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [preview, setPreview] = useState<Preview>(null);
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/versions`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { versions: Version[] };
        if (!cancelled) setVersions(data.versions);
      } catch {
        if (!cancelled) setMessage({ kind: "error", text: "Could not load version history." });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  async function saveVersion(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    setMessage(null);
    const trimmed = label.trim();
    const finalLabel =
      trimmed ||
      `Snapshot ${new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })}`;

    startTransition(async () => {
      const snapshot = bytesToBase64(Y.encodeStateAsUpdate(ydoc));
      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: finalLabel, snapshot }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage({ kind: "error", text: data?.error ?? "Could not save version." });
        return;
      }
      setVersions((prev) => [data.version as Version, ...prev]);
      setLabel("");
      setMessage({ kind: "success", text: `Saved “${finalLabel}”.` });
    });
  }

  async function fetchState(versionId: string): Promise<Uint8Array | null> {
    try {
      const res = await fetch(`/api/documents/${documentId}/versions/${versionId}/state`);
      if (!res.ok) return null;
      const data = (await res.json()) as { state: string };
      return base64ToBytes(data.state);
    } catch {
      return null;
    }
  }

  async function onPreview(version: Version) {
    setMessage(null);
    const bytes = await fetchState(version.id);
    if (!bytes) {
      setMessage({ kind: "error", text: "Could not load that version." });
      return;
    }
    try {
      const { html } = extractSnapshot(bytes);
      setPreview({ versionId: version.id, label: version.label, html });
    } catch {
      setMessage({ kind: "error", text: "Version content couldn't be rendered." });
    }
  }

  async function onRestore(version: Version) {
    if (!canEdit || !editor) return;
    const confirmed = window.confirm(
      `Restore to “${version.label}”?\n\nThis creates a new revision that everyone with access will see. Nothing is deleted from history — you can always save the current version first if you want to come back to it.`,
    );
    if (!confirmed) return;

    setMessage(null);
    startTransition(async () => {
      const bytes = await fetchState(version.id);
      if (!bytes) {
        setMessage({ kind: "error", text: "Could not load that version." });
        return;
      }
      try {
        const { json } = extractSnapshot(bytes);
        // setContent on the live editor mutates the shared Y.Doc via the
        // Collaboration extension, so the restore propagates through the same
        // sync pipeline as any other edit — no special server path needed.
        editor.commands.setContent(json, { emitUpdate: true });
        setMessage({ kind: "success", text: `Restored to “${version.label}”.` });
        setPreview(null);
      } catch {
        setMessage({ kind: "error", text: "Restore failed." });
      }
    });
  }

  return (
    <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-lg font-semibold tracking-tight">Version history</h2>
      <p className="mt-1 text-sm text-zinc-500">
        {canEdit
          ? "Save a labelled snapshot anytime. Restore turns any past snapshot into a new revision without erasing history."
          : "Browse past versions of this document."}
      </p>

      {canEdit ? (
        <form onSubmit={saveVersion} className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Optional label (e.g. 'Before the rewrite')"
            aria-label="Snapshot label"
            className="min-w-64 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:focus:border-zinc-500"
            disabled={pending}
            maxLength={200}
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "Saving…" : "Save version"}
          </button>
        </form>
      ) : null}

      {message ? (
        <p
          role="status"
          className={
            message.kind === "success"
              ? "mt-3 text-sm text-emerald-600 dark:text-emerald-400"
              : "mt-3 text-sm text-red-600 dark:text-red-400"
          }
        >
          {message.text}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">Loading history…</p>
      ) : versions.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No versions yet. {canEdit ? "Save one to build a timeline." : ""}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {v.label}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {formatWhen(v.createdAt)} · {v.createdByName || v.createdByEmail}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPreview(v)}
                  disabled={pending}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium disabled:opacity-50 dark:border-zinc-700"
                >
                  Preview
                </button>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => onRestore(v)}
                    disabled={pending || !editor}
                    className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 disabled:opacity-50 dark:border-amber-700 dark:text-amber-400"
                  >
                    Restore
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {preview ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${preview.label}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{preview.label}</p>
                <p className="text-xs text-zinc-500">Read-only preview</p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      const v = versions.find((x) => x.id === preview.versionId);
                      if (v) onRestore(v);
                    }}
                    disabled={pending}
                    className="rounded-md border border-amber-300 px-3 py-1 text-xs font-medium text-amber-700 disabled:opacity-50 dark:border-amber-700 dark:text-amber-400"
                  >
                    Restore this version
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium dark:border-zinc-700"
                >
                  Close
                </button>
              </div>
            </div>
            <div
              className="prose prose-sm max-w-none overflow-y-auto px-5 py-4 dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
