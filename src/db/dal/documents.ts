import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { documentMemberships, documents } from "@/db/schema";

// Every read goes through a membership join, so a user can only ever see
// documents they belong to — tenant isolation is enforced here, not in routes.

export async function listDocumentsForUser(userId: string) {
  return db
    .select({
      id: documents.id,
      title: documents.title,
      role: documentMemberships.role,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .innerJoin(documentMemberships, eq(documentMemberships.documentId, documents.id))
    .where(eq(documentMemberships.userId, userId))
    .orderBy(desc(documents.updatedAt));
}

// Lightweight role lookup for API authorization — just the caller's role, or null.
export async function getMembershipRole(documentId: string, userId: string) {
  const [row] = await db
    .select({ role: documentMemberships.role })
    .from(documentMemberships)
    .where(and(eq(documentMemberships.documentId, documentId), eq(documentMemberships.userId, userId)))
    .limit(1);
  return row?.role ?? null;
}

// Returns the document + the caller's role, or null if they aren't a member.
export async function getDocumentForUser(documentId: string, userId: string) {
  const [row] = await db
    .select({
      id: documents.id,
      title: documents.title,
      ownerId: documents.ownerId,
      role: documentMemberships.role,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .innerJoin(documentMemberships, eq(documentMemberships.documentId, documents.id))
    .where(and(eq(documents.id, documentId), eq(documentMemberships.userId, userId)))
    .limit(1);

  return row ?? null;
}

export async function renameDocument(documentId: string, title: string) {
  await db
    .update(documents)
    .set({ title: title.trim() || "Untitled", updatedAt: sql`now()` })
    .where(eq(documents.id, documentId));
}

// FK cascades remove memberships, updates, and snapshots with the document.
export async function deleteDocument(documentId: string) {
  await db.delete(documents).where(eq(documents.id, documentId));
}

// Create a document and its owner membership atomically. We pre-generate the id
// so both inserts can go in one batch (Neon runs a batch as a transaction);
// the neon-http driver has no interactive transactions.
export async function createDocument(input: { ownerId: string; title?: string }) {
  const id = randomUUID();

  await db.batch([
    db.insert(documents).values({
      id,
      ownerId: input.ownerId,
      title: input.title?.trim() || "Untitled",
    }),
    db.insert(documentMemberships).values({
      documentId: id,
      userId: input.ownerId,
      role: "owner",
    }),
  ]);

  return id;
}
