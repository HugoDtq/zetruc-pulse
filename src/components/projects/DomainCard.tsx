"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import DomainEditDialog from "./DomainEditDialog";

type CompetitorSuggestion = {
  name: string;
  website?: string;
  reason?: string;
  confidence?: number;
  signals?: string[];
  source?: string;
};

type DomainCardDomain = {
  id: string;
  name: string;
  notes?: string | null;
  competitors: string;
  suggestions?: string | null;
  createdAt: string;
  updatedAt: string;
};

function parseCompetitors(value: string): string[] {
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function coerceSuggestion(value: unknown): CompetitorSuggestion | null {
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
    const suggestion: CompetitorSuggestion = { name };
    if (candidate.website) suggestion.website = String(candidate.website);
    if (candidate.reason) suggestion.reason = String(candidate.reason);
    if (typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)) {
      suggestion.confidence = Math.max(1, Math.min(100, Math.round(candidate.confidence)));
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

function parseSuggestions(value?: string | null): CompetitorSuggestion[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => coerceSuggestion(item))
      .filter((item): item is CompetitorSuggestion => Boolean(item));
  } catch {
    return [];
  }
}

function confidenceTextClass(score?: number) {
  if ((score ?? 0) >= 75) return "text-emerald-600 dark:text-emerald-400";
  if ((score ?? 0) >= 55) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
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

function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = date.getTime() - Date.now();
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
  ];
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  for (const [unit, ms] of ranges) {
    if (Math.abs(diff) >= ms || unit === "minute") {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return rtf.format(Math.round(diff / 1000), "second");
}

export default function DomainCard({
  projectId,
  domain,
}: {
  projectId: string;
  domain: DomainCardDomain;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const baseCompetitors = useMemo(() => parseCompetitors(domain.competitors), [domain.competitors]);
  const [competitors, setCompetitors] = useState<string[]>(baseCompetitors);
  useEffect(() => {
    setCompetitors(baseCompetitors);
  }, [baseCompetitors, domain.id]);

  const [suggestions, setSuggestions] = useState<CompetitorSuggestion[]>(
    () => parseSuggestions(domain.suggestions)
  );
  const [suggestionsMeta, setSuggestionsMeta] = useState<{
    source?: string;
    webSearchUsed?: boolean;
    executionTime?: string;
    averageConfidence?: number | null;
  } | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [savingCompetitor, setSavingCompetitor] = useState<string | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  useEffect(() => {
    if (suggestionsMeta || suggestions.length === 0) return;
    const sources = Array.from(
      new Set(suggestions.map((item) => item.source).filter(Boolean))
    );
    if (sources.length) {
      const confidences = suggestions
        .map((item) => (typeof item.confidence === "number" ? item.confidence : null))
        .filter((value): value is number => value !== null);
      setSuggestionsMeta({
        source: sources[0],
        averageConfidence: confidences.length
          ? Math.round(
              confidences.reduce((sum, value) => sum + value, 0) / confidences.length
            )
          : undefined,
      });
    }
  }, [suggestions, suggestionsMeta]);

  const competitorHealth = competitors.length === 0
    ? { label: "Aucun concurrent suivi", tone: "warning" as const }
    : competitors.length < 3
      ? { label: "Couverture à renforcer", tone: "info" as const }
      : { label: "Couverture solide", tone: "success" as const };

  const notesItems = useMemo(() => {
    if (!domain.notes) return [];
    return domain.notes
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }, [domain.notes]);

  async function del() {
    if (!confirm("Supprimer ce domaine d'activité ?")) return;
    const res = await fetch(`/api/projects/${projectId}/domains/${domain.id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Domaine supprimé", description: domain.name });
      router.refresh();
    } else {
      toast({ title: "Échec", description: "Impossible de supprimer ce domaine." });
    }
  }

  async function refreshSuggestions() {
    setLoadingSuggestions(true);
    setSuggestionError(null);
    setSuggestionsMeta(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/domains/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "competitors", domainName: domain.name }),
      });
      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }
      const json: {
        items?: unknown;
        source?: unknown;
        webSearchUsed?: unknown;
        executionTime?: unknown;
        averageConfidence?: unknown;
      } = await res.json();
      const next: CompetitorSuggestion[] = Array.isArray(json.items)
        ? json.items
            .map((item: unknown) => coerceSuggestion(item))
            .filter((item): item is CompetitorSuggestion => Boolean(item))
        : [];
      setSuggestionsMeta({
        source: typeof json.source === "string" ? json.source : undefined,
        webSearchUsed: typeof json.webSearchUsed === "boolean" ? json.webSearchUsed : undefined,
        executionTime: typeof json.executionTime === "string" ? json.executionTime : undefined,
        averageConfidence:
          typeof json.averageConfidence === "number" && Number.isFinite(json.averageConfidence)
            ? Math.round(json.averageConfidence)
            : undefined,
      });
      setSuggestions(next);

      // Persist suggestions for future sessions
      await fetch(`/api/projects/${projectId}/domains/${domain.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ suggestions: next }),
      });
    } catch (error) {
      console.error(error);
      setSuggestionError("Impossible de récupérer de nouvelles suggestions.");
      setSuggestionsMeta(null);
      toast({ title: "Suggestions indisponibles", description: "Réessayez dans quelques minutes." });
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function addCompetitor(name: string) {
    const trimmed = name.trim();
    if (!trimmed || competitors.includes(trimmed)) return;
    setSavingCompetitor(trimmed);
    try {
      const payload = [...new Set([...competitors, trimmed])];
      const res = await fetch(`/api/projects/${projectId}/domains/${domain.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ competitors: payload }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      setCompetitors(payload);
      toast({ title: "Concurrent ajouté", description: trimmed });
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({ title: "Échec", description: "Impossible d'ajouter ce concurrent." });
    } finally {
      setSavingCompetitor(null);
    }
  }

  return (
    <div className="rounded-2xl border p-5 dark:border-zinc-800 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{domain.name}</h3>
          <p className="text-xs text-muted-foreground">
            Mis à jour {formatRelativeTime(domain.updatedAt)} • Créé {formatRelativeTime(domain.createdAt)}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
            competitorHealth.tone === "success"
              ? "bg-emerald-100 text-emerald-700"
              : competitorHealth.tone === "info"
              ? "bg-amber-100 text-amber-700"
              : "bg-rose-100 text-rose-700"
          }`}
        >
          {competitorHealth.tone === "success" ? "🟢" : competitorHealth.tone === "info" ? "🟠" : "🔴"}
          {competitorHealth.label}
        </span>
      </div>

      {notesItems.length > 0 && (
        <div className="rounded-xl border border-dashed p-4 dark:border-zinc-700">
          <h4 className="text-sm font-semibold mb-2">Notes terrain</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
            {notesItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Concurrents suivis ({competitors.length})</h4>
            <DomainEditDialog
              projectId={projectId}
              domain={{
                id: domain.id,
                name: domain.name,
                notes: domain.notes,
                competitors: domain.competitors,
              }}
            />
          </div>

          {competitors.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun concurrent enregistré pour le moment. Utilisez les suggestions IA pour démarrer la veille.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {competitors.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium dark:bg-zinc-800"
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Suggestions IA</h4>
            <button
              onClick={refreshSuggestions}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              {loadingSuggestions ? "Analyse…" : "Mettre à jour"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Génère une short-list automatique à partir des signaux récents. Ajoutez-les en un clic au suivi.
          </p>

          {suggestionError && (
            <p className="mt-2 text-xs text-rose-600">{suggestionError}</p>
          )}

          {suggestions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Aucune suggestion disponible pour l’instant.
            </p>
          ) : (
            <>
              {suggestionsMeta && (
                <div className="mt-3 text-xs text-muted-foreground">
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
              <ul className="mt-3 space-y-3">
                {suggestions.map((item) => {
                  const confidence = displayConfidence(item.confidence);
                  const sourceLabel = describeSource(item.source ?? suggestionsMeta?.source);
                  return (
                    <li
                      key={`${item.name}-${item.website ?? ""}`}
                      className="rounded-lg border border-dashed p-3 text-sm dark:border-zinc-700"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="font-medium leading-tight">{item.name}</p>
                            {item.website && (
                              <a
                                href={item.website}
                                target="_blank"
                                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                                rel="noreferrer"
                              >
                                {item.website}
                              </a>
                            )}
                            {!!item.signals?.length && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {item.signals.map((signal) => (
                                  <span
                                    key={`${item.name}-${signal}`}
                                    className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-[2px] text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                                  >
                                    {signal}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex w-[96px] flex-col items-end gap-1">
                            <div className={`flex items-center gap-1 text-xs ${confidenceTextClass(item.confidence)}`}>
                              <span>Confiance</span>
                              <span className="font-semibold">{confidence}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                              <div
                                className={`${confidenceBarClass(item.confidence)} h-full rounded-full transition-all`}
                                style={{ width: `${Math.max(4, confidence)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        {item.reason && (
                          <p className="text-xs leading-5 text-muted-foreground">{item.reason}</p>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{sourceLabel}</span>
                          <button
                            onClick={() => addCompetitor(item.name)}
                            disabled={savingCompetitor === item.name}
                            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {savingCompetitor === item.name ? "Ajout…" : "Suivre"}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="text-xs text-muted-foreground">
          Piloté depuis {formatRelativeTime(domain.createdAt)}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={del}
            className="inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-700"
          >
            <span>🗑️</span> Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
