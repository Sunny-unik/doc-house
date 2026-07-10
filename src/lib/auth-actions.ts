"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { createUser, getUserByEmail } from "@/db/dal/users";
import { hashPassword } from "@/lib/crypto";

export type AuthState = { error?: string };

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { name, email, password } = parsed.data;
  if (await getUserByEmail(email)) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await hashPassword(password);
  await createUser({ name, email, passwordHash });

  // signIn throws a redirect (NEXT_REDIRECT) on success, which propagates out.
  await signIn("credentials", { email, password, redirectTo: "/app" });
  return {};
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirectTo: "/app" });
    return {};
  } catch (error) {
    // AuthError = bad credentials; anything else (e.g. the success redirect) rethrows.
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
