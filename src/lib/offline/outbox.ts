import { pushCreate, pushDelete, pushRename } from "@/lib/document-actions";
import { getOfflineDb, type OutboxOp } from "./db";

export async function enqueue(op: OutboxOp) {
  const db = await getOfflineDb();
  await db.add("outbox", op);
}

async function replay(op: OutboxOp) {
  switch (op.type) {
    case "create":
      await pushCreate(op.documentId, op.title ?? "Untitled");
      break;
    case "rename":
      await pushRename(op.documentId, op.title ?? "Untitled");
      break;
    case "delete":
      await pushDelete(op.documentId);
      break;
  }
}

let flushing = false;

// Replay queued mutations to the server in insertion order. Stops at the first
// failure (usually "offline") and leaves the rest queued for the next attempt.
// Replay endpoints are idempotent, so a retry after a partial success is safe.
export async function flushOutbox() {
  if (flushing || typeof navigator === "undefined" || !navigator.onLine) return;
  flushing = true;
  try {
    const db = await getOfflineDb();
    const ops = await db.getAll("outbox");
    for (const op of ops) {
      try {
        await replay(op);
        if (op.seq !== undefined) await db.delete("outbox", op.seq);
      } catch {
        break;
      }
    }
  } finally {
    flushing = false;
  }
}
