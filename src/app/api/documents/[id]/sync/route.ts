import * as Y from "yjs";
import { auth } from "@/auth";
import { appendDocumentUpdate, getDocumentUpdates } from "@/db/dal/updates";
import { requireDocRole } from "@/lib/authz";
import { parseJsonBody } from "@/lib/security/payload";
import { rateLimit, tooManyRequestsResponse } from "@/lib/security/rate-limit";
import { base64ToBytes, bytesToBase64 } from "@/lib/sync/codec";
import { SyncRequestSchema } from "@/lib/sync/protocol";
import { bytesEqual, materializeDoc } from "@/lib/sync/yjs-server";

// POST /api/documents/[id]/sync
// One round-trip that both pushes the client's changes and pulls the server's:
//  1. append the client's genuinely-new content to the append-only log
//  2. return the update the client is missing (via its state vector)

// A Yjs update that legitimately reaches ~1 MB binary would already be an
// extreme outlier; 1.5 MB base64 ≈ 1.1 MB binary is a comfortable ceiling.
// Envelope headroom is added on top so a JSON wrapper never trips us up.
const MAX_SYNC_BYTES = 4_000_000;

// Aggressive local typing debounces to ~1 sync/sec. 120/min per user leaves a
// 2x safety factor before a real collaborator gets hit.
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
    const before = Y.encodeStateVector(serverDoc);
    try {
      // Yjs throws on malformed binary. Convert that into a 400 so a bad actor
      // can't force the route into a 500 path.
      Y.applyUpdate(serverDoc, clientUpdate, "sync");
    } catch {
      return Response.json({ error: "Malformed Yjs update" }, { status: 400 });
    }
    const after = Y.encodeStateVector(serverDoc);

    if (!bytesEqual(before, after)) {
      const contribution = Y.encodeStateAsUpdate(serverDoc, before);
      await appendDocumentUpdate(id, contribution, session.user.id);
    }

    const diff = Y.encodeStateAsUpdate(serverDoc, clientStateVector);
    return Response.json({ update: bytesToBase64(diff) });
  } finally {
    serverDoc.destroy();
  }
}
