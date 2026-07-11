import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { DeleteDocumentButton } from "@/components/documents/DeleteDocumentButton";
import { DocumentTitle } from "@/components/documents/DocumentTitle";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { getDocumentForUser } from "@/db/dal/documents";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  // Non-members (and unknown ids) get a 404 — we don't reveal that the doc exists.
  const doc = session?.user?.id ? await getDocumentForUser(id, session.user.id) : null;
  if (!doc) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
      <Link href="/app" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        ← All documents
      </Link>

      <div className="mt-4 flex items-center justify-between gap-4">
        <DocumentTitle
          documentId={doc.id}
          initialTitle={doc.title}
          editable={doc.role !== "viewer"}
        />
        {doc.role === "owner" ? <DeleteDocumentButton documentId={doc.id} /> : null}
      </div>
      <p className="mt-1 text-sm text-zinc-500">Your role: {doc.role}</p>

      <DocumentEditor documentId={doc.id} editable={doc.role !== "viewer"} />
    </main>
  );
}
