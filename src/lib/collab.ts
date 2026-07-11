// Shared Yjs collaboration constants — used by the client editor now, and by
// the server-side document materialization at CP6+. These MUST stay identical
// on both sides or the CRDT state won't line up.

// The Yjs XML fragment Tiptap's Collaboration extension binds to (its default).
export const YJS_FRAGMENT = "default";

// IndexedDB database name for a document's local Y.Doc.
export function localDocKey(documentId: string) {
  return `dochouse-doc-${documentId}`;
}
