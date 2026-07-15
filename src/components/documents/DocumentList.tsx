"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge, Dot } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { type CachedDoc, cacheDocs, getCachedDocs } from "@/lib/offline/docs-cache";

const roleTone: Record<string, "accent" | "neutral"> = {
  owner: "accent",
  editor: "neutral",
  viewer: "neutral",
};

const SEARCH_DEBOUNCE_MS = 300;

export function DocumentList({
  initialDocs,
  initialHasMore,
}: {
  initialDocs: CachedDoc[];
  initialHasMore: boolean;
}) {
  const [docs, setDocs] = useState(initialDocs);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(false);
  // `query` is what's typed; `search` is the debounced value we actually fetch.
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  // Debounce typing, and reset to page 1 in the same update — batching both
  // means the fetch effect below fires once per search, not once per field.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch whenever the page or search term changes. The first run is skipped —
  // the server already rendered page 1 for us.
  const firstRun = useRef(true);
  const latestRequest = useRef(0);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    const requestId = ++latestRequest.current;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(
          `/api/documents?page=${page}&q=${encodeURIComponent(search)}`,
        );
        if (!res.ok) throw new Error(String(res.status));
        const data: { docs: CachedDoc[]; hasMore: boolean } = await res.json();
        // A newer keystroke already fired: drop this response rather than let a
        // slow early request overwrite a fast later one.
        if (requestId !== latestRequest.current) return;
        setDocs(data.docs);
        setHasMore(data.hasMore);
        setCached(false);
      } catch {
        if (requestId !== latestRequest.current) return;
        // Offline / fetch failed: fall back to everything cached locally and
        // filter it here, since there's no server to do the matching.
        const all = await getCachedDocs();
        const term = search.toLowerCase();
        setDocs(term ? all.filter((d) => d.title.toLowerCase().includes(term)) : all);
        setHasMore(false);
        setCached(true);
      } finally {
        if (requestId === latestRequest.current) setLoading(false);
      }
    })();
  }, [page, search]);

  // Keep the metadata cache warm with whatever the list is currently showing.
  useEffect(() => {
    if (cached) return; // already came from cache, don't loop it back in
    if (docs.length === 0) return;
    void cacheDocs(docs);
  }, [docs, cached]);

  // Warm each doc's Yjs store in the background so any listed doc opens
  // instantly and works offline. Also runs on pagination, so every doc the
  // user has ever seen in the list ends up mirrored into IndexedDB.
  useEffect(() => {
    if (cached) return;
    if (docs.length === 0) return;
    if (typeof navigator === "undefined" || !navigator.onLine) return;

    const controller = new AbortController();
    (async () => {
      const { prefetchDocuments } = await import("@/lib/offline/prefetch");
      await prefetchDocuments(
        docs.map((d) => d.id),
        controller.signal,
      );
    })();
    return () => controller.abort();
  }, [docs, cached]);

  const searching = search.length > 0;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="doc-search" className="sr-only">
            Search documents by title
          </label>
          <Input
            id="doc-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            autoComplete="off"
          />
        </div>
        {cached ? (
          <span className="flex items-center gap-1.5 text-xs text-warning">
            <Dot className="bg-warning" />
            Offline — showing cached documents
          </span>
        ) : null}
      </div>

      {/* One live region for the whole list, so a screen reader hears the result
          count change instead of silently re-rendering rows underneath. */}
      <p role="status" aria-live="polite" className="sr-only">
        {loading
          ? "Loading documents"
          : `${docs.length} document${docs.length === 1 ? "" : "s"} shown`}
      </p>

      <div className="mt-4">
        {loading ? (
          <ul className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <SkeletonRow key={i} />
            ))}
          </ul>
        ) : docs.length === 0 ? (
          searching ? (
            <EmptyState
              title="No matches"
              description={`Nothing titled like “${search}”. Try a different word, or clear the search.`}
              action={
                <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No documents yet"
              description="Create your first document — it'll open instantly and keep working offline."
            />
          )
        ) : (
          <ul className="space-y-2">
            {docs.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/app/${doc.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3.5 transition-colors hover:border-line-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-text">{doc.title}</span>
                    <TimeAgo
                      iso={doc.updatedAt}
                      prefix="Edited"
                      className="mt-0.5 block text-xs text-text-subtle"
                    />
                  </span>
                  <Badge tone={roleTone[doc.role] ?? "neutral"}>{doc.role}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Hidden when there's nothing to page through: a lone dead Previous/Next
          pair is noise. Also hidden against the local cache, which holds
          whatever has been seen rather than a server-ordered page. */}
      {cached || (page === 1 && !hasMore) ? null : (
        <div className="mt-6 flex items-center justify-between gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1 || loading}
          >
            Previous
          </Button>
          <span className="text-sm text-text-subtle">Page {page}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={!hasMore || loading}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="h-4 w-48 max-w-full animate-pulse rounded bg-surface-muted" />
        <div className="mt-2 h-3 w-24 animate-pulse rounded bg-surface-muted" />
      </div>
      <div className="h-5 w-16 shrink-0 animate-pulse rounded-full bg-surface-muted" />
    </li>
  );
}
