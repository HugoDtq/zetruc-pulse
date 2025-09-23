"use client";

import { useRouter } from "next/navigation";
import DomainEditDialog from "./DomainEditDialog";

export default function DomainCard({
  projectId,
  domain,
}: {
  projectId: string;
  domain: { id: string; name: string; notes?: string | null; competitors: string; updatedAt: string };
}) {
  const router = useRouter();
  const comp = (() => {
    try {
      const a = JSON.parse(domain.competitors);
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  })();

  async function del() {
    if (!confirm("Supprimer ce domaine d'activité ?")) return;
    const res = await fetch(`/api/projects/${projectId}/domains/${domain.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="rounded-2xl border p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold">{domain.name}</h3>
        <span className="text-xs opacity-60">
          Updated {new Date(domain.updatedAt).toLocaleString()}
        </span>
      </div>

      {domain.notes && <p className="mt-2 text-sm">{domain.notes}</p>}

      {!!comp.length && (
        <div className="mt-3">
          <div className="text-xs font-medium opacity-70 mb-1">CONCURRENTS</div>
          <div className="flex flex-wrap gap-2">
            {comp.map((c: string) => (
              <span key={c} className="rounded-full bg-gray-100 px-2 py-1 text-xs dark:bg-zinc-800">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-4 text-sm">
        {/* 👇 Le bouton Edit ouvre maintenant un drawer fonctionnel */}
        <DomainEditDialog projectId={projectId} domain={domain as any} />
        <button
          onClick={del}
          className="inline-flex items-center gap-1 text-red-600 opacity-80 hover:opacity-100"
        >
          <span>🗑️</span> Delete
        </button>
      </div>
    </div>
  );
}
