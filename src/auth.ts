import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { addDocumentMember } from "@/db/dal/documents";
import { findShareLinkByToken } from "@/db/dal/share-links";
import { createGuestUser, getUserByEmail } from "@/db/dal/users";
import { verifyPassword } from "@/lib/crypto";
import { isWellFormedToken } from "@/lib/share/token";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const guestSchema = z.object({
  token: z.string(),
  name: z.string().trim().min(1).max(60),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await getUserByEmail(email);
        if (!user) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, name: user.name, email: user.email, isGuest: user.isGuest };
      },
    }),

    // Sign-in by redeeming a share link. The only thing the client supplies is
    // the token and a display name — the token is re-validated here, server
    // side, on every attempt. Nothing about the resulting session (which
    // document, which role) is taken from the caller's word.
    Credentials({
      id: "guest",
      name: "Guest link",
      credentials: { token: {}, name: {} },
      async authorize(raw) {
        const parsed = guestSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { token, name } = parsed.data;
        // Cheap shape check before touching the database.
        if (!isWellFormedToken(token)) return null;

        const link = await findShareLinkByToken(token);
        if (!link.ok) return null;

        // Mint the identity and the membership together. The role comes from the
        // link row, never from the request.
        const guest = await createGuestUser(name);
        await addDocumentMember(link.documentId, guest.id, link.role);

        return { id: guest.id, name: guest.name, email: guest.email, isGuest: true };
      },
    }),
  ],
});
