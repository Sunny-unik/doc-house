"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldNote, Input, Label } from "@/components/ui/Input";
import { login } from "@/lib/auth-actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-text">Welcome back</h1>
      <p className="mt-1.5 text-sm text-text-muted">Sign in to your docHouse account.</p>

      <form action={formAction} className="mt-7 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {state.error ? <FieldNote tone="error">{state.error}</FieldNote> : null}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-muted">
        No account?{" "}
        <Link
          href="/register"
          className="rounded font-medium text-text underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
