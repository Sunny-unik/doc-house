import type { NextAuthConfig } from "next-auth";

// Base config with NO database or Node-only imports, so it can also power the
// lightweight session check in proxy.ts. The Credentials provider (which does
// touch the DB) is added in auth.ts.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    // Persist the user id onto the token at sign-in.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    // Expose the user id to the app via the session.
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
