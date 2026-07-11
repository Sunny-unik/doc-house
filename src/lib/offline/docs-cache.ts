import { type CachedDoc, getOfflineDb } from "./db";

export type { CachedDoc };

export async function cacheDocs(docs: CachedDoc[]) {
  const db = await getOfflineDb();
  const tx = db.transaction("documents", "readwrite");
  await Promise.all(docs.map((doc) => tx.store.put(doc)));
  await tx.done;
}

export async function getCachedDocs(): Promise<CachedDoc[]> {
  const db = await getOfflineDb();
  const all = await db.getAll("documents");
  // Most-recently-updated first (ISO strings sort chronologically).
  return all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function removeCachedDoc(id: string) {
  const db = await getOfflineDb();
  await db.delete("documents", id);
}

export async function updateCachedTitle(id: string, title: string) {
  const db = await getOfflineDb();
  const tx = db.transaction("documents", "readwrite");
  const existing = await tx.store.get(id);
  if (existing) {
    await tx.store.put({ ...existing, title, updatedAt: new Date().toISOString() });
  }
  await tx.done;
}
