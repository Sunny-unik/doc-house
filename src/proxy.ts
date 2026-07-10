import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// A DB-free NextAuth instance: it only verifies the JWT session cookie, so the
// route guard stays lightweight and never queries the database on navigation.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isProtected = pathname === "/app" || pathname.startsWith("/app/");
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/app", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except API routes, static assets, and image files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
