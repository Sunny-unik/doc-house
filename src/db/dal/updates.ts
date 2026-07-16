import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentUpdates, users } from "@/db/schema";

// Read the append-only log in insertion order (id is a bigint identity = total order).
export async function getDocumentUpdates(documentId: string) {
  return db
    .select({ id: documentUpdates.id, update: documentUpdates.update })
    .from(documentUpdates)
    .where(eq(documentUpdates.documentId, documentId))
    .orderBy(asc(documentUpdates.id));
}

// The same log, with the author of each entry attached.
//
// Returns every row rather than just the page being shown, because describing
// *what* an update changed means replaying the document up to it — the entries
// before the visible window are what the visible ones are a diff against.
export async function getDocumentUpdateLog(documentId: string) {
  return db
    .select({
      id: documentUpdates.id,
      update: documentUpdates.update,
      createdAt: documentUpdates.createdAt,
      authorId: users.id,
      authorName: users.name,
      authorEmail: users.email,
      authorIsGuest: users.isGuest,
    })
    .from(documentUpdates)
    .innerJoin(users, eq(users.id, documentUpdates.createdBy))
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
