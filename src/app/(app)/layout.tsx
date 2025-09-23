export const runtime = "nodejs";     // 👈 force Node runtime

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { Sidebar } from "@/components/Sidebar";
import { TopbarUserMenu } from "@/components/TopbarUserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-zinc-950 p-6">
        <div className="max-w-md w-full rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 p-8 shadow-sm">
          <h1 className="mb-2 text-2xl font-semibold">Vous n&apos;êtes pas connecté</h1>
          <p className="mb-6 text-sm text-gray-600 dark:text-zinc-400">
            Veuillez vous connecter pour accéder au tableau de bord.
          </p>
          <Link href="/" className="inline-flex items-center rounded-xl border px-4 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800">
            Aller à la connexion
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-50">
      <Sidebar user={session.user as any} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-3 border-b bg-white dark:bg-zinc-900 dark:border-zinc-800 px-4">
          <ThemeToggle />
          <TopbarUserMenu user={session.user as any} />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
