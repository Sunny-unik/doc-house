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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Documents
        </h1>
        <NewDocumentButton />
      </div>

      <DocumentList initialDocs={initialDocs} initialHasMore={hasMore} />
    </main>
  );
}
