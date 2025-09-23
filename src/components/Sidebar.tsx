import Link from "next/link";
import { FileText, Shield } from "lucide-react";

type User = {
  email?: string | null;
  role?: "user" | "superadmin";
};

export function Sidebar({ user }: { user: User }) {
  const initial = (user?.email?.[0] ?? "Z").toUpperCase();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r bg-white p-4
                      dark:bg-zinc-900 dark:border-zinc-800">
      {/* Brand */}
      <Link
        href="/dashboard"
        className="mb-6 flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-gray-100
                   dark:hover:bg-zinc-800"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 text-white font-bold
                        dark:bg-zinc-800">
          {initial}
        </div>
        <div>
          <div className="text-sm text-gray-500 dark:text-zinc-400">Zetruc</div>
          <div className="-mt-1 text-lg font-semibold">LLMeter</div>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-1 text-sm">
        <Link
          href="/projects"
          className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-gray-100
                     dark:hover:bg-zinc-800"
        >
          <FileText className="h-4 w-4" />
          <span>Projets</span>
        </Link>

        {user?.group === "ADMINISTRATEUR" && (
          <Link href="/superadmin" className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-gray-100 dark:hover:bg-zinc-800">
            <Shield className="h-4 w-4" /><span>Superadmin</span>
          </Link>
        )}

      </nav>

      {/* Footer collé en bas */}
      <div className="mt-auto pt-4 text-xs text-gray-400 dark:text-zinc-500">
        © {new Date().getFullYear()} Zetruc
      </div>
    </aside>
  );
}
