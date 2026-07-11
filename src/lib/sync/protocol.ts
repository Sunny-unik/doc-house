import { z } from "zod";

// Cap payload sizes so a malicious client can't force huge allocations. This is
// a first guard; full hardening (content-length checks, update validation) is CP12.
const MAX_BASE64 = 1_500_000; // ~1.1 MB of binary

export const SyncRequestSchema = z.object({
  // The client's Yjs update (its whole state) and its state vector, base64-encoded.
  update: z.string().max(MAX_BASE64),
  stateVector: z.string().max(MAX_BASE64),
});

export type SyncRequest = z.infer<typeof SyncRequestSchema>;

// The server returns the update the client is missing (base64).
export type SyncResponse = { update: string };
