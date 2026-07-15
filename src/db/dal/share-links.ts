import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { type DocRole, shareLinks } from "@/db/schema";

export type ShareLinkRole = Extract<DocRole, "editor" | "viewer">;

// Links a document currently has. Revoked ones are dropped — the row survives
// for auditing, but there's no reason to show the owner a dead link.
export async function listShareLinks(documentId: string) {
  return db
    .select({
      id: shareLinks.id,
      token: shareLinks.token,
      role: shareLinks.role,
      expiresAt: shareLinks.expiresAt,
      createdAt: shareLinks.createdAt,
    })
    .from(shareLinks)
    .where(and(eq(shareLinks.documentId, documentId), isNull(shareLinks.revokedAt)))
    .orderBy(desc(shareLinks.createdAt));
}

export async function createShareLink(input: {
  documentId: string;
  token: string;
  role: ShareLinkRole;
  expiresAt: Date | null;
  createdBy: string;
}) {
  const [row] = await db
    .insert(shareLinks)
    .values(input)
    .returning({
      id: shareLinks.id,
      token: shareLinks.token,
      role: shareLinks.role,
      expiresAt: shareLinks.expiresAt,
      createdAt: shareLinks.createdAt,
    });
  return row;
}

// Scoped by documentId as well as id: without it, knowing a link's uuid would
// be enough to revoke it on a document you don't own.
export async function revokeShareLink(documentId: string, linkId: string) {
  const revoked = await db
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(shareLinks.id, linkId),
        eq(shareLinks.documentId, documentId),
        isNull(shareLinks.revokedAt),
      ),
    )
    .returning({ id: shareLinks.id });
  return revoked.length > 0;
}

export type ShareLinkLookup =
  | { ok: true; documentId: string; role: ShareLinkRole }
  | { ok: false; reason: "unknown" | "revoked" | "expired" };

// Resolve a raw token to the access it grants. Every rejection is spelled out
// so the redemption page can say *why* a link doesn't work rather than a flat
// "invalid link" — the difference between "ask for a new one" and "this expired".
export async function findShareLinkByToken(token: string): Promise<ShareLinkLookup> {
  const [row] = await db
    .select({
      documentId: shareLinks.documentId,
      role: shareLinks.role,
      expiresAt: shareLinks.expiresAt,
      revokedAt: shareLinks.revokedAt,
    })
    .from(shareLinks)
    .where(eq(shareLinks.token, token))
    .limit(1);

  if (!row) return { ok: false, reason: "unknown" };
  if (row.revokedAt) return { ok: false, reason: "revoked" };
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return {
    ok: true,
    documentId: row.documentId,
    role: row.role as ShareLinkRole,
  };
}
