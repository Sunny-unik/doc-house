import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { siteConfig } from "@/config/site";

const features = [
  {
    title: "Local-first",
    body: "Open, edit, and close documents with zero network requests blocking the UI. Your work lives in the browser first and syncs behind you.",
  },
  {
    title: "Offline sync",
    body: "Go offline and keep writing. On reconnect, changes merge deterministically through an append-only update log — no lost edits, no overwrites.",
  },
  {
    title: "Version history",
    body: "Snapshot the document, browse the timeline, and restore a past version as a new revision — without corrupting anyone editing alongside you.",
  },
];

export default function Home() {
  return (
    <main id="main" className="flex flex-1 flex-col">
      <section className="relative overflow-hidden border-b border-line">
        {/* Decorative wash behind the hero. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_50%_-20%,var(--surface-muted),transparent)]"
        />
        <div className="relative mx-auto w-full max-w-3xl px-6 py-24 text-center sm:py-32">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-text-subtle">
            {siteConfig.tagline}
          </p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-text sm:text-6xl">
            {siteConfig.name}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-text-muted">
            {siteConfig.description}
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login">
              <Button size="lg">Get started</Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="secondary">
                Create an account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
        <dl className="grid gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-line bg-surface p-6">
              <dt className="text-base font-semibold text-text">{f.title}</dt>
              <dd className="mt-2 text-sm leading-6 text-text-muted">{f.body}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
