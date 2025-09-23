'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ProjectRow({ id, name, createdAt }: { id: string; name: string; createdAt: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const ok = confirm(`Supprimer le projet « ${name} » ?`);
    if (!ok) return;
    setLoading(true);
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Échec de la suppression");
      setLoading(false);
      return;
    }
    router.refresh(); // recharge la liste côté serveur
  }

  return (
    <li className="flex items-center justify-between border-b last:border-b-0 border-gray-100 dark:border-zinc-800 p-4">
      <div className="font-medium">{name}</div>

      <div className="flex items-center gap-2">
        <span className="hidden sm:inline text-xs text-gray-500 dark:text-zinc-400">
          {new Date(createdAt).toLocaleString()}
        </span>

        <Link
          href={`/projects/${id}`}
          className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800
                     border-gray-200 dark:border-zinc-700"
        >
          Ouvrir
        </Link>

        <button
          onClick={handleDelete}
          disabled={loading}
          className="rounded-xl bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Suppression…" : "Supprimer"}
        </button>
      </div>
    </li>
  );
}
