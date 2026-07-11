import * as Y from "yjs";

// Rebuild the canonical server document by replaying the append-only update log.
// gc:false keeps deleted content structs around — version history (CP9) needs them.
export function materializeDoc(updates: Uint8Array[]): Y.Doc {
  const doc = new Y.Doc({ gc: false });
  if (updates.length > 0) {
    doc.transact(() => {
      for (const update of updates) {
        Y.applyUpdate(doc, update, "materialize");
      }
    });
  }
  return doc;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
