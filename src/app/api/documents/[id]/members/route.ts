import { z } from "zod";
import { auth } from "@/auth";
import {
  addDocumentMember,
  getMembershipRole,
  listDocumentMembers,
} from "@/db/dal/documents";
import { getUserByEmail } from "@/db/dal/users";
import { parseJsonBody } from "@/lib/security/payload";
import { rateLimit, tooManyRequestsResponse } from "@/lib/security/rate-limit";

// GET /api/documents/[id]/members — any member can list.
// POST /api/documents/[id]/members — owner-only; invites an existing user by email.

const inviteSchema = z.object({
  email: z.email().max(254),
  role: z.enum(["editor", "viewer"]),
});

// Body-size cap on the invite payload.
// - The actual body is just `{ email, role }` — under 300 bytes even with
//   long emails. 4 KB gives 10x headroom without opening the door to abuse.
// - A larger cap would only ever help an attacker, since there's nothing
//   legitimate to spend it on.
const MAX_MEMBER_BYTES = 4_000;

// Per-user rate limit on membership writes (invite / role change / remove).
// - 30 per 60-second sliding window comfortably supports an owner
//   onboarding a class of ~30 students in one burst.
// - Same bucket key `members:<userId>` is shared across POST, PATCH, and
//   DELETE so scripting the whole flow can't sidestep the ceiling.
const MEMBER_WRITE_RATE = { limit: 30, windowMs: 60_000 } as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getMembershipRole(id, session.user.id);
  if (!role) return Response.json({ error: "Forbidden" }, { status: 403 });

  const members = await listDocumentMembers(id);
  return Response.json({ members });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`members:${session.user.id}`, MEMBER_WRITE_RATE);
  if (!rl.ok) return tooManyRequestsResponse(rl);

  const role = await getMembershipRole(id, session.user.id);
  if (role !== "owner") {
    return Response.json({ error: "Only the owner can invite" }, { status: 403 });
  }

  const body = await parseJsonBody(req, { maxBytes: MAX_MEMBER_BYTES });
  if (!body.ok) {
    return Response.json({ error: body.error }, { status: body.status });
  }

  const parsed = inviteSchema.safeParse(body.data);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const target = await getUserByEmail(parsed.data.email.toLowerCase());
  if (!target) {
    return Response.json(
      { error: "No user with that email has signed up yet." },
      { status: 404 },
    );
  }

  if (target.id === session.user.id) {
    return Response.json({ error: "You already own this document." }, { status: 409 });
  }

  const inserted = await addDocumentMember(id, target.id, parsed.data.role);
  if (!inserted) {
    return Response.json(
      { error: "That user already has access to this document." },
      { status: 409 },
    );
  }

  return Response.json({
    member: {
      userId: target.id,
      email: target.email,
      name: target.name,
      isGuest: target.isGuest,
      role: parsed.data.role,
    },
  });
}
