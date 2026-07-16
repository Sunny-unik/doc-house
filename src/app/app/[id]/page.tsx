import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DeleteDocumentButton } from "@/components/documents/DeleteDocumentButton";
import { DocumentTitle } from "@/components/documents/DocumentTitle";
import { MembersPanel } from "@/components/documents/MembersPanel";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { Badge } from "@/components/ui/Badge";
import { getDocumentForUser, listDocumentMembers } from "@/db/dal/documents";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  // Non-members (and unknown ids) get a 404 — we don't reveal that the doc exists.
  const doc = session?.user?.id ? await getDocumentForUser(id, session.user.id) : null;
  if (!doc || !session?.user?.id) notFound();

  const members = await listDocumentMembers(doc.id);

  return (
    <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8">
      <Link
        href="/app"
        className="w-fit rounded text-sm text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        ← All documents
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <DocumentTitle
            documentId={doc.id}
            initialTitle={doc.title}
            editable={doc.role !== "viewer"}
          />
          <div className="mt-2 px-1.5">
            <Badge tone={doc.role === "owner" ? "accent" : "neutral"}>{doc.role}</Badge>
          </div>
        </div>
        {doc.role === "owner" ? <DeleteDocumentButton documentId={doc.id} /> : null}
      </div>

      <DocumentEditor
        documentId={doc.id}
        editable={doc.role !== "viewer"}
        isOwner={doc.role === "owner"}
        currentUserId={session.user.id}
        membersPanel={
          <MembersPanel
            documentId={doc.id}
            currentUserId={session.user.id}
            currentUserRole={doc.role}
            initialMembers={members}
          />
        }
      />
    </main>
  );
}
