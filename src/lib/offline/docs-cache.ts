import { type DBSchema, type IDBPDatabase, openDB } from "idb";

export type CachedDoc = {
  id: string;
  title: string;
  role: string;
  updatedAt: string;
};

// App-metadata IndexedDB (separate from the per-document y-indexeddb stores).
// Bumped versions will add the offline outbox store in a later step.
interface DocHouseDB extends DBSchema {
  documents: { key: string; value: CachedDoc };
}

let dbPromise: Promise<IDBPDatabase<DocHouseDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<DocHouseDB>("dochouse", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("documents")) {
          db.createObjectStore("documents", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function cacheDocs(docs: CachedDoc[]) {
  const db = await getDb();
  const tx = db.transaction("documents", "readwrite");
  await Promise.all(docs.map((doc) => tx.store.put(doc)));
  await tx.done;
}

export async function getCachedDocs(): Promise<CachedDoc[]> {
  const db = await getDb();
  const all = await db.getAll("documents");
  // Most-recently-updated first (ISO strings sort chronologically).
  return all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}
