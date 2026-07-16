import * as Y from "yjs";
import { auth } from "@/auth";
import { getMembershipRole } from "@/db/dal/documents";
import { getDocumentUpdateLog } from "@/db/dal/updates";
import { docText } from "@/lib/collab";
import { diffExcerpt, diffStats, diffWords } from "@/lib/diff/text";
import { rateLimit, tooManyRequestsResponse } from "@/lib/security/rate-limit";

// GET /api/documents/[id]/changes
// The synced half of the changes view: what has actually landed on the server,
// newest first, with a description of what each entry changed. The pending half
// never comes from here — by definition the server hasn't seen it.

// How many log entries we describe. The log is append-only and one entry is
// roughly one debounced burst of typing, so a busy document accumulates
// thousands; a reviewer only ever looks at the recent tail.
const HISTORY_LIMIT = 30;

// Replaying the whole log and diffing the tail is comparable work to a single
// sync round-trip, which is already rate-limited at 120/min. This route is
// driven by a panel that refetches on an interval, so it gets its own,
// tighter bucket.
const CHANGES_RATE = { limit: 60, windowMs: 60_000 } as const;

export type ChangeEntry = {
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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`changes:${session.user.id}`, CHANGES_RATE);
  if (!rl.ok) return tooManyRequestsResponse(rl);

  // Read-only, so any member qualifies — viewers included. They can't create
  // history but they're entitled to read it.
  const role = await getMembershipRole(id, session.user.id);
  if (!role) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await getDocumentUpdateLog(id);

  // Replay the log forward one entry at a time, reading the document's text at
  // each step: the diff between consecutive steps is what that entry changed.
  // One pass over the log, not one replay per entry.
  const doc = new Y.Doc({ gc: false });
  const firstShown = Math.max(0, rows.length - HISTORY_LIMIT);
  const entries: ChangeEntry[] = [];
  let previous = "";

  try {
    for (let i = 0; i < rows.length; i++) {
      Y.applyUpdate(doc, rows[i].update, "materialize");

      // Below the window we only need the doc advanced, not read. Text is only
      // extracted from one entry before the window onward — that's the
      // baseline the first visible entry is a diff against.
      if (i < firstShown - 1) continue;

      const text = docText(doc);
      if (i >= firstShown) {
        const ops = diffWords(previous, text);
        const stats = diffStats(ops);
        const row = rows[i];
        entries.push({
          id: row.id.toString(), // bigint — JSON.stringify would throw on it
          createdAt: row.createdAt.toISOString(),
          authorId: row.authorId,
          authorName: row.authorName || row.authorEmail,
          authorIsGuest: row.authorIsGuest,
          added: stats.added,
          removed: stats.removed,
          addedText: diffExcerpt(ops, "add"),
          removedText: diffExcerpt(ops, "remove"),
        });
      }
      previous = text;
    }
  } catch {
    return Response.json({ error: "Could not read this document's history." }, { status: 500 });
  } finally {
    doc.destroy();
  }

  entries.reverse();
  return Response.json({ entries, total: rows.length });
}
