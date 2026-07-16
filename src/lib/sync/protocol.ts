import { z } from "zod";

// Per-field cap on the base64-encoded Yjs payload.
// - 1_500_000 chars of base64 ≈ 1.1 MB of raw binary.
// - A legitimate document at that size would already be a huge outlier
//   (roughly a novel's worth of collaborative edit history), so the ceiling
//   is generous for real users but hard-blocks anything trying to blow up
//   the process by shipping tens of MB.
// - Enforced by Zod, so a client that lies about the field lengths fails at
//   schema parse before we ever touch the base64 decoder.
const MAX_BASE64 = 1_500_000;

export const SyncRequestSchema = z.object({
  // The client's Yjs update (its whole state) and its state vector, base64-encoded.
  update: z.string().max(MAX_BASE64),
  stateVector: z.string().max(MAX_BASE64),
});

export type SyncRequest = z.infer<typeof SyncRequestSchema>;

// A viewer (or a background poll) pulling the server's changes without pushing
// any of its own — just the state vector, so the server can answer with a diff.
export const PullRequestSchema = z.object({
  stateVector: z.string().max(MAX_BASE64),
});

export type PullRequest = z.infer<typeof PullRequestSchema>;

// One collaborator currently in the document. Defined here (client-safe) so both
// the API and the UI can share it without pulling in the server-only store.
export type PresenceUser = {
  userId: string;
  name: string;
  isGuest: boolean;
  color: string;
};

// Both endpoints return the update the client is missing (base64) plus who else
// is here right now.
export type SyncResponse = { update: string; presence: PresenceUser[] };
export type PullResponse = SyncResponse;
