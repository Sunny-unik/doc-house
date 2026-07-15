"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "error";

type Toast = {
  id: number;
  tone: Tone;
  text: string;
};

type ToastContext = {
  toast: (text: string, tone?: Tone) => void;
};

const Ctx = createContext<ToastContext | null>(null);

const DURATION_MS = 4500;

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((text: string, tone: Tone = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, tone, text }]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Single live region for the whole app: announcements are read in the
          order they arrive instead of each toast fighting for the cursor. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-6"
      >
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

const toneStyles: Record<Tone, string> = {
  info: "border-line bg-surface text-text",
  success: "border-success/30 bg-success-soft text-success",
  error: "border-danger/30 bg-danger-soft text-danger",
};

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg",
        toneStyles[toast.tone],
      )}
    >
      <p className="flex-1 leading-5">{toast.text}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-my-0.5 shrink-0 rounded px-1 text-base leading-none opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ×
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
