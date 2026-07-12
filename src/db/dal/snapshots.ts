import { and, desc, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { documentUpdates, users, versionSnapshots } from "@/db/schema";

// `upToUpdateId` records the log cursor at snapshot time. We don't use it for
// materialization today (the client sends the full state), but it makes the
// snapshot self-describing: given any snapshot row, you know exactly which
// prefix of the log it represents. That opens the door to a proper "revert"
// implementation later without another schema change.
export async function createSnapshot(input: {
  documentId: string;
  snapshot: Uint8Array;
  label: string;
  createdBy: string;
}) {
  const [maxRow] = await db
    .select({ maxId: max(documentUpdates.id) })
    .from(documentUpdates)
    .where(eq(documentUpdates.documentId, input.documentId));
  const upToUpdateId = maxRow?.maxId ?? BigInt(0);

  const [row] = await db
    .insert(versionSnapshots)
    .values({
      documentId: input.documentId,
      snapshot: input.snapshot,
      label: input.label,
      createdBy: input.createdBy,
      upToUpdateId,
    })
    .returning({
      id: versionSnapshots.id,
      createdAt: versionSnapshots.createdAt,
    });
  return row;
}

export async function listSnapshots(documentId: string) {
  return db
    .select({
      id: versionSnapshots.id,
      label: versionSnapshots.label,
      createdAt: versionSnapshots.createdAt,
      createdById: users.id,
      createdByName: users.name,
      createdByEmail: users.email,
    })
    .from(versionSnapshots)
    .innerJoin(users, eq(users.id, versionSnapshots.createdBy))
    .where(eq(versionSnapshots.documentId, documentId))
    .orderBy(desc(versionSnapshots.createdAt));
}

export async function getSnapshotState(documentId: string, snapshotId: string) {
  const [row] = await db
    .select({ snapshot: versionSnapshots.snapshot })
    .from(versionSnapshots)
    .where(
      and(
        eq(versionSnapshots.id, snapshotId),
        eq(versionSnapshots.documentId, documentId),
      ),
    )
    .limit(1);
  return row?.snapshot ?? null;
}
