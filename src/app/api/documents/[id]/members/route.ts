import { z } from "zod";
import { auth } from "@/auth";
import {
  addDocumentMember,
  getMembershipRole,
  listDocumentMembers,
} from "@/db/dal/documents";
import { getUserByEmail } from "@/db/dal/users";

// GET /api/documents/[id]/members — any member can list.
// POST /api/documents/[id]/members — owner-only; invites an existing user by email.

const inviteSchema = z.object({
  email: z.email().max(254),
  role: z.enum(["editor", "viewer"]),
});

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

  const role = await getMembershipRole(id, session.user.id);
  if (role !== "owner") {
    return Response.json({ error: "Only the owner can invite" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = inviteSchema.safeParse(body);
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
