import * as Y from "yjs";
import { auth } from "@/auth";
import { getMembershipRole } from "@/db/dal/documents";
import { getDocumentUpdates } from "@/db/dal/updates";
import { bytesToBase64 } from "@/lib/sync/codec";
import { materializeDoc } from "@/lib/sync/yjs-server";

// GET /api/documents/[id]/snapshot
// Read-only companion to the sync route: any member (including viewers) can
// pull the current server state. Used to warm a client's IndexedDB so the doc
// opens instantly and works offline.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getMembershipRole(id, session.user.id);
  if (!role) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await getDocumentUpdates(id);
  const doc = materializeDoc(rows.map((r) => r.update));
  const update = Y.encodeStateAsUpdate(doc);
  return Response.json({ update: bytesToBase64(update) });
}
