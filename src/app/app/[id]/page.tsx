import { redirect } from "next/navigation";

// The document workspace is served from /app?id=<id> (a query param on the app
// route) so it renders client-side and opens offline. This keeps any old
// /app/<id> links (bookmarks, shared URLs) working by forwarding them.
export default async function LegacyDocumentRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/app?id=${id}`);
}
