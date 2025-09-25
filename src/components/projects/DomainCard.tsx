"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import DomainEditDialog from "./DomainEditDialog";

type CompetitorSuggestion = {
  name: string;
  website?: string;
  reason?: string;
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

function parseSuggestions(value?: string | null): CompetitorSuggestion[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") return { name: item };
        const name = "name" in item ? String(item.name ?? "").trim() : String(item ?? "").trim();
        if (!name) return null;
        const suggestion: CompetitorSuggestion = { name };
        if ("website" in item && item.website) suggestion.website = String(item.website);
        if ("reason" in item && item.reason) suggestion.reason = String(item.reason);
        return suggestion;
      })
      .filter((item): item is CompetitorSuggestion => Boolean(item));
  } catch {
    return [];
  }
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
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [savingCompetitor, setSavingCompetitor] = useState<string | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

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
    try {
      const res = await fetch(`/api/projects/${projectId}/domains/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "competitors", domainName: domain.name }),
      });
      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }
      const json: { items?: unknown } = await res.json();
      const next: CompetitorSuggestion[] = Array.isArray(json.items)
        ? json.items
            .map((item: unknown) => {
              if (typeof item === "string") {
                const name = item.trim();
                return name ? { name } : null;
              }
              if (item && typeof item === "object") {
                const candidate = item as { name?: unknown; website?: unknown; reason?: unknown };
                const name = String(candidate.name ?? "").trim();
                if (!name) return null;
                return {
                  name,
                  website: candidate.website ? String(candidate.website) : undefined,
                  reason: candidate.reason ? String(candidate.reason) : undefined,
                } satisfies CompetitorSuggestion;
              }
              return null;
            })
            .filter((item): item is CompetitorSuggestion => Boolean(item))
        : [];
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
            <DomainEditDialog projectId={projectId} domain={domain as any} />
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
            <ul className="mt-3 space-y-3">
              {suggestions.map((item) => (
                <li key={item.name} className="rounded-lg border border-dashed p-3 text-sm dark:border-zinc-700">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      {item.website && (
                        <a
                          href={item.website}
                          target="_blank"
                          className="text-xs text-blue-600 hover:underline"
                          rel="noreferrer"
                        >
                          {item.website}
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => addCompetitor(item.name)}
                      disabled={savingCompetitor === item.name}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {savingCompetitor === item.name ? "Ajout…" : "Suivre"}
                    </button>
                  </div>
                  {item.reason && (
                    <p className="mt-2 text-xs text-muted-foreground leading-5">{item.reason}</p>
                  )}
                </li>
              ))}
            </ul>
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
