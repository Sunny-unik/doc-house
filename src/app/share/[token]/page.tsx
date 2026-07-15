import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { GuestJoinForm } from "@/components/documents/GuestJoinForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getDocumentTitle } from "@/db/dal/documents";
import { findShareLinkByToken } from "@/db/dal/share-links";
import { joinAsCurrentUser } from "@/lib/share-actions";
import { isWellFormedToken } from "@/lib/share/token";

// The token in this URL is a bearer credential, so: keep the page out of search
// indexes, and stop the full URL (token and all) leaking through the Referer
// header on any outbound link the visitor clicks from here.
export const metadata: Metadata = {
  title: "Shared document",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Validity depends on revocation and expiry, both of which change under us —
// this page must never be served from a cache.
export const dynamic = "force-dynamic";

const REASONS: Record<string, { title: string; body: string }> = {
  unknown: {
    title: "This link doesn't work",
    body: "It may have been mistyped, or the document may have been deleted. Ask whoever shared it for a new one.",
  },
  revoked: {
    title: "This link was revoked",
    body: "The owner turned it off. Ask them for a fresh link if you still need access.",
  },
  expired: {
    title: "This link has expired",
    body: "Share links can be set to expire. Ask the owner for a new one.",
  },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">{children}</div>
    </main>
  );
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Reject the wrong shape before it reaches the database.
  const lookup = isWellFormedToken(token)
    ? await findShareLinkByToken(token)
    : ({ ok: false, reason: "unknown" } as const);

  if (!lookup.ok) {
    const reason = REASONS[lookup.reason] ?? REASONS.unknown;
    return (
      <Shell>
        <h1 className="text-xl font-semibold tracking-tight text-text">{reason.title}</h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">{reason.body}</p>
        <Link href="/" className="mt-6 block">
          <Button variant="secondary" className="w-full">
            Go to docHouse
          </Button>
        </Link>
      </Shell>
    );
  }

  const [title, session] = await Promise.all([getDocumentTitle(lookup.documentId), auth()]);
  const canEdit = lookup.role === "editor";

  return (
    <Shell>
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-text-subtle">
        Shared document
      </p>
      <h1 className="mt-2 truncate text-xl font-semibold tracking-tight text-text">
        {title ?? "Untitled"}
      </h1>
      <div className="mt-3">
        <Badge tone={canEdit ? "accent" : "neutral"}>{canEdit ? "Can edit" : "Can view"}</Badge>
      </div>

      {session?.user?.id ? (
        <>
          <p className="mt-5 text-sm leading-6 text-text-muted">
            You&rsquo;re signed in as{" "}
            <span className="font-medium text-text">{session.user.email}</span>. Opening this
            link adds the document to your list.
          </p>
          {/* A server action rather than a link: redeeming grants access, which
              is a write, and writes shouldn't happen on a GET. */}
          <form
            action={async () => {
              "use server";
              await joinAsCurrentUser(token);
            }}
            className="mt-5"
          >
            <Button type="submit" size="lg" className="w-full">
              Open document
            </Button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-5 text-sm leading-6 text-text-muted">
            No account needed — pick a name and you&rsquo;re in.
          </p>
          <GuestJoinForm token={token} canEdit={canEdit} />
          <p className="mt-5 text-center text-xs text-text-subtle">
            Already have an account?{" "}
            <Link
              href="/login"
              className="rounded font-medium text-text-muted underline underline-offset-4 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign in first
            </Link>{" "}
            to keep this document in your list.
          </p>
        </>
      )}
    </Shell>
  );
}
