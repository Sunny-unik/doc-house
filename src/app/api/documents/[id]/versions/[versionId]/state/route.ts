import { auth } from "@/auth";
import { getMembershipRole } from "@/db/dal/documents";
import { getSnapshotState } from "@/db/dal/snapshots";
import { bytesToBase64 } from "@/lib/sync/codec";

// GET /api/documents/[id]/versions/[versionId]/state
// Returns the raw Yjs bytes for one snapshot (base64), so the client can
// materialize it locally for preview or restore. Any member may read.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { id, versionId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getMembershipRole(id, session.user.id);
  if (!role) return Response.json({ error: "Forbidden" }, { status: 403 });

  const state = await getSnapshotState(id, versionId);
  if (!state) return Response.json({ error: "Version not found" }, { status: 404 });

  return Response.json({ state: bytesToBase64(state) });
}
