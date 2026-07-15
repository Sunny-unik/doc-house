import Link from "next/link";
import { siteConfig } from "@/config/site";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16"
    >
      <Link
        href="/"
        className="mx-auto mb-8 rounded text-sm font-semibold tracking-tight text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        {siteConfig.name}
      </Link>
      <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">{children}</div>
    </main>
  );
}
