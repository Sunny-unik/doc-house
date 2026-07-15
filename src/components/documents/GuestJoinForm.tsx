"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldNote, Input, Label } from "@/components/ui/Input";
import { joinAsGuest } from "@/lib/share-actions";

export function GuestJoinForm({ token, canEdit }: { token: string; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState(joinAsGuest, {});

  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="token" value={token} />
      <Label htmlFor="guest-name">Your display name</Label>
      <Input
        id="guest-name"
        name="name"
        type="text"
        required
        maxLength={60}
        autoComplete="nickname"
        placeholder="e.g. Alex"
        aria-describedby="guest-name-hint"
      />
      <FieldNote>
        <span id="guest-name-hint">
          {canEdit
            ? "Shown to everyone else in the document next to your edits."
            : "Shown to everyone else in the document."}
        </span>
      </FieldNote>

      {state.error ? <FieldNote tone="error">{state.error}</FieldNote> : null}

      <Button type="submit" size="lg" disabled={pending} className="mt-4 w-full">
        {pending ? "Opening…" : canEdit ? "Join and start editing" : "Open document"}
      </Button>
    </form>
  );
}
