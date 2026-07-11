import { type DBSchema, type IDBPDatabase, openDB } from "idb";

export type CachedDoc = {
  id: string;
  title: string;
  role: string;
  updatedAt: string;
};

// A queued mutation to replay to the server when online.
export type OutboxOp = {
  seq?: number; // auto-assigned key (insertion order = replay order)
  type: "create" | "rename" | "delete";
  documentId: string;
  title?: string;
  createdAt: number;
};

// One app-metadata IndexedDB shared by the doc-list cache and the outbox.
// (Separate from the per-document y-indexeddb stores used by the editor.)
interface DocHouseDB extends DBSchema {
  documents: { key: string; value: CachedDoc };
  outbox: { key: number; value: OutboxOp };
}

let dbPromise: Promise<IDBPDatabase<DocHouseDB>> | null = null;

export function getOfflineDb() {
  if (!dbPromise) {
    dbPromise = openDB<DocHouseDB>("dochouse", 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("documents")) {
          db.createObjectStore("documents", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("outbox")) {
          db.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}
