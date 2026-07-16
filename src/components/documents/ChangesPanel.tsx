"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import type { SyncedBaseline } from "@/components/editor/useDocProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { useToast } from "@/components/ui/Toast";
import { docText, YJS_FRAGMENT } from "@/lib/collab";
import { condenseDiff, type DiffOp, diffStats, type DiffStats, diffWords } from "@/lib/diff/text";

// One entry from GET /changes. Mirrored here rather than imported from the
// route so the client bundle never reaches across into server-only code.
type ChangeEntry = {
  id: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorIsGuest: boolean;
  added: number;
  removed: number;
  addedText: string;
  removedText: string;
};

type Pending = {
  ops: DiffOp[];
  stats: DiffStats;
  // Whether the doc diverges from the baseline *at all*. Deliberately not
  // derived from `stats`: see the structural comparison below.
  changed: boolean;
};

// How long after a Y.Doc change we recompute the pending diff. Long enough that
// a fast typist doesn't run a diff per keystroke, short enough that the panel
// still feels live while you watch it.
const RECOMPUTE_DELAY = 400;

// The sync debounce is 1.2s, so a burst of typing produces a burst of syncs.
// Waiting a beat past that collapses them into one refetch of the history.
const REFETCH_DELAY = 1500;

export function ChangesPanel({
  documentId,
  ydoc,
  synced,
  canEdit,
}: {
  documentId: string;
  ydoc: Y.Doc;
  // Null until the first sync of this session lands and no baseline was stored
  // by a previous one — i.e. we genuinely don't know what the server has yet.
  synced: SyncedBaseline | null;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<ChangeEntry[]>([]);
  // Entries in the whole log, not just the page we describe — the API caps how
  // many it walks back through, and a capped list that doesn't say so reads as
  // the complete history.
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // A Y.Doc mutates in place, so React can't see it change. This counter is the
  // subscription: the doc bumps it, and the diff below re-derives off it.
  // Debounced, or a fast typist would run a diff per keystroke.
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onUpdate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setRevision((n) => n + 1), RECOMPUTE_DELAY);
    };
    ydoc.on("update", onUpdate);
    return () => {
      if (timer) clearTimeout(timer);
      ydoc.off("update", onUpdate);
    };
  }, [ydoc]);

  // Rebuild the document as the server last had it, then diff the live doc
  // against it. Both sides go through the same docText() the changes API uses,
  // so "waiting to sync" and "synced history" describe changes the same way.
  const pending = useMemo<Pending | null>(() => {
    // `revision` isn't read here — it's the invalidation signal for the live
    // Y.Doc, which is mutable and therefore can't be a dependency itself.
    void revision;
    if (!synced) return null;

    const base = new Y.Doc({ gc: false });
    try {
      Y.applyUpdate(base, synced.baseline, "baseline");

      // Whether anything is pending is decided structurally, never from the
      // text diff below. Marks (bold, strikethrough) and node changes leave the
      // plain text byte-identical, so a text diff calls them "nothing pending"
      // — and telling someone their unsaved work is safely on the server is the
      // one lie this panel must never tell. toString() renders marks as tags,
      // so it catches what docText() deliberately drops.
      const changed =
        base.getXmlFragment(YJS_FRAGMENT).toString() !==
        ydoc.getXmlFragment(YJS_FRAGMENT).toString();

      const ops = diffWords(docText(base), docText(ydoc));
      return { ops, stats: diffStats(ops), changed };
    } catch {
      return null;
    } finally {
      base.destroy();
    }
  }, [synced, ydoc, revision]);

  // A change with no text difference is a formatting or layout edit. Real, and
  // still unsynced, but there's nothing meaningful to render as a word diff.
  const hasTextDiff = pending !== null && (pending.stats.added > 0 || pending.stats.removed > 0);

  const load = useCallback(
    async (notify: boolean) => {
      setRefreshing(true);
      try {
        const res = await fetch(`/api/documents/${documentId}/changes`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { entries: ChangeEntry[]; total: number };
        setEntries(data.entries);
        setTotal(data.total);
      } catch {
        // A background refresh failing is not worth interrupting anyone over —
        // it's usually just the network being offline, which the editor's own
        // status indicator already says. Only speak up when asked directly.
        if (notify) toast("Could not load the synced history.", "error");
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [documentId, toast],
  );

  // Refetch once the panel mounts, and again shortly after each sync — a sync
  // is exactly when pending work turns into synced history.
  const syncedAt = synced?.syncedAt ?? 0;
  useEffect(() => {
    const timer = setTimeout(() => void load(false), syncedAt === 0 ? 0 : REFETCH_DELAY);
    return () => clearTimeout(timer);
  }, [syncedAt, load]);

  return (
    <div className="mt-8 border-t border-line pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-text">Changes</h3>
          <p className="mt-1 text-sm leading-6 text-text-muted">
            What&apos;s reached the server, what hasn&apos;t, and the difference between them.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void load(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {canEdit ? (
        <section className="mt-5" aria-labelledby="pending-heading">
          <div className="flex flex-wrap items-center gap-2">
            <h4 id="pending-heading" className="text-xs font-medium uppercase tracking-wide text-text-subtle">
              Waiting to sync
            </h4>
            {pending?.changed ? <Badge tone="warning">Not on the server yet</Badge> : null}
          </div>

          {!synced ? (
            <p className="mt-3 text-sm text-text-muted">
              Nothing to compare against yet — this document hasn&apos;t synced once since it was
              opened. Reconnect and it&apos;ll fill in.
            </p>
          ) : pending?.changed && !hasTextDiff ? (
            <p className="mt-3 text-sm text-text-muted">
              Formatting changed, but the wording didn&apos;t — there&apos;s no text difference to
              show. It still syncs like any other edit.
            </p>
          ) : pending?.changed ? (
            <div className="mt-3">
              <DiffStat added={pending.stats.added} removed={pending.stats.removed} />

              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                  <h5 className="text-xs font-medium uppercase tracking-wide text-text-subtle">
                    Difference between synced and pending
                  </h5>
                  <DiffLegend />
                </div>
                <div className="mt-2 rounded-xl border border-line bg-surface-muted p-4">
                  <DiffText ops={condenseDiff(pending.ops)} />
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-text-muted">
              Everything you&apos;ve written is on the server
              {synced.syncedAt ? (
                <>
                  {" — last synced "}
                  <TimeAgo iso={new Date(synced.syncedAt).toISOString()} />
                </>
              ) : null}
              .
            </p>
          )}
        </section>
      ) : null}

      <section className="mt-7" aria-labelledby="synced-heading">
        <h4 id="synced-heading" className="text-xs font-medium uppercase tracking-wide text-text-subtle">
          Synced history
        </h4>

        {loading ? (
          <p className="mt-3 text-sm text-text-muted">Loading history…</p>
        ) : entries.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">
            Nothing has synced yet. Once an edit reaches the server it shows up here.
          </p>
        ) : (
          // Capped and scrollable: the log grows without bound, and a long one
          // pushed the rest of the page off the bottom. tabIndex makes the
          // region scrollable by keyboard — without it the overflow is
          // reachable by mouse and touch only.
          <div
            role="group"
            aria-labelledby="synced-heading"
            tabIndex={0}
            className="scroll-region mt-3 max-h-80 overflow-y-auto rounded-xl border border-line px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ul className="divide-y divide-line">
              {entries.map((entry) => (
                <li key={entry.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-text">{entry.authorName}</span>
                    {entry.authorIsGuest ? <Badge>Guest</Badge> : null}
                    <span className="text-xs text-text-subtle">
                      <TimeAgo iso={entry.createdAt} />
                    </span>
                    <span className="ml-auto">
                      <DiffStat added={entry.added} removed={entry.removed} />
                    </span>
                  </div>
                  {entry.addedText || entry.removedText ? (
                    <p className="mt-1.5 truncate text-xs leading-5">
                      {entry.addedText ? (
                        <span className="text-success">{entry.addedText}</span>
                      ) : (
                        <span className="text-danger line-through">{entry.removedText}</span>
                      )}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        {total > entries.length ? (
          <p className="mt-2 text-xs text-text-subtle">
            Showing the {entries.length} most recent of {total}.
          </p>
        ) : null}
      </section>
    </div>
  );
}

// Colour alone can't carry this, so the legend spells out which side of the
// comparison each one means. The two labels are deliberately symmetric: the box
// is one version against another, not a list of things you did.
function DiffLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-subtle">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm border border-success/40 bg-success-soft" aria-hidden />
        in your copy only
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm border border-danger/40 bg-danger-soft" aria-hidden />
        on the server only
      </span>
    </p>
  );
}

function DiffStat({ added, removed }: { added: number; removed: number }) {
  if (added === 0 && removed === 0) {
    return <span className="font-mono text-xs text-text-subtle">no text change</span>;
  }
  return (
    <span className="flex items-center gap-2 font-mono text-xs">
      {added > 0 ? (
        <span className="text-success">
          +{added} <span className="sr-only">words added</span>
        </span>
      ) : null}
      {removed > 0 ? (
        <span className="text-danger">
          −{removed} <span className="sr-only">words removed</span>
        </span>
      ) : null}
    </span>
  );
}

// <ins>/<del> rather than styled spans: the meaning of the colours then comes
// through for anyone reading with assistive tech, not just to people who can
// see green and red.
function DiffText({ ops }: { ops: DiffOp[] }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-muted">
      {ops.map((op, i) => {
        if (op.type === "equal") return <span key={i}>{op.text}</span>;
        if (op.type === "add") {
          return (
            <ins key={i} className="rounded bg-success-soft px-0.5 text-success no-underline">
              {op.text}
            </ins>
          );
        }
        return (
          <del key={i} className="rounded bg-danger-soft px-0.5 text-danger">
            {op.text}
          </del>
        );
      })}
    </p>
  );
}
