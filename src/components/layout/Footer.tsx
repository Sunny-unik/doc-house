import { siteConfig } from "@/config/site";

const { author, name } = siteConfig;

const links = [
  { label: "GitHub", href: author.github },
  { label: "LinkedIn", href: author.linkedin },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-text-muted sm:flex-row">
        <p>
          Built by <span className="font-medium text-text">{author.name}</span>
        </p>
        <nav className="flex items-center gap-4" aria-label="Author links">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              {link.label}
            </a>
          ))}
          <span aria-hidden className="text-text-subtle">
            ·
          </span>
          <span>{name}</span>
        </nav>
      </div>
    </footer>
  );
}
