import { auth } from "@/auth";
import { DOCS_PAGE_SIZE, listDocumentsForUser } from "@/db/dal/documents";

// GET /api/documents?page=N — a tenant-scoped page of the caller's documents.
// Used by the client list for pagination and to refresh the offline cache.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const { docs, hasMore } = await listDocumentsForUser(session.user.id, {
    limit: DOCS_PAGE_SIZE,
    offset: (page - 1) * DOCS_PAGE_SIZE,
  });

  return Response.json({ docs, page, hasMore });
}
