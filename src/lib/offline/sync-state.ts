import { getOfflineDb, type SyncState } from "./db";

export type { SyncState };

export async function getSyncState(documentId: string): Promise<SyncState | null> {
  const db = await getOfflineDb();
  return (await db.get("syncState", documentId)) ?? null;
}

export async function putSyncState(documentId: string, baseline: Uint8Array, syncedAt: number) {
  const db = await getOfflineDb();
  await db.put("syncState", { documentId, baseline, syncedAt });
}

export async function clearSyncState(documentId: string) {
  const db = await getOfflineDb();
  await db.delete("syncState", documentId);
}
