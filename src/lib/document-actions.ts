"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createDocument as createDocumentInDb } from "@/db/dal/documents";

export async function createDocument() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const id = await createDocumentInDb({ ownerId: session.user.id });
  redirect(`/app/${id}`);
}
