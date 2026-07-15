import { z } from "zod";
import { auth } from "@/auth";
import { getMembershipRole } from "@/db/dal/documents";
import { createShareLink, listShareLinks } from "@/db/dal/share-links";
import { parseJsonBody } from "@/lib/security/payload";
import { rateLimit, tooManyRequestsResponse } from "@/lib/security/rate-limit";
import { generateShareToken } from "@/lib/share/token";

// GET  /api/documents/[id]/share-links — owner-only; lists live links.
// POST /api/documents/[id]/share-links — owner-only; mints one.
//
// Owner-only on both, including the read: the token *is* the credential, so
// letting an editor list links would silently promote them to "can invite
// anyone", which is a power we only ever gave the owner.

const createSchema = z.object({
  role: z.enum(["editor", "viewer"]),
  // Hours until expiry. Null/omitted = never expires. Capped at a year so a
  // client can't set a date so far out it overflows the column.
  expiresInHours: z.number().int().positive().max(24 * 365).nullable().optional(),
});

// The body is `{ role, expiresInHours }` — under 100 bytes. 4 KB is generous
// headroom and still nothing an attacker can spend.
const MAX_SHARE_BYTES = 4_000;

// Minting is cheap for us but each link is a standing grant, so the ceiling is
// tighter than the general membership one: 20 per minute is far past any real
// owner's pace, and well short of scripting thousands of live tokens.
const SHARE_WRITE_RATE = { limit: 20, windowMs: 60_000 } as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getMembershipRole(id, session.user.id);
  if (role !== "owner") {
    return Response.json({ error: "Only the owner can manage share links" }, { status: 403 });
  }

  return Response.json({ links: await listShareLinks(id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`share:${session.user.id}`, SHARE_WRITE_RATE);
  if (!rl.ok) return tooManyRequestsResponse(rl);

  const role = await getMembershipRole(id, session.user.id);
  if (role !== "owner") {
    return Response.json({ error: "Only the owner can create share links" }, { status: 403 });
  }

  const body = await parseJsonBody(req, { maxBytes: MAX_SHARE_BYTES });
  if (!body.ok) {
    return Response.json({ error: body.error }, { status: body.status });
  }

  const parsed = createSchema.safeParse(body.data);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { role: linkRole, expiresInHours } = parsed.data;
  const expiresAt = expiresInHours
    ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
    : null;

  const link = await createShareLink({
    documentId: id,
    token: generateShareToken(),
    role: linkRole,
    expiresAt,
    createdBy: session.user.id,
  });

  return Response.json({ link }, { status: 201 });
}
