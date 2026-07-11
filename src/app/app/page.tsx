import { auth } from "@/auth";
import { DocumentList } from "@/components/documents/DocumentList";
import { DOCS_PAGE_SIZE, listDocumentsForUser } from "@/db/dal/documents";
import { createDocument } from "@/lib/document-actions";

export default async function AppPage() {
  const session = await auth();
  const { docs, hasMore } = session?.user?.id
    ? await listDocumentsForUser(session.user.id, { limit: DOCS_PAGE_SIZE })
    : { docs: [], hasMore: false };

  // Normalize for the client component + cache (timestamps as ISO strings).
  const initialDocs = docs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    role: doc.role,
    updatedAt: new Date(doc.updatedAt).toISOString(),
  }));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Documents
        </h1>
        <form action={createDocument}>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            New document
          </button>
        </form>
      </div>

      <DocumentList initialDocs={initialDocs} initialHasMore={hasMore} />
    </main>
  );
}
