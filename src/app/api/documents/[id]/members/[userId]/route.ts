import { z } from "zod";
import { auth } from "@/auth";
import {
  getMembershipRole,
  removeDocumentMember,
  updateMemberRole,
} from "@/db/dal/documents";

// PATCH — owner only; change a member's role between editor and viewer.
// DELETE — owner can remove anyone (except themselves), or a member can remove
// themselves. Owner leaving their own doc is blocked so ownership can't be
// silently orphaned.

const roleSchema = z.object({ role: z.enum(["editor", "viewer"]) });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const callerRole = await getMembershipRole(id, session.user.id);
  if (callerRole !== "owner") {
    return Response.json({ error: "Only the owner can change roles" }, { status: 403 });
  }

  const targetRole = await getMembershipRole(id, userId);
  if (!targetRole) {
    return Response.json({ error: "Member not found" }, { status: 404 });
  }
  if (targetRole === "owner") {
    return Response.json({ error: "Cannot change the owner's role" }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  await updateMemberRole(id, userId, parsed.data.role);
  return Response.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const callerRole = await getMembershipRole(id, session.user.id);
  if (!callerRole) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const isSelf = userId === session.user.id;
  const isOwnerActing = callerRole === "owner";
  if (!isSelf && !isOwnerActing) {
    return Response.json({ error: "Only the owner can remove others" }, { status: 403 });
  }

  const targetRole = await getMembershipRole(id, userId);
  if (!targetRole) {
    return Response.json({ error: "Member not found" }, { status: 404 });
  }
  if (targetRole === "owner") {
    return Response.json(
      { error: "The owner can't leave without transferring the document first." },
      { status: 409 },
    );
  }

  await removeDocumentMember(id, userId);
  return Response.json({ ok: true });
}
