"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./Button";

type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const Ctx = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

/**
 * Drop-in replacement for `window.confirm` that returns the same promise-shaped
 * answer but renders in our own styling. Built on the native <dialog> element,
 * which gives us the focus trap, Esc-to-dismiss, and inert background for free —
 * all the parts a hand-rolled modal usually gets wrong.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pending && !dialog.open) dialog.showModal();
    if (!pending && dialog.open) dialog.close();
  }, [pending]);

  const settle = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  const value = useMemo(() => confirm, [confirm]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="confirm-title"
        // Esc fires `cancel` rather than a button click — resolve false so the
        // caller's promise never dangles.
        onCancel={(e) => {
          e.preventDefault();
          settle(false);
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/60"
      >
        {pending ? (
          <div className="p-5">
            <h2 id="confirm-title" className="text-base font-semibold tracking-tight">
              {pending.title}
            </h2>
            {pending.body ? (
              <p className="mt-2 text-sm leading-6 text-text-muted">{pending.body}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => settle(false)}>
                {pending.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={pending.tone === "danger" ? "danger" : "primary"}
                size="sm"
                autoFocus
                onClick={() => settle(true)}
              >
                {pending.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
