import Link from "next/link";
import { auth } from "@/auth";
import { listDocumentsForUser } from "@/db/dal/documents";
import { createDocument } from "@/lib/document-actions";

const roleLabel: Record<string, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

export default async function AppPage() {
  const session = await auth();
  const docs = session?.user?.id ? await listDocumentsForUser(session.user.id) : [];

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

      {docs.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No documents yet. Create your first one to get started.
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-200 dark:divide-zinc-800">
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
      )}
    </main>
  );
}
