"use client";

import Collaboration from "@tiptap/extension-collaboration";
import { Editor as CoreEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState, useTransition } from "react";
import * as Y from "yjs";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { useToast } from "@/components/ui/Toast";
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
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/versions`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { versions: Version[] };
        if (!cancelled) setVersions(data.versions);
      } catch {
        if (!cancelled) toast("Could not load version history.", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `toast` is stable from the provider; re-running on it would refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  async function saveVersion(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
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
        toast(data?.error ?? "Could not save version.", "error");
        return;
      }
      setVersions((prev) => [data.version as Version, ...prev]);
      setLabel("");
      toast(`Saved “${finalLabel}”.`, "success");
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
    const bytes = await fetchState(version.id);
    if (!bytes) {
      toast("Could not load that version.", "error");
      return;
    }
    try {
      const { html } = extractSnapshot(bytes);
      setPreview({ versionId: version.id, label: version.label, html });
    } catch {
      toast("Version content couldn't be rendered.", "error");
    }
  }

  async function onRestore(version: Version) {
    if (!canEdit || !editor) return;
    const ok = await confirm({
      title: `Restore “${version.label}”?`,
      body: "This creates a new revision that everyone with access will see. Nothing is deleted from history — save the current version first if you want a way back to it.",
      confirmLabel: "Restore",
    });
    if (!ok) return;

    startTransition(async () => {
      const bytes = await fetchState(version.id);
      if (!bytes) {
        toast("Could not load that version.", "error");
        return;
      }
      try {
        const { json } = extractSnapshot(bytes);
        // setContent on the live editor mutates the shared Y.Doc via the
        // Collaboration extension, so the restore propagates through the same
        // sync pipeline as any other edit — no special server path needed.
        editor.commands.setContent(json, { emitUpdate: true });
        toast(`Restored to “${version.label}”.`, "success");
        setPreview(null);
      } catch {
        toast("Restore failed.", "error");
      }
    });
  }

  return (
    <div>
      <p className="text-sm text-text-muted">
        {canEdit
          ? "Save a labelled snapshot anytime. Restoring turns a past snapshot into a new revision without erasing history."
          : "Browse past versions of this document."}
      </p>

      {canEdit ? (
        <form onSubmit={saveVersion} className="mt-4 flex flex-wrap items-center gap-2">
          <div className="min-w-64 flex-1">
            <label htmlFor="version-label" className="sr-only">
              Snapshot label
            </label>
            <Input
              id="version-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Optional label (e.g. 'Before the rewrite')"
              disabled={pending}
              maxLength={200}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save version"}
          </Button>
        </form>
      ) : null}

      {loading ? (
        <p className="mt-5 text-sm text-text-muted">Loading history…</p>
      ) : versions.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No versions yet"
            description={canEdit ? "Save one to start building a timeline." : undefined}
          />
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-line">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">{v.label}</p>
                <p className="truncate text-xs text-text-subtle">
                  <TimeAgo iso={v.createdAt} /> · {v.createdByName || v.createdByEmail}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => onPreview(v)} disabled={pending}>
                  Preview
                </Button>
                {canEdit ? (
                  <Button size="sm" onClick={() => onRestore(v)} disabled={pending || !editor}>
                    Restore
                  </Button>
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
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">{preview.label}</p>
                <p className="text-xs text-text-subtle">Read-only preview</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {canEdit ? (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      const v = versions.find((x) => x.id === preview.versionId);
                      if (v) onRestore(v);
                    }}
                  >
                    Restore this version
                  </Button>
                ) : null}
                <Button variant="secondary" size="sm" onClick={() => setPreview(null)}>
                  Close
                </Button>
              </div>
            </div>
            <div
              className="editor-content overflow-y-auto px-5 py-4"
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
