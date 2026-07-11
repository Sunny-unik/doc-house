import * as Y from "yjs";
import { auth } from "@/auth";
import { appendDocumentUpdate, getDocumentUpdates } from "@/db/dal/updates";
import { requireDocRole } from "@/lib/authz";
import { base64ToBytes, bytesToBase64 } from "@/lib/sync/codec";
import { SyncRequestSchema } from "@/lib/sync/protocol";
import { bytesEqual, materializeDoc } from "@/lib/sync/yjs-server";

// POST /api/documents/[id]/sync
// One round-trip that both pushes the client's changes and pulls the server's:
//  1. append the client's genuinely-new content to the append-only log
//  2. return the update the client is missing (via its state vector)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Owners/editors may write; viewers may not (full RBAC UI arrives at CP11).
  const access = await requireDocRole(id, session.user.id, ["owner", "editor"]);
  if (!access.ok) {
    return Response.json({ error: "Forbidden" }, { status: access.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SyncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const clientUpdate = base64ToBytes(parsed.data.update);
  const clientStateVector = base64ToBytes(parsed.data.stateVector);

  // Rebuild the canonical doc from the log, then fold in the client's update.
  const rows = await getDocumentUpdates(id);
  const serverDoc = materializeDoc(rows.map((row) => row.update));

  try {
    // Append only what's genuinely new, so the log doesn't grow on no-op syncs.
    const before = Y.encodeStateVector(serverDoc);
    Y.applyUpdate(serverDoc, clientUpdate, "sync");
    const after = Y.encodeStateVector(serverDoc);

    if (!bytesEqual(before, after)) {
      const contribution = Y.encodeStateAsUpdate(serverDoc, before);
      await appendDocumentUpdate(id, contribution, session.user.id);
    }

    // Send back everything the client's state vector says it's missing.
    const diff = Y.encodeStateAsUpdate(serverDoc, clientStateVector);
    return Response.json({ update: bytesToBase64(diff) });
  } finally {
    serverDoc.destroy();
  }
}
