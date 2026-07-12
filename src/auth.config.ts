import type { NextAuthConfig } from "next-auth";

// Base config with NO database or Node-only imports, so it can also power the
// lightweight session check in proxy.ts. The Credentials provider (which does
// touch the DB) is added in auth.ts.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  // Auth.js v5 refuses to run behind an unknown host in production. We trust
  // the request host explicitly so `next start` and Vercel both work without
  // needing an AUTH_URL env in every environment.
  trustHost: true,
  callbacks: {
    // Persist the user id and profile fields onto the token at sign-in. We copy
    // email/name explicitly rather than trusting the framework's defaults so a
    // provider change or beta update can't quietly drop them from the session.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        if (user.email) token.email = user.email;
        if (user.name) token.name = user.name;
      }
      return token;
    },
    // Expose id/email/name to the app via the session.
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      if (typeof token.email === "string") session.user.email = token.email;
      if (typeof token.name === "string") session.user.name = token.name;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
