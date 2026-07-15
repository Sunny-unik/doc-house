import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isGuest: boolean;
    } & DefaultSession["user"];
  }

  // What our `authorize` callbacks return, on top of the framework's defaults.
  interface User {
    isGuest?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isGuest?: boolean;
  }
}
