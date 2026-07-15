import { auth } from "@/auth";
import { AppShell } from "@/components/documents/AppShell";
import { DOCS_PAGE_SIZE, listDocumentsForUser } from "@/db/dal/documents";

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
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

  // `id` only seeds the initial render (a direct visit / reload). After that,
  // opening and closing documents is handled entirely client-side by AppShell.
  return (
    <AppShell
      initialDocs={initialDocs}
      initialHasMore={hasMore}
      initialOpenId={id ?? null}
    />
  );
}
