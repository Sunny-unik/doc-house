import Link from "next/link";
import { siteConfig } from "@/config/site";

const features = [
  {
    title: "Local-first",
    body: "Open, edit, and close documents with zero network requests blocking the UI. Your work lives in the browser first.",
  },
  {
    title: "Offline sync",
    body: "Go offline, keep writing. On reconnect, changes merge deterministically — no lost edits, no overwrites.",
  },
  {
    title: "Version history",
    body: "Snapshot the document, browse a timeline, and safely restore a past version without corrupting live collaborators.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-20">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
        {siteConfig.tagline}
      </p>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
        {siteConfig.name}
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        {siteConfig.description}
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Get started
        </Link>
      </div>

      <dl className="mt-16 grid gap-8 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title}>
            <dt className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {f.title}
            </dt>
            <dd className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {f.body}
            </dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
