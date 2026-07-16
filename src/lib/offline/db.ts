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

// What the server had for one document as of our last successful sync.
export type SyncState = {
  documentId: string;
  // The server's full state, encoded as a Yjs update. Anything in the local
  // Y.Doc that isn't in here is a change still waiting to be pushed.
  baseline: Uint8Array;
  syncedAt: number;
};

// One app-metadata IndexedDB shared by the doc-list cache, the outbox, and the
// per-document sync baseline.
// (Separate from the per-document y-indexeddb stores used by the editor.)
interface DocHouseDB extends DBSchema {
  documents: { key: string; value: CachedDoc };
  outbox: { key: number; value: OutboxOp };
  syncState: { key: string; value: SyncState };
}

let dbPromise: Promise<IDBPDatabase<DocHouseDB>> | null = null;

export function getOfflineDb() {
  if (!dbPromise) {
    // v3 added `syncState`. Every store is created behind an existence check,
    // so an upgrade from any earlier version only adds what's missing and never
    // touches data already there.
    dbPromise = openDB<DocHouseDB>("dochouse", 3, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("documents")) {
          db.createObjectStore("documents", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("outbox")) {
          db.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("syncState")) {
          db.createObjectStore("syncState", { keyPath: "documentId" });
        }
      },
    });
  }
  return dbPromise;
}
