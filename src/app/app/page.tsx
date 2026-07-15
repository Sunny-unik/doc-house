import { auth } from "@/auth";
import { DocumentList } from "@/components/documents/DocumentList";
import { NewDocumentButton } from "@/components/documents/NewDocumentButton";
import { DOCS_PAGE_SIZE, listDocumentsForUser } from "@/db/dal/documents";

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
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Documents</h1>
          <p className="mt-1 text-sm text-text-muted">
            Everything you own or have been given access to.
          </p>
        </div>
        <NewDocumentButton />
      </div>

      <DocumentList initialDocs={initialDocs} initialHasMore={hasMore} />
    </main>
  );
}
