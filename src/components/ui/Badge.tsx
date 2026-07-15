import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "danger" | "warning" | "accent";

const tones: Record<Tone, string> = {
  neutral: "border-line bg-surface-muted text-text-muted",
  success: "border-success/30 bg-success-soft text-success",
  danger: "border-danger/30 bg-danger-soft text-danger",
  warning: "border-warning/30 bg-warning-soft text-warning",
  accent: "border-line-strong bg-surface-muted text-text",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// A small coloured dot — used on its own for status rows where a full badge
// would be too heavy (e.g. the editor's sync indicator).
export function Dot({ className }: { className?: string }) {
  return <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", className)} aria-hidden />;
}
