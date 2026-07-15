// Joins class names, dropping anything falsy so callers can write
// `cn("base", isActive && "active")` without littering ternaries.
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
