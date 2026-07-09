import { siteConfig } from "@/config/site";

const { author, name } = siteConfig;

export function Footer() {
  return (
    <footer className="border-t border-black/[.08] dark:border-white/[.12]">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-zinc-600 dark:text-zinc-400 sm:flex-row">
        <p>
          Built by <span className="font-medium text-zinc-900 dark:text-zinc-100">{author.name}</span>
        </p>
        <nav className="flex items-center gap-4" aria-label="Author links">
          <a
            href={author.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            GitHub
          </a>
          <a
            href={author.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            LinkedIn
          </a>
          <span className="text-zinc-400 dark:text-zinc-600">·</span>
          <span>{name}</span>
        </nav>
      </div>
    </footer>
  );
}
