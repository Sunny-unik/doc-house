"use server";

import { auth } from "@/auth";
import {
  createDocument,
  deleteDocument,
  renameDocument,
} from "@/db/dal/documents";
import { requireDocRole } from "@/lib/authz";

// Idempotent replay endpoints for the offline outbox. They throw on failure so
// the outbox keeps the op queued and retries; they never redirect (they're
// called programmatically, not from a form).
async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function pushCreate(id: string, title: string) {
  const userId = await requireUserId();
  await createDocument({ id, ownerId: userId, title });
}

export async function pushRename(id: string, title: string) {
  const userId = await requireUserId();
  const access = await requireDocRole(id, userId, ["owner", "editor"]);
  if (!access.ok) throw new Error("Not allowed to rename this document");
  await renameDocument(id, title);
}

export async function pushDelete(id: string) {
  const userId = await requireUserId();
  const access = await requireDocRole(id, userId, ["owner"]);
  if (!access.ok) throw new Error("Only the owner can delete this document");
  await deleteDocument(id);
}
