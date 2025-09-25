"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import AnalysisTabs from "@/components/projects/AnalysisTabs";
import type { AnalysisReport } from "@/types/analysis";

type AnalysisApiResponse = {
  parsed?: AnalysisReport;
  detailPreview?: string;
  chatPreview?: string;
  detail?: string;
  error?: string;
  [key: string]: unknown;
};

export default function AnalysisLauncher({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

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

        const payload = (await res.json()) as { parsed?: AnalysisReport };
        if (!cancelled && payload?.parsed) {
          setData(payload.parsed);
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

  return (
    <div className="mt-6">
      <Button onClick={run} disabled={loading || initializing}>
        {loading
          ? "Analyse en cours…"
          : data
            ? "Relancer l’analyse"
            : "Lancer l’analyse"}
      </Button>

      {error && (
        <p className="text-sm text-red-600 mt-3 whitespace-pre-wrap">
          Erreur : {error}
        </p>
      )}

      {data && <AnalysisTabs data={data} />}
    </div>
  );
}
