"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type CachedDoc, cacheDocs, getCachedDocs } from "@/lib/offline/docs-cache";

const roleLabel: Record<string, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

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

  // Keep the local cache warm with whatever the server last rendered.
  useEffect(() => {
    void cacheDocs(initialDocs);
  }, [initialDocs]);

  async function loadPage(nextPage: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents?page=${nextPage}`);
      if (!res.ok) throw new Error(String(res.status));
      const data: { docs: CachedDoc[]; hasMore: boolean } = await res.json();
      setDocs(data.docs);
      setHasMore(data.hasMore);
      setPage(nextPage);
      setCached(false);
      void cacheDocs(data.docs);
    } catch {
      // Offline / fetch failed: fall back to everything cached locally.
      setDocs(await getCachedDocs());
      setHasMore(false);
      setPage(1);
      setCached(true);
    } finally {
      setLoading(false);
    }
  }

  if (docs.length === 0) {
    return (
      <div className="mt-10 rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No documents yet. Create your first one to get started.
      </div>
    );
  }

  return (
    <div className="mt-8">
      {cached ? (
        <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
          Showing cached documents (offline).
        </p>
      ) : null}

      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {docs.map((doc) => (
          <li key={doc.id}>
            <Link
              href={`/app/${doc.id}`}
              className="flex items-center justify-between gap-4 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{doc.title}</span>
              <span className="text-xs uppercase tracking-wide text-zinc-500">
                {roleLabel[doc.role] ?? doc.role}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => loadPage(page - 1)}
          disabled={page <= 1 || loading || cached}
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium disabled:opacity-40 dark:border-zinc-700"
        >
          Previous
        </button>
        <span className="text-zinc-500">Page {page}</span>
        <button
          type="button"
          onClick={() => loadPage(page + 1)}
          disabled={!hasMore || loading || cached}
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium disabled:opacity-40 dark:border-zinc-700"
        >
          Next
        </button>
      </div>
    </div>
  );
}
