import * as Y from "yjs";
import { auth } from "@/auth";
import { getDocumentUpdates } from "@/db/dal/updates";
import { requireDocRole } from "@/lib/authz";
import { listPresent, markPresent } from "@/lib/presence";
import { parseJsonBody } from "@/lib/security/payload";
import { rateLimit, tooManyRequestsResponse } from "@/lib/security/rate-limit";
import { base64ToBytes, bytesToBase64 } from "@/lib/sync/codec";
import { PullRequestSchema } from "@/lib/sync/protocol";
import { materializeDoc } from "@/lib/sync/yjs-server";

// POST /api/documents/[id]/pull
// The read-only half of sync: given the client's state vector, return the update
// it's missing — and never append anything. This is what a viewer polls (the
// sync route is owner/editor-only), and what any client's background refresh
// uses to see collaborators' edits without pushing its own.

// The body is a single state vector — far smaller than a sync envelope, which
// carries the whole document too.
const MAX_PULL_BYTES = 2_000_000;

// Polling runs every ~2.5s (24/min per user). 240/min leaves ~10x headroom
// before a legitimately busy client is throttled. Its own bucket, separate from
// the sync route's.
const PULL_RATE = { limit: 240, windowMs: 60_000 } as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`pull:${session.user.id}`, PULL_RATE);
  if (!rl.ok) return tooManyRequestsResponse(rl);

  // Any member may read, viewers included — reading is exactly what a viewer does.
  const access = await requireDocRole(id, session.user.id, ["owner", "editor", "viewer"]);
  if (!access.ok) {
    return Response.json({ error: "Forbidden" }, { status: access.status });
  }

  const body = await parseJsonBody(req, { maxBytes: MAX_PULL_BYTES });
  if (!body.ok) {
    return Response.json({ error: body.error }, { status: body.status });
  }

  const parsed = PullRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const rows = await getDocumentUpdates(id);
  const serverDoc = materializeDoc(rows.map((row) => row.update));

  try {
    let diff: Uint8Array;
    try {
      // A malformed state vector makes Yjs throw while decoding it; turn that
      // into a 400 rather than letting it become a 500.
      diff = Y.encodeStateAsUpdate(serverDoc, base64ToBytes(parsed.data.stateVector));
    } catch {
      return Response.json({ error: "Invalid state vector" }, { status: 400 });
    }

    markPresent(id, {
      userId: session.user.id,
      name: session.user.name ?? session.user.email ?? "Someone",
      isGuest: session.user.isGuest,
    });

    return Response.json({
      update: bytesToBase64(diff),
      presence: listPresent(id),
    });
  } finally {
    serverDoc.destroy();
  }
}
