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

type CompetitorObj = {
  name: string;
  website?: string;
  reason?: string;
  confidence?: number;
  signals?: string[];
  source?: string;
};

function normalizeSuggestion(value: unknown): CompetitorObj | null {
  if (!value) return null;
  if (typeof value === "string") {
    const name = value.trim();
    return name ? { name } : null;
  }
  if (typeof value === "object") {
    const candidate = value as {
      name?: unknown;
      website?: unknown;
      reason?: unknown;
      confidence?: unknown;
      signals?: unknown;
      source?: unknown;
    };
    const name = String(candidate.name ?? "").trim();
    if (!name) return null;
    const suggestion: CompetitorObj = { name };
    if (candidate.website) suggestion.website = String(candidate.website);
    if (candidate.reason) suggestion.reason = String(candidate.reason);
    if (typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)) {
      suggestion.confidence = Math.max(0, Math.min(100, Math.round(candidate.confidence)));
    }
    if (Array.isArray(candidate.signals)) {
      const signals = candidate.signals.map((signal) => String(signal).trim()).filter(Boolean);
      if (signals.length) suggestion.signals = Array.from(new Set(signals));
    }
    if (candidate.source) suggestion.source = String(candidate.source);
    return suggestion;
  }
  return null;
}

function confidenceTextClass(score?: number) {
  if ((score ?? 0) >= 75) return "text-emerald-600";
  if ((score ?? 0) >= 55) return "text-amber-600";
  return "text-rose-600";
}

function confidenceBarClass(score?: number) {
  if ((score ?? 0) >= 75) return "bg-emerald-500";
  if ((score ?? 0) >= 55) return "bg-amber-500";
  return "bg-rose-500";
}

function displayConfidence(score?: number) {
  if (typeof score !== "number" || Number.isNaN(score)) return 50;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function describeSource(source?: string) {
  if (!source) return "IA générative";
  if (source.includes("gpt4o")) return "GPT-4o + Web";
  if (source.includes("o3")) return "OpenAI o3";
  if (source.includes("gpt4mini")) return "GPT-4o-mini";
  return source;
}

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
  const [suggestionsMeta, setSuggestionsMeta] = useState<{
    source?: string;
    webSearchUsed?: boolean;
    executionTime?: string;
    averageConfidence?: number | null;
  } | null>(null);

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
    setSuggestionsMeta(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/domains/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "competitors", domainName: name.trim() }),
      });
      const j = await res.json();
      const meta = {
        source: typeof j.source === "string" ? j.source : undefined,
        webSearchUsed: typeof j.webSearchUsed === "boolean" ? j.webSearchUsed : undefined,
        executionTime: typeof j.executionTime === "string" ? j.executionTime : undefined,
        averageConfidence:
          typeof j.averageConfidence === "number" && Number.isFinite(j.averageConfidence)
            ? Math.round(j.averageConfidence)
            : undefined,
      };
      setSuggestionsMeta(meta);
      const items: CompetitorObj[] = Array.isArray(j.items)
        ? j.items
            .map((item: unknown) => normalizeSuggestion(item))
            .filter((item): item is CompetitorObj => Boolean(item))
        : [];
      setCompetitorSuggestions(items);
    } catch {
      toast({ title: "Échec", description: "Impossible d'obtenir des concurrents suggérés" });
      setSuggestionsMeta(null);
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
                <div className="mt-3 flex flex-col gap-2 text-sm">
                  {suggestionsMeta && (
                    <div className="text-xs text-muted-foreground">
                      Source : {describeSource(suggestionsMeta.source)}
                      {typeof suggestionsMeta.webSearchUsed === "boolean" && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-[2px] text-[10px] uppercase tracking-wide dark:border-zinc-700">
                          {suggestionsMeta.webSearchUsed ? "Web search" : "Sans web"}
                        </span>
                      )}
                  {suggestionsMeta.executionTime && (
                    <span className="ml-2">• {suggestionsMeta.executionTime}</span>
                  )}
                  {typeof suggestionsMeta.averageConfidence === "number" && (
                    <span className="ml-2">• Score moyen {suggestionsMeta.averageConfidence}%</span>
                  )}
                </div>
              )}
                  {competitorSuggestions.map((c) => {
                    const confidence = displayConfidence(c.confidence);
                    const sourceLabel = describeSource(c.source ?? suggestionsMeta?.source);
                    return (
                      <div
                        key={`${c.name}-${c.website ?? ""}`}
                        className="rounded-xl border px-3 py-2 dark:border-zinc-800"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="font-medium leading-tight">
                                {c.name}
                              </div>
                              {c.website && (
                                <a
                                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                                  href={c.website}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {c.website}
                                </a>
                              )}
                              {!!c.signals?.length && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {c.signals.map((signal) => (
                                    <span
                                      key={`${c.name}-${signal}`}
                                      className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-[2px] text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                                    >
                                      {signal}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex w-[88px] flex-col items-end gap-1">
                              <div className={`flex items-center gap-1 text-xs ${confidenceTextClass(c.confidence)}`}>
                                <span>Confiance</span>
                                <span className="font-semibold">{confidence}%</span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                                <div
                                  className={`${confidenceBarClass(c.confidence)} h-full rounded-full`}
                                  style={{ width: `${Math.max(4, confidence)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          {c.reason && (
                            <div className="text-xs leading-5 text-muted-foreground">{c.reason}</div>
                          )}
                          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>{sourceLabel}</span>
                            <button
                              onClick={() =>
                                setCompetitors((prev) => (prev.includes(c.name) ? prev : [...prev, c.name]))
                              }
                              className="shrink-0 rounded-lg border px-3 py-1 hover:bg-gray-50 dark:hover:bg-zinc-800"
                            >
                              Ajouter
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
