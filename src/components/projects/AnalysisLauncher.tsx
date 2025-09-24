"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import AnalysisTabs from "@/components/projects/AnalysisTabs";
import type { AnalysisReport } from "@/types/analysis";

export default function AnalysisLauncher({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/analysis`, {
        method: "POST",
      });

      const text = await res.text();

      let payload: any = null;
      try {
        payload = JSON.parse(text);
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

      setData(payload.parsed as AnalysisReport);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      {!data && (
        <Button onClick={run} disabled={loading}>
          {loading ? "Analyse en cours…" : "Lancer l’analyse"}
        </Button>
      )}

      {error && (
        <p className="text-sm text-red-600 mt-3 whitespace-pre-wrap">
          Erreur : {error}
        </p>
      )}

      {data && <AnalysisTabs data={data} />}
    </div>
  );
}
