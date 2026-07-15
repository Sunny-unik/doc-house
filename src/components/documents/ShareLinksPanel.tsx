"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Input";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { useToast } from "@/components/ui/Toast";

type ShareLink = {
  id: string;
  token: string;
  role: "editor" | "viewer";
  expiresAt: string | null;
  createdAt: string;
};

// Value "never" is the sentinel for a link with no expiry.
const EXPIRY_OPTIONS = [
  { value: "24", label: "Expires in 24 hours" },
  { value: "168", label: "Expires in 7 days" },
  { value: "720", label: "Expires in 30 days" },
  { value: "never", label: "Never expires" },
] as const;

export function ShareLinksPanel({ documentId }: { documentId: string }) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [expiry, setExpiry] = useState<string>("168");
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/share-links`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { links: ShareLink[] };
        if (!cancelled) setLinks(data.links);
      } catch {
        if (!cancelled) toast("Could not load share links.", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // Built in the browser so the link always carries whatever origin the owner is
  // actually on — localhost while developing, the real domain in production —
  // without threading a base URL through config.
  const urlFor = (token: string) =>
    typeof window === "undefined" ? "" : `${window.location.origin}/share/${token}`;

  function create() {
    startTransition(async () => {
      const res = await fetch(`/api/documents/${documentId}/share-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          expiresInHours: expiry === "never" ? null : Number(expiry),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error ?? "Could not create link.", "error");
        return;
      }
      const link = data.link as ShareLink;
      setLinks((prev) => [link, ...prev]);
      await copy(link.token, "Link created and copied to clipboard.");
    });
  }

  async function copy(token: string, message = "Link copied to clipboard.") {
    try {
      await navigator.clipboard.writeText(urlFor(token));
      toast(message, "success");
    } catch {
      toast("Couldn't copy — select the link and copy manually.", "error");
    }
  }

  async function revoke(link: ShareLink) {
    const ok = await confirm({
      title: "Revoke this link?",
      body: "Anyone still holding it loses access immediately. People who already opened the document keep the access they were granted — remove them under People.",
      confirmLabel: "Revoke",
      tone: "danger",
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await fetch(`/api/documents/${documentId}/share-links/${link.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast(data?.error ?? "Could not revoke link.", "error");
        return;
      }
      setLinks((prev) => prev.filter((l) => l.id !== link.id));
      toast("Link revoked.", "success");
    });
  }

  return (
    <div>
      <p className="text-sm text-text-muted">
        Anyone with a link can open this document without an account. They pick a display
        name and show up under People once they join.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor="link-role" className="sr-only">
          Access level for the new link
        </label>
        <Select
          id="link-role"
          value={role}
          onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
          disabled={pending}
        >
          <option value="viewer">Can view</option>
          <option value="editor">Can edit</option>
        </Select>

        <label htmlFor="link-expiry" className="sr-only">
          When the new link expires
        </label>
        <Select
          id="link-expiry"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          disabled={pending}
        >
          {EXPIRY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        <Button onClick={create} disabled={pending}>
          {pending ? "Creating…" : "Create link"}
        </Button>
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-text-muted">Loading links…</p>
      ) : links.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No share links yet"
            description="Create one to let someone in without an account."
          />
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-line">
          {links.map((link) => (
            <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge tone={link.role === "editor" ? "accent" : "neutral"}>
                    {link.role === "editor" ? "Can edit" : "Can view"}
                  </Badge>
                  <span className="text-xs text-text-subtle">
                    {link.expiresAt ? (
                      <>
                        Expires <TimeAgo iso={link.expiresAt} />
                      </>
                    ) : (
                      "Never expires"
                    )}
                  </span>
                </div>
                <p className="mt-1.5 truncate font-mono text-xs text-text-subtle">
                  {urlFor(link.token)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => copy(link.token)}>
                  Copy
                </Button>
                <Button variant="danger" size="sm" onClick={() => revoke(link)} disabled={pending}>
                  Revoke
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
