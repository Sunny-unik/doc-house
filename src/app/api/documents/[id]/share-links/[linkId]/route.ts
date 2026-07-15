import { auth } from "@/auth";
import { getMembershipRole } from "@/db/dal/documents";
import { revokeShareLink } from "@/db/dal/share-links";
import { rateLimit, tooManyRequestsResponse } from "@/lib/security/rate-limit";

// DELETE /api/documents/[id]/share-links/[linkId] — owner-only; revokes a link.
// Shares the `share:<userId>` rate bucket with POST so scripting create+revoke
// can't sidestep the minting ceiling.
const SHARE_WRITE_RATE = { limit: 20, windowMs: 60_000 } as const;

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  const { id, linkId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`share:${session.user.id}`, SHARE_WRITE_RATE);
  if (!rl.ok) return tooManyRequestsResponse(rl);

  const role = await getMembershipRole(id, session.user.id);
  if (role !== "owner") {
    return Response.json({ error: "Only the owner can revoke share links" }, { status: 403 });
  }

  const revoked = await revokeShareLink(id, linkId);
  if (!revoked) {
    return Response.json({ error: "Link not found or already revoked" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
