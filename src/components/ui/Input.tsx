import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const field =
  "w-full rounded-lg border border-line bg-surface px-3 text-sm text-text transition-colors outline-none placeholder:text-text-subtle focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-9", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, "h-9 pr-2", className)} {...props} />;
}

export function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-text">
      {children}
    </label>
  );
}

// Inline validation / hint text under a field. `tone="error"` also carries the
// alert role so screen readers announce it without needing a live region.
export function FieldNote({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "mt-1.5 text-xs",
        tone === "error" ? "text-danger" : "text-text-subtle",
      )}
    >
      {children}
    </p>
  );
}
