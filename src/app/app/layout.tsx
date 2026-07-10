import Link from "next/link";
import { auth } from "@/auth";
import { logout } from "@/lib/auth-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-black/[.08] dark:border-white/[.12]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/app" className="font-semibold tracking-tight">
            docHouse
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-500">{session?.user?.email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
