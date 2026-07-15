import { auth } from "@/auth";
import { getDocumentForUser, listDocumentMembers } from "@/db/dal/documents";

// GET /api/documents/[id] — metadata + members for the client-rendered document
// workspace (/app/doc?id=). Tenant-scoped: non-members get 404 so we never
// reveal that a document exists.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const doc = await getDocumentForUser(id, session.user.id);
  if (!doc) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const members = await listDocumentMembers(id);
  return Response.json({
    id: doc.id,
    title: doc.title,
    role: doc.role,
    currentUserId: session.user.id,
    members,
  });
}
