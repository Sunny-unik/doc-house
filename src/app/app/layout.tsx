import Link from "next/link";
import { auth } from "@/auth";
import { OutboxFlusher } from "@/components/offline/OutboxFlusher";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { siteConfig } from "@/config/site";
import { logout } from "@/lib/auth-actions";

// Two initials from a display name, falling back to the email's first letter
// for accounts that somehow have no name set.
function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link
            href="/app"
            className="rounded font-semibold tracking-tight text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            {siteConfig.name}
          </Link>

          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-muted text-xs font-semibold text-text-muted"
            >
              {initials(user?.name, user?.email)}
            </span>
            {/* Decoration next to the avatar — dropped on narrow screens rather
                than letting it squeeze the sign-out button. Guests get their
                display name, since their address is synthetic. */}
            <span className="hidden min-w-0 items-center gap-2 truncate text-sm text-text-muted sm:flex">
              {user?.isGuest ? (
                <>
                  {user.name}
                  <Badge>Guest</Badge>
                </>
              ) : (
                user?.email
              )}
            </span>
            <form action={logout}>
              <Button type="submit" variant="secondary" size="sm">
                {user?.isGuest ? "Leave" : "Sign out"}
              </Button>
            </form>
          </div>
        </div>
      </header>

      {children}
      <OutboxFlusher />
    </div>
  );
}
