import type { AnalysisReport } from "@/types/analysis";

export type AnalysisRunSummary = {
  generatedAt: string;
  sentiment: AnalysisReport["part1"]["sentimentGlobal"]["label"];
  questionCount: number;
  mentionYes: number;
  mentionRate: number;
  competitorCount: number;
  competitorNames: string[];
};

export function summarizeAnalysis(report: AnalysisReport): AnalysisRunSummary {
  const questionCount = report.part3.questions.length;
  const mentionYes = report.part3.questions.filter((q) => q.mentionProbable === "Oui").length;
  const competitorNames = Array.from(
    new Set(
      report.part3.questions.flatMap((q) =>
        (q.concurrentsCites ?? []).map((name) => name.trim()).filter(Boolean)
      )
    )
  );

  const mentionRate = questionCount === 0 ? 0 : Math.round((mentionYes / questionCount) * 100);

  return {
    generatedAt: report.meta.generatedAt,
    sentiment: report.part1.sentimentGlobal.label,
    questionCount,
    mentionYes,
    mentionRate,
    competitorCount: competitorNames.length,
    competitorNames,
  };
}
