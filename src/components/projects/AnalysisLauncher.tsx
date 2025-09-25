"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import AnalysisTabs from "@/components/projects/AnalysisTabs";
import type { AnalysisReport } from "@/types/analysis";
import { summarizeAnalysis, type AnalysisRunSummary } from "@/lib/analysisSummary";

type AnalysisHistoryItem = {
  id: string;
  createdAt: string;
  summary: AnalysisRunSummary;
};

type AnalysisApiResponse = {
  parsed?: AnalysisReport;
  detailPreview?: string;
  chatPreview?: string;
  detail?: string;
  error?: string;
  createdAt?: string;
  history?: AnalysisHistoryItem[];
  run?: AnalysisHistoryItem;
  [key: string]: unknown;
};

export default function AnalysisLauncher({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchExisting() {
      try {
        const res = await fetch(`/api/projects/${projectId}/analysis`, {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          if (res.status === 404) return;
          throw new Error(`Impossible de récupérer l'analyse (${res.status})`);
        }

        const payload = (await res.json()) as AnalysisApiResponse;
        if (cancelled) return;

        if (payload?.parsed) {
          setData(payload.parsed);
        }
        if (payload?.history) {
          setHistory(payload.history);
        }
        if (payload?.createdAt) {
          setLastRunAt(payload.createdAt);
        } else if (payload?.history?.length) {
          setLastRunAt(payload.history[0].createdAt);
        }
      } catch (error: unknown) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    }

    fetchExisting();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function run() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/analysis`, {
        method: "POST",
      });

      const text = await res.text();
      let payload: AnalysisApiResponse | null = null;

      try {
        payload = JSON.parse(text) as AnalysisApiResponse;
      } catch {
        throw new Error(
          `La réponse n'est pas un JSON valide.\nStatus: ${res.status}\nAperçu:\n${text.slice(
            0,
            600
          )}`
        );
      }

      if (!res.ok) {
        const detail =
          payload?.detailPreview ||
          payload?.chatPreview ||
          payload?.detail ||
          payload?.error ||
          JSON.stringify(payload).slice(0, 600);

        throw new Error(`API error (${res.status}): ${detail}`);
      }

      if (!payload?.parsed) {
        throw new Error(
          `Réponse inattendue: manque "parsed". Aperçu: ${JSON.stringify(payload).slice(0, 400)}`
        );
      }

      setData(payload.parsed);
      if (payload.run) {
        setHistory((prev) => {
          const next = [payload.run, ...prev.filter((item) => item.id !== payload.run?.id)];
          return next.slice(0, 5);
        });
        setLastRunAt(payload.run.createdAt);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError(String(error));
      }
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => (data ? summarizeAnalysis(data) : null), [data]);

  function formatDateTime(iso?: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-2xl border p-5 dark:border-zinc-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Moteur d’analyse IA</p>
            <h3 className="text-lg font-semibold">
              {summary ? `Dernière exécution : ${formatDateTime(summary.generatedAt)}` : "Aucune analyse disponible"}
            </h3>
            {lastRunAt && (
              <p className="text-xs text-muted-foreground">Enregistrée le {formatDateTime(lastRunAt)}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={run} disabled={loading || initializing}>
              {loading ? "Analyse en cours…" : data ? "Relancer l’analyse" : "Lancer l’analyse"}
            </Button>
          </div>
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground">Collecte des signaux et génération de la synthèse…</p>
        )}

        {error && (
          <p className="text-sm text-red-600 whitespace-pre-wrap">Erreur : {error}</p>
        )}

        {history.length > 1 && (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div>
              {history.length} analyses archivées • dernière relance : {formatDateTime(history[0]?.createdAt)}
            </div>
            <div>
              Taux moyen de mentions :
              {" "}
              {Math.round(
                history.reduce((acc, item) => acc + (item.summary.mentionRate ?? 0), 0) / history.length
              )}
              %
            </div>
          </div>
        )}
      </div>

      {summary && data && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Sentiment global"
              value={summary.sentiment}
              tone={
                summary.sentiment === "Positive"
                  ? "positive"
                  : summary.sentiment === "Négative"
                  ? "negative"
                  : summary.sentiment === "Mixte"
                  ? "mixed"
                  : "neutral"
              }
              helper={data.part1.sentimentGlobal.justification}
            />
            <MetricCard
              label="Questions analysées"
              value={`${summary.questionCount}`}
              helper={`${summary.mentionYes} évoquent la marque (${summary.mentionRate}% de présence)`}
            />
            <MetricCard
              label="Concurrents détectés"
              value={`${summary.competitorCount}`}
              helper={summary.competitorNames.length ? summary.competitorNames.join(", ") : "—"}
            />
            <MetricCard
              label="Prochaine action recommandée"
              value={data.part1.recommandations[0] ?? "—"}
              helper={data.part1.recommandations[1] ?? ""}
            />
          </div>

          {history.length > 0 && (
            <div className="rounded-2xl border p-5 dark:border-zinc-800">
              <h4 className="text-sm font-semibold">Historique des analyses</h4>
              <ul className="mt-3 space-y-3 text-sm">
                {history.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{formatDateTime(item.summary.generatedAt)}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.summary.mentionRate}% de visibilité • {item.summary.competitorCount} concurrents cités
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {item.summary.sentiment}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AnalysisTabs data={data} />
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "neutral" | "positive" | "negative" | "mixed";
}) {
  const base =
    tone === "positive"
      ? "border-emerald-200 bg-emerald-50/60 text-emerald-900"
      : tone === "negative"
      ? "border-rose-200 bg-rose-50/60 text-rose-900"
      : tone === "mixed"
      ? "border-amber-200 bg-amber-50/60 text-amber-900"
      : "border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";

  return (
    <div className={`rounded-2xl border p-4 transition ${base}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
      {helper && <p className="mt-1 text-xs text-muted-foreground leading-5">{helper}</p>}
    </div>
  );
}
