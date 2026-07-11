import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentUpdates } from "@/db/schema";

// Read the append-only log in insertion order (id is a bigint identity = total order).
export async function getDocumentUpdates(documentId: string) {
  return db
    .select({ id: documentUpdates.id, update: documentUpdates.update })
    .from(documentUpdates)
    .where(eq(documentUpdates.documentId, documentId))
    .orderBy(asc(documentUpdates.id));
}

// Append a new update. The log is never mutated in place — only appended to.
export async function appendDocumentUpdate(
  documentId: string,
  update: Uint8Array,
  createdBy: string,
) {
  await db.insert(documentUpdates).values({ documentId, update, createdBy });
}
