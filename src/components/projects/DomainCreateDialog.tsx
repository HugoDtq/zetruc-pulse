"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

/** Normalise une réponse variée (```json …```, CSV, listes, etc.) en tableau de chaînes */
function normalizeList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean);
  const toStrings = (value: unknown): string[] => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }
    if (Array.isArray(value)) return value.flatMap(toStrings);
    if (value && typeof value === "object") {
      return Object.values(value).flatMap(toStrings);
    }
    return [];
  };

  if (typeof raw !== "string") return [];
  let text = raw.trim();

  // retire les fences ```json ... ```
  text = text.replace(/^```[\s\S]*?json\n?/i, "").replace(/```$/i, "").replace(/```/g, "");

  // tente JSON direct
  try {
    const parsed = JSON.parse(text);
    const list = toStrings(parsed);
    if (list.length) return list;
  } catch {
    /* ignore */
  }

  // fallback: split virgules / lignes / points-virgules
  return text
    .split(/\r?\n|,|;/)
    .map((s) => s.replace(/^[-*•\s]+/, "").trim())
    .filter(Boolean);
}

type CompetitorObj = { name: string; website?: string; reason?: string };

export default function DomainCreateDialog({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const router = useRouter();

  const [open, setOpen] = useState(false);

  // Formulaire de création
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [competitorInput, setCompetitorInput] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);

  // Suggestions IA
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [domainSuggestions, setDomainSuggestions] = useState<string[]>([]);

  const [loadingCompetitors, setLoadingCompetitors] = useState(false);
  const [competitorSuggestions, setCompetitorSuggestions] = useState<CompetitorObj[]>([]);

  function addCompetitor() {
    const v = competitorInput.trim();
    if (!v) return;
    if (!competitors.includes(v)) setCompetitors((prev) => [...prev, v]);
    setCompetitorInput("");
  }
  function removeCompetitor(v: string) {
    setCompetitors((prev) => prev.filter((x) => x !== v));
  }

  async function suggestDomains() {
    setLoadingDomains(true);
    setDomainSuggestions([]);
    try {
      const res = await fetch(`/api/projects/${projectId}/domains/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "domains" }),
      });
      const j = await res.json();
      setDomainSuggestions(normalizeList(j.items));
    } catch {
      toast({ title: "Échec", description: "Impossible d'obtenir des suggestions" });
    } finally {
      setLoadingDomains(false);
    }
  }

  async function suggestCompetitors() {
    if (!name.trim()) {
      toast({ title: "Nom requis", description: "Renseigne d'abord le nom du domaine d'activité." });
      return;
    }
    setLoadingCompetitors(true);
    setCompetitorSuggestions([]);
    try {
      const res = await fetch(`/api/projects/${projectId}/domains/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "competitors", domainName: name.trim() }),
      });
      const j = await res.json();
      const items: CompetitorObj[] = Array.isArray(j.items) ? j.items : [];
      setCompetitorSuggestions(items);
    } catch {
      toast({ title: "Échec", description: "Impossible d'obtenir des concurrents suggérés" });
    } finally {
      setLoadingCompetitors(false);
    }
  }

  async function create() {
    if (!name.trim()) {
      toast({ title: "Nom requis", description: "Le nom du domaine d'activité est obligatoire." });
      return;
    }
    const res = await fetch(`/api/projects/${projectId}/domains`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), notes, competitors }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast({ title: "Échec", description: j.error ?? "Impossible de créer le domaine." });
      return;
    }
    toast({ title: "Créé", description: "Le domaine d'activité a été ajouté." });
    setOpen(false);
    // reset local
    setName(""); setNotes(""); setCompetitors([]); setCompetitorInput("");
    setDomainSuggestions([]); setCompetitorSuggestions([]);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="rounded-xl border px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-zinc-800">
          Ajouter un Domaine d'activité
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
            <Dialog.Title className="text-lg font-semibold">Ajouter un nouveau Domaine d’activité</Dialog.Title>
            <Dialog.Close className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-zinc-800">✕</Dialog.Close>
          </div>

          <div className="mt-4 space-y-4 overflow-y-auto pr-2" style={{ maxHeight: "calc(100vh - 150px)" }}>
            {/* Nom */}
            <div>
              <label className="block text-sm font-medium">Nom du Domaine d’activité</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Agence de communication"
                className="w-full rounded-xl border px-3 py-2 dark:bg-zinc-900 dark:border-zinc-800"
              />
            </div>

            {/* Suggérer domaines */}
            <div className="rounded-xl border p-3 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Suggestions de Domaine d’activité par l’IA</div>
                <button
                  onClick={suggestDomains}
                  className="rounded-lg border px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  {loadingDomains ? "Génération…" : "Suggérer des Domaines"}
                </button>
              </div>
              <p className="mt-2 text-xs opacity-70">
                Cliquez sur « Suggérer des Domaines » pour obtenir des idées basées sur l’IA à partir
                de la description de votre projet.
              </p>
              {!!domainSuggestions.length && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {domainSuggestions.map((d) => (
                    <button
                      key={d}
                      onClick={() => setName(d)}
                      className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium">Notes</label>
              <textarea
                rows={4}
                placeholder="Décrivez les idées principales de ce domaine d'activitée.."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 dark:bg-zinc-900 dark:border-zinc-800"
              />
            </div>

            {/* Concurrents initiaux */}
            <div className="rounded-xl border p-3 dark:border-zinc-800">
              <label className="block text-sm font-medium mb-2">Concurrents initiaux</label>
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

            {/* Suggestions de concurrents par l'IA */}
            <div className="rounded-xl border p-3 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Suggestions de l’IA</div>
                <button
                  onClick={suggestCompetitors}
                  disabled={!name.trim()}
                  className="rounded-lg border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-zinc-800"
                  title={!name.trim() ? "Veuillez saisir un nom de domaine d'activité" : ""}
                >
                  {loadingCompetitors ? "Génération…" : "Suggérer"}
                </button>
              </div>
              <p className="mt-2 text-xs opacity-70">
                Les suggestions affichent uniquement des acteurs pour lesquels l’IA indique explicitement
                une présence dans la ville et le pays demandés. Si aucune source sûre, la liste peut être vide.
              </p>

              {!!competitorSuggestions.length && (
                <div className="mt-3 flex flex-col gap-2">
                  {competitorSuggestions.map((c) => (
                    <div
                      key={`${c.name}-${c.website ?? ""}`}
                      className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm dark:border-zinc-800"
                      title={c.reason || ""}
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.name}</div>
                        {c.website && (
                          <a
                            className="text-xs underline opacity-80"
                            href={c.website}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {c.website}
                          </a>
                        )}
                        {c.reason && (
                          <div className="text-xs opacity-70 line-clamp-2">{c.reason}</div>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          setCompetitors((prev) => (prev.includes(c.name) ? prev : [...prev, c.name]))
                        }
                        className="shrink-0 rounded-lg border px-3 py-1 hover:bg-gray-50 dark:hover:bg-zinc-800"
                      >
                        Ajouter
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={create}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            >
              Créer un Domaine d'activité
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
