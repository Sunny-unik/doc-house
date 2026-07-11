import { cacheDocs, removeCachedDoc, updateCachedTitle } from "./docs-cache";
import { enqueue, flushOutbox } from "./outbox";

// Each mutation updates the local cache immediately (optimistic), queues the op,
// then flushes. Online the flush reaches the server right away; offline it stays
// queued and the OutboxFlusher replays it on reconnect.

export async function createDocumentOffline(): Promise<string> {
  const id = crypto.randomUUID();
  await cacheDocs([{ id, title: "Untitled", role: "owner", updatedAt: new Date().toISOString() }]);
  await enqueue({ type: "create", documentId: id, title: "Untitled", createdAt: Date.now() });
  await flushOutbox();
  return id;
}

export async function renameDocumentOffline(id: string, title: string) {
  await updateCachedTitle(id, title);
  await enqueue({ type: "rename", documentId: id, title, createdAt: Date.now() });
  await flushOutbox();
}

export async function deleteDocumentOffline(id: string) {
  await removeCachedDoc(id);
  await enqueue({ type: "delete", documentId: id, createdAt: Date.now() });
  await flushOutbox();
}
