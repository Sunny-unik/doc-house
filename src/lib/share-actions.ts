"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth, signIn } from "@/auth";
import { addDocumentMember } from "@/db/dal/documents";
import { findShareLinkByToken } from "@/db/dal/share-links";
import { isWellFormedToken } from "@/lib/share/token";

export type ShareState = { error?: string };

const joinSchema = z.object({
  token: z.string(),
  name: z.string().trim().min(1, "Enter a display name").max(60, "That name is too long"),
});

/**
 * Redeem a share link as a brand-new guest.
 *
 * The heavy lifting (validating the token, creating the user, granting the
 * membership) happens inside the "guest" provider's authorize callback, so the
 * session can only ever be issued off a token the server itself just checked.
 */
export async function joinAsGuest(_prev: ShareState, formData: FormData): Promise<ShareState> {
  const parsed = joinSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { token, name } = parsed.data;
  if (!isWellFormedToken(token)) return { error: "This link isn't valid." };

  const link = await findShareLinkByToken(token);
  if (!link.ok) return { error: "This link is no longer valid." };

  try {
    // signIn throws a redirect (NEXT_REDIRECT) on success, which propagates out.
    await signIn("guest", { token, name, redirectTo: `/app/${link.documentId}` });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Could not open this document. The link may have just expired." };
    }
    throw error;
  }
}

/**
 * Redeem a share link while already signed in — grant the membership to the
 * existing account rather than minting a throwaway guest.
 */
export async function joinAsCurrentUser(token: string) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/share/${token}`);

  if (!isWellFormedToken(token)) redirect("/app");

  const link = await findShareLinkByToken(token);
  if (!link.ok) redirect("/app");

  // No-ops if they're already a member — an owner following their own link
  // keeps owner rather than being demoted to the link's role.
  await addDocumentMember(link.documentId, session.user.id, link.role);
  redirect(`/app/${link.documentId}`);
}
