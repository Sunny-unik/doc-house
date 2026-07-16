import * as Y from "yjs";
import { auth } from "@/auth";
import { appendDocumentUpdate, getDocumentUpdates } from "@/db/dal/updates";
import { requireDocRole } from "@/lib/authz";
import { parseJsonBody } from "@/lib/security/payload";
import { rateLimit, tooManyRequestsResponse } from "@/lib/security/rate-limit";
import { base64ToBytes, bytesToBase64 } from "@/lib/sync/codec";
import { SyncRequestSchema } from "@/lib/sync/protocol";
import { materializeDoc } from "@/lib/sync/yjs-server";

// POST /api/documents/[id]/sync
// One round-trip that both pushes the client's changes and pulls the server's:
//  1. append the client's genuinely-new content to the append-only log
//  2. return the update the client is missing (via its state vector)

// Body-size cap on the request envelope (JSON wrapper + both base64 fields).
// - 4 MB is 2x the sum of the two 1.5 MB base64 caps in SyncRequestSchema,
//   giving comfortable headroom for JSON braces, key names, and future fields.
// - Enforced by parseJsonBody as a bounded stream, so a client that lies about
//   Content-Length or streams chunked can't force us to buffer past 4 MB into
//   memory — we abort mid-stream and return 413.
const MAX_SYNC_BYTES = 4_000_000;

// Per-user sync rate limit.
// - The editor debounces bursts of typing to about 1 sync per second.
// - 120 requests per 60-second sliding window leaves ~2x headroom over that
//   organic ceiling before a legitimately fast collaborator is throttled.
// - Bucket key is `sync:<userId>` — one bucket per user, shared across all
//   documents they're editing (rare edge case; keeps the store small).
const SYNC_RATE = { limit: 120, windowMs: 60_000 } as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`sync:${session.user.id}`, SYNC_RATE);
  if (!rl.ok) return tooManyRequestsResponse(rl);

  // Owners/editors may write; viewers may not.
  const access = await requireDocRole(id, session.user.id, ["owner", "editor"]);
  if (!access.ok) {
    return Response.json({ error: "Forbidden" }, { status: access.status });
  }

  const body = await parseJsonBody(req, { maxBytes: MAX_SYNC_BYTES });
  if (!body.ok) {
    return Response.json({ error: body.error }, { status: body.status });
  }

  const parsed = SyncRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  let clientUpdate: Uint8Array;
  let clientStateVector: Uint8Array;
  try {
    clientUpdate = base64ToBytes(parsed.data.update);
    clientStateVector = base64ToBytes(parsed.data.stateVector);
  } catch {
    return Response.json({ error: "Payload is not valid base64" }, { status: 400 });
  }

  // Rebuild the canonical doc from the log, then fold in the client's update.
  const rows = await getDocumentUpdates(id);
  const serverDoc = materializeDoc(rows.map((row) => row.update));

  try {
    const beforeVector = Y.encodeStateVector(serverDoc);
    const beforeSnapshot = Y.snapshot(serverDoc);
    try {
      // Yjs throws on malformed binary. Convert that into a 400 so a bad actor
      // can't force the route into a 500 path.
      Y.applyUpdate(serverDoc, clientUpdate, "sync");
    } catch {
      return Response.json({ error: "Malformed Yjs update" }, { status: 400 });
    }

    // Compare snapshots, not state vectors. A deletion creates no new structs,
    // so the author's clock never advances and the vector comes back identical
    // — meaning a pure delete looks like "nothing changed", never gets appended,
    // and reappears the moment the doc is rebuilt from the log. A snapshot
    // carries the delete set alongside the vector, so it sees removals too.
    if (!Y.equalSnapshots(beforeSnapshot, Y.snapshot(serverDoc))) {
      const contribution = Y.encodeStateAsUpdate(serverDoc, beforeVector);
      await appendDocumentUpdate(id, contribution, session.user.id);
    }

    const diff = Y.encodeStateAsUpdate(serverDoc, clientStateVector);
    return Response.json({ update: bytesToBase64(diff) });
  } finally {
    serverDoc.destroy();
  }
}
