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

// Membership payloads are tiny (an email + a role); 4 KB is generous headroom.
const MAX_MEMBER_BYTES = 4_000;
// Owners generally invite in bursts — 30/min is comfortable interactive use.
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
      role: parsed.data.role,
    },
  });
}
