import { z } from "zod";
import { auth } from "@/auth";
import { getMembershipRole } from "@/db/dal/documents";
import { createSnapshot, listSnapshots } from "@/db/dal/snapshots";
import { parseJsonBody } from "@/lib/security/payload";
import { rateLimit, tooManyRequestsResponse } from "@/lib/security/rate-limit";
import { base64ToBytes } from "@/lib/sync/codec";

// GET /api/documents/[id]/versions   — any member lists past versions.
// POST /api/documents/[id]/versions  — owners/editors capture a new snapshot.

// A snapshot is a full Yjs state, so the ceiling matches the sync route.
const MAX_SNAPSHOT_BYTES = 4_000_000;
const SNAPSHOT_RATE = { limit: 30, windowMs: 60_000 } as const;

const createSchema = z.object({
  label: z.string().trim().min(1).max(200),
  // Base64 headroom: raw cap × 4/3 with a little slack.
  snapshot: z.string().max(6_000_000),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getMembershipRole(id, session.user.id);
  if (!role) return Response.json({ error: "Forbidden" }, { status: 403 });

  const versions = await listSnapshots(id);
  return Response.json({ versions });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`snap:${session.user.id}`, SNAPSHOT_RATE);
  if (!rl.ok) return tooManyRequestsResponse(rl);

  const role = await getMembershipRole(id, session.user.id);
  if (role !== "owner" && role !== "editor") {
    return Response.json({ error: "Viewers can't save versions" }, { status: 403 });
  }

  const body = await parseJsonBody(req, { maxBytes: MAX_SNAPSHOT_BYTES });
  if (!body.ok) return Response.json({ error: body.error }, { status: body.status });

  const parsed = createSchema.safeParse(body.data);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  let snapshot: Uint8Array;
  try {
    snapshot = base64ToBytes(parsed.data.snapshot);
  } catch {
    return Response.json({ error: "Payload is not valid base64" }, { status: 400 });
  }

  const row = await createSnapshot({
    documentId: id,
    snapshot,
    label: parsed.data.label,
    createdBy: session.user.id,
  });

  return Response.json({
    version: {
      id: row.id,
      label: parsed.data.label,
      createdAt: row.createdAt,
      createdById: session.user.id,
      createdByName: session.user.name ?? "",
      createdByEmail: session.user.email ?? "",
    },
  });
}
