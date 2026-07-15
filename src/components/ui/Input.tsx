import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// Shared look only — deliberately no width, height, or text size. Those are the
// utilities callers most often need to override, and without tailwind-merge a
// base class always beats a caller's class if it happens to sort later in the
// compiled CSS. Keeping them out means an override can't lose.
const field =
  "rounded-lg border border-line bg-surface px-3 text-text transition-colors outline-none placeholder:text-text-subtle focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-9 w-full text-sm", className)} {...props} />;
}

export function Select({
  className,
  size = "md",
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: "sm" | "md" }) {
  // Width-auto by default: selects sit inline next to other controls far more
  // often than they span a row.
  return (
    <select
      className={cn(field, size === "sm" ? "h-8 text-xs" : "h-9 text-sm", "pr-2", className)}
      {...props}
    />
  );
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
