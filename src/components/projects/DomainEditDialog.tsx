"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

type Domain = {
  id: string;
  name: string;
  notes?: string | null;
  competitors: string; // JSON.stringify(string[])
};

function parseCompetitors(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map((s) => String(s)) : [];
  } catch {
    return [];
  }
}

export default function DomainEditDialog({
  projectId,
  domain,
}: {
  projectId: string;
  domain: Domain;
}) {
  const { toast } = useToast();
  const router = useRouter();

  const [open, setOpen] = useState(false);

  // base = dernière version locale connue
  const [base, setBase] = useState(() => ({
    name: domain.name,
    notes: domain.notes ?? "",
    competitors: parseCompetitors(domain.competitors),
  }));

  const [name, setName] = useState(base.name);
  const [notes, setNotes] = useState(base.notes);
  const [competitors, setCompetitors] = useState<string[]>(base.competitors);
  const [competitorInput, setCompetitorInput] = useState("");

  useEffect(() => {
    if (!open) {
      setName(base.name);
      setNotes(base.notes);
      setCompetitors(base.competitors);
      setCompetitorInput("");
    }
  }, [open, base]);

  function addCompetitor() {
    const v = competitorInput.trim();
    if (!v) return;
    if (!competitors.includes(v)) setCompetitors([...competitors, v]);
    setCompetitorInput("");
  }
  function removeCompetitor(v: string) {
    setCompetitors(competitors.filter((x) => x !== v));
  }

  async function save() {
    if (!name.trim()) {
      toast({ title: "Nom requis", description: "Le nom du domaine est obligatoire." });
      return;
    }
    const res = await fetch(`/api/projects/${projectId}/domains/${domain.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        notes: notes || null,
        competitors,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast({ title: "Échec", description: j.error ?? "Impossible d’enregistrer." });
      return;
    }
    const updated = await res.json();

    setBase({
      name: updated.name,
      notes: updated.notes ?? "",
      competitors: parseCompetitors(updated.competitors),
    });

    toast({ title: "Modifié", description: "Le domaine a été mis à jour." });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {/* Bouton qui ouvre le drawer */}
      <Dialog.Trigger asChild>
        <button className="inline-flex items-center gap-1 opacity-80 hover:opacity-100">
          <span>✏️</span> Edit
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content
          className="
            fixed right-0 top-0 h-screen w-full max-w-[640px]
            bg-white p-4 shadow-xl outline-none dark:bg-zinc-900
          "
        >
          <div className="flex items-start justify-between">
            <Dialog.Title className="text-lg font-semibold">Modifier le Domaine d’activité</Dialog.Title>
            <Dialog.Close className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-zinc-800">✕</Dialog.Close>
          </div>

          <div className="mt-4 space-y-4 overflow-y-auto pr-2" style={{ maxHeight: "calc(100vh - 150px)" }}>
            {/* Nom */}
            <div>
              <label className="block text-sm font-medium">Nom</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 dark:bg-zinc-900 dark:border-zinc-800"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium">Notes</label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 dark:bg-zinc-900 dark:border-zinc-800"
              />
            </div>

            {/* Concurrents */}
            <div className="rounded-xl border p-3 dark:border-zinc-800">
              <label className="block text-sm font-medium mb-2">Concurrents</label>
              <div className="flex gap-2">
                <input
                  placeholder="Ajouter le nom d'un concurrent"
                  value={competitorInput}
                  onChange={(e) => setCompetitorInput(e.target.value)}
                  className="flex-1 rounded-xl border px-3 py-2 dark:bg-zinc-900 dark:border-zinc-800"
                />
                <button
                  onClick={addCompetitor}
                  className="rounded-lg border px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  Ajouter
                </button>
              </div>
              {!!competitors.length && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {competitors.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-2 py-1 text-sm dark:bg-zinc-800"
                    >
                      {c}
                      <button onClick={() => removeCompetitor(c)} title="Retirer">
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={save}
              className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Mettre à jour
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
