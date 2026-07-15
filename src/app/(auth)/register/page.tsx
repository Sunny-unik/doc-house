"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldNote, Input, Label } from "@/components/ui/Input";
import { register } from "@/lib/auth-actions";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(register, {});

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-text">Create your account</h1>
      <p className="mt-1.5 text-sm text-text-muted">Start writing in docHouse.</p>

      <form action={formAction} className="mt-7 space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" type="text" autoComplete="name" required />
        </div>
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
            autoComplete="new-password"
            required
            minLength={8}
            aria-describedby="password-hint"
          />
          <FieldNote>
            <span id="password-hint">At least 8 characters.</span>
          </FieldNote>
        </div>

        {state.error ? <FieldNote tone="error">{state.error}</FieldNote> : null}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="rounded font-medium text-text underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
