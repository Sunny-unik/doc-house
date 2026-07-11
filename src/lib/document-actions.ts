"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createDocument as createDocumentInDb,
  deleteDocument as deleteDocumentInDb,
  renameDocument as renameDocumentInDb,
} from "@/db/dal/documents";
import { requireDocRole } from "@/lib/authz";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export async function createDocument() {
  const userId = await requireUserId();
  const id = await createDocumentInDb({ ownerId: userId });
  redirect(`/app/${id}`);
}

export async function renameDocument(id: string, title: string) {
  const userId = await requireUserId();
  const access = await requireDocRole(id, userId, ["owner", "editor"]);
  if (!access.ok) throw new Error("Not allowed to rename this document");

  await renameDocumentInDb(id, title);
  revalidatePath("/app");
  revalidatePath(`/app/${id}`);
}

export async function deleteDocument(id: string) {
  const userId = await requireUserId();
  // Only the owner can delete a document.
  const access = await requireDocRole(id, userId, ["owner"]);
  if (!access.ok) throw new Error("Only the owner can delete this document");

  await deleteDocumentInDb(id);
  revalidatePath("/app");
  redirect("/app");
}
