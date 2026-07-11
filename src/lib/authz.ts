import { getMembershipRole } from "@/db/dal/documents";
import type { DocRole } from "@/db/schema";

type AccessResult =
  | { ok: true; role: DocRole }
  | { ok: false; status: 403 | 404 };

// Central document authorization. Role is read from the DB, never trusted from
// the client. Non-members get 404 (don't reveal the doc exists); members without
// a permitted role get 403.
export async function requireDocRole(
  documentId: string,
  userId: string,
  allowed: DocRole[],
): Promise<AccessResult> {
  const role = await getMembershipRole(documentId, userId);
  if (!role) return { ok: false, status: 404 };
  if (!allowed.includes(role)) return { ok: false, status: 403 };
  return { ok: true, role };
}
