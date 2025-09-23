"use client";

import { useMemo, useState } from "react";

import type {
  ReputationQuestion,
  ReputationReport,
  ReputationVisibilityAnalysis,
} from "@/lib/reputation-report";
import { sanitizeReputationReport } from "@/lib/reputation-report";

type AnalysisContext = {
  companyName?: string;
  city?: string | null;
  website?: string | null;
  competitors?: string[];
};

type AnalysisState = {
  report: ReputationReport;
  raw?: unknown;
  rawText?: string | null;
  prompt?: string;
  context?: AnalysisContext;
  fetchedAt: number;
};

type AnalysisSuccessResponse = {
  result?: unknown;
  raw?: unknown;
  rawText?: unknown;
  prompt?: unknown;
  context?: unknown;
};

type AnalysisErrorResponse = {
  error?: unknown;
  detail?: unknown;
};

type ProjectAnalysisSectionProps = {
  projectId: string;
  projectName: string;
  websiteUrl?: string | null;
  city?: string | null;
  domainNames?: string[];
};

type QuestionAccordionItem = {
  question: string;
  contexte?: string;
  analysis?: ReputationVisibilityAnalysis;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function sanitizeContext(value: unknown): AnalysisContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const ctx = value as Record<string, unknown>;
  const sanitized: AnalysisContext = {};

  if (typeof ctx.companyName === "string" && ctx.companyName.trim()) {
    sanitized.companyName = ctx.companyName.trim();
  }

  if (typeof ctx.city === "string" || ctx.city === null) {
    sanitized.city = ctx.city as string | null;
  }

  if (typeof ctx.website === "string" && ctx.website.trim()) {
    sanitized.website = ctx.website.trim();
  }

  if (Array.isArray(ctx.competitors)) {
    const competitors = ctx.competitors
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (typeof item === "number") return String(item);
        return null;
      })
      .filter((item): item is string => typeof item === "string" && item.length > 0);
    if (competitors.length > 0) {
      sanitized.competitors = competitors;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function normalizeQuestionText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchQuestions(
  questions: ReputationQuestion[],
  analyses: ReputationVisibilityAnalysis[]
): { items: QuestionAccordionItem[]; leftovers: ReputationVisibilityAnalysis[] } {
  const items: QuestionAccordionItem[] = questions.map((item) => ({
    question: item.question,
    contexte: item.contexte,
  }));

  const used = new Set<number>();
  const normalizedMap = new Map<string, number[]>();

  questions.forEach((item, index) => {
    const norm = normalizeQuestionText(item.question);
    if (!normalizedMap.has(norm)) normalizedMap.set(norm, []);
    normalizedMap.get(norm)!.push(index);
  });

  const leftovers: ReputationVisibilityAnalysis[] = [];

  function attach(index: number, analysis: ReputationVisibilityAnalysis) {
    items[index].analysis = {
      question: analysis.question,
      mentionProbable: analysis.mentionProbable,
      justification: analysis.justification,
      concurrents: [...analysis.concurrents],
      commentaires: analysis.commentaires,
    };
    used.add(index);
  }

  analyses.forEach((analysis) => {
    const norm = normalizeQuestionText(analysis.question);
    const candidates = normalizedMap.get(norm);
    if (candidates) {
      const available = candidates.find((idx) => !used.has(idx));
      if (available !== undefined) {
        attach(available, analysis);
        return;
      }
    }

    const fallback = items.findIndex((item, idx) => {
      if (used.has(idx)) return false;
      const normQuestion = normalizeQuestionText(item.question);
      return normQuestion.includes(norm) || norm.includes(normQuestion);
    });

    if (fallback >= 0) {
      attach(fallback, analysis);
    } else {
      leftovers.push(analysis);
    }
  });

  return { items, leftovers };
}

export default function ProjectAnalysisSection({
  projectId,
  projectName,
  websiteUrl,
  city,
  domainNames,
}: ProjectAnalysisSectionProps) {
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"part1" | "part2" | "part3">("part1");

  const domainSummary = useMemo(() => {
    if (!domainNames || domainNames.length === 0) return "Aucun domaine d&apos;activité renseigné";
    if (domainNames.length <= 3) return domainNames.join(", ");
    return `${domainNames.slice(0, 3).join(", ")} (+${domainNames.length - 3} autres)`;
  }, [domainNames]);

  const questionMatches = useMemo(() => {
    if (!analysis) {
      return { items: [] as QuestionAccordionItem[], leftovers: [] as ReputationVisibilityAnalysis[] };
    }
    return matchQuestions(
      analysis.report.part3.generation.questions,
      analysis.report.part3.visibilite.analyses
    );
  }, [analysis]);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/analysis`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const raw = (await response.json().catch(() => ({}))) as AnalysisSuccessResponse &
        AnalysisErrorResponse;
      if (!response.ok) {
        const message =
          typeof raw.error === "string" && raw.error.trim() ? raw.error : "Échec de l&apos;analyse";
        const detail = typeof raw.detail === "string" && raw.detail.trim() ? raw.detail : undefined;
        throw new Error(detail ? `${message} (${detail})` : message);
      }

      const report = sanitizeReputationReport(raw.result);
      if (!report) {
        throw new Error("Format de rapport inattendu.");
      }

      setAnalysis({
        report,
        raw: raw.raw ?? raw.result,
        rawText: typeof raw.rawText === "string" ? raw.rawText : null,
        prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
        context: sanitizeContext(raw.context),
        fetchedAt: Date.now(),
      });
      setActiveTab("part1");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Analyse de réputation IA</h2>
          <p className="text-sm opacity-70">
            Génère un rapport complet (identité, positionnement, visibilité IA) en utilisant le prompt fourni.
          </p>
          <div className="text-xs opacity-60 space-y-1">
            <div>
              <span className="font-semibold">Entreprise :</span> {projectName}
            </div>
            {city && (
              <div>
                <span className="font-semibold">Ville :</span> {city}
              </div>
            )}
            {websiteUrl && (
              <div>
                <span className="font-semibold">Site :</span> {websiteUrl}
              </div>
            )}
            <div>
              <span className="font-semibold">Domaines d&apos;activité :</span> {domainSummary}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-medium transition",
              "hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800",
              loading && "opacity-70"
            )}
          >
            {loading ? "Analyse en cours..." : "Lancer l&apos;analyse"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {analysis ? (
        <div className="rounded-2xl border p-4 space-y-4 dark:border-zinc-800">
          <div className="text-xs opacity-60">Rapport généré le {new Date(analysis.fetchedAt).toLocaleString()}</div>

          <div className="flex flex-wrap gap-2 border-b pb-3">
            <button
              type="button"
              onClick={() => setActiveTab("part1")}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm",
                activeTab === "part1"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              )}
            >
              Partie 1
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("part2")}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm",
                activeTab === "part2"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              )}
            >
              Partie 2
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("part3")}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm",
                activeTab === "part3"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              )}
            >
              Partie 3
            </button>
          </div>

          {activeTab === "part1" && (
            <div className="space-y-6">
              <section className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide">1.1 Synthèse de l&apos;identité</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {analysis.report.part1.syntheseIdentite.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </section>

              <section className="space-y-3">
                <div className="text-sm font-semibold uppercase tracking-wide">1.2 Nuage de mots pondéré</div>
                <div className="flex flex-wrap gap-2">
                  {analysis.report.part1.nuageMots
                    .slice()
                    .sort((a, b) => b.poids - a.poids)
                    .map((entry) => (
                      <span
                        key={`${entry.mot}-${entry.poids}`}
                        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs dark:border-zinc-700"
                      >
                        <span className="font-medium">{entry.mot}</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold dark:bg-zinc-800">
                          {Math.round(entry.poids)}
                        </span>
                      </span>
                    ))}
                </div>
              </section>

              <section className="space-y-2">
                <div className="text-sm font-semibold uppercase tracking-wide">1.3 Analyse de sentiment global</div>
                <div className="rounded-xl bg-gray-50 p-3 text-sm leading-6 dark:bg-zinc-900">
                  <div>
                    <span className="font-semibold">Évaluation :</span> {analysis.report.part1.sentimentGlobal.evaluation}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">
                    <span className="font-semibold">Justification :</span> {analysis.report.part1.sentimentGlobal.justification}
                  </div>
                  {analysis.report.part1.sentimentGlobal.exemples && (
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {analysis.report.part1.sentimentGlobal.exemples.map((exemple, idx) => (
                        <li key={idx}>{exemple}</li>
                      ))}
                    </ul>
                  )}
                  {analysis.report.part1.sentimentGlobal.details && (
                    <div className="mt-2 text-xs opacity-70">
                      {analysis.report.part1.sentimentGlobal.details}
                    </div>
                  )}
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-semibold uppercase tracking-wide">1.4 Forces perçues</div>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {analysis.report.part1.forces.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold uppercase tracking-wide">1.4 Faiblesses perçues</div>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {analysis.report.part1.faiblesses.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="space-y-2">
                <div className="text-sm font-semibold uppercase tracking-wide">1.5 Sujets de discussion</div>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {analysis.report.part1.sujets.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="space-y-2">
                <div className="text-sm font-semibold uppercase tracking-wide">1.6 Pistes d&apos;amélioration</div>
                <div className="space-y-3">
                  {analysis.report.part1.recommandations.map((item, idx) => (
                    <div key={idx} className="rounded-xl border p-3 text-sm dark:border-zinc-800">
                      <div>
                        <span className="font-semibold">Faiblesse :</span> {item.faiblesse}
                      </div>
                      <div className="mt-1">
                        <span className="font-semibold">Action recommandée :</span> {item.action}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === "part2" && (
            <div className="space-y-4">
              {analysis.report.part2 ? (
                <>
                  {analysis.report.part2.resume && (
                    <div className="rounded-xl bg-gray-50 p-3 text-sm leading-6 dark:bg-zinc-900">
                      {analysis.report.part2.resume}
                    </div>
                  )}
                  {analysis.report.part2.details && analysis.report.part2.details.length > 0 ? (
                    <div className="grid gap-3">
                      {analysis.report.part2.details.map((detail, idx) => (
                        <div key={idx} className="rounded-xl border p-3 text-sm space-y-2 dark:border-zinc-800">
                          {detail.acteur && (
                            <div>
                              <span className="font-semibold">Acteur :</span> {detail.acteur}
                            </div>
                          )}
                          {detail.sentiment && (
                            <div>
                              <span className="font-semibold">Sentiment :</span> {detail.sentiment}
                            </div>
                          )}
                          {detail.specialites && (
                            <div>
                              <span className="font-semibold">Spécialités perçues :</span> {detail.specialites}
                            </div>
                          )}
                          {detail.pointsForts && detail.pointsForts.length > 0 && (
                            <div>
                              <div className="font-semibold">Points forts mis en avant :</div>
                              <ul className="mt-1 list-disc space-y-1 pl-5">
                                {detail.pointsForts.map((item, index) => (
                                  <li key={index}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {detail.faiblesses && detail.faiblesses.length > 0 && (
                            <div>
                              <div className="font-semibold">Faiblesses mentionnées :</div>
                              <ul className="mt-1 list-disc space-y-1 pl-5">
                                {detail.faiblesses.map((item, index) => (
                                  <li key={index}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {detail.commentaires && (
                            <div className="text-xs opacity-70">{detail.commentaires}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed p-3 text-sm opacity-70 dark:border-zinc-800">
                      Aucun détail concurrentiel supplémentaire fourni.
                    </div>
                  )}
                </>
              ) : (
                  <div className="rounded-xl border border-dashed p-3 text-sm opacity-70 dark:border-zinc-800">
                    Aucun concurrent n&apos;a été renseigné pour générer cette partie.
                  </div>
              )}
            </div>
          )}

          {activeTab === "part3" && (
            <div className="space-y-5">
              {analysis.report.part3.introduction && (
                <div className="text-sm opacity-80 whitespace-pre-wrap">
                  {analysis.report.part3.introduction}
                </div>
              )}

              <section className="space-y-3">
                <div className="text-sm font-semibold uppercase tracking-wide">3.1 Génération de questions</div>
                {analysis.report.part3.generation.introduction && (
                  <div className="text-sm opacity-80 whitespace-pre-wrap">
                    {analysis.report.part3.generation.introduction}
                  </div>
                )}
                {questionMatches.items.length ? (
                  <div className="space-y-2">
                    {questionMatches.items.map((item, index) => (
                      <details
                        key={`${index}-${item.question.slice(0, 30)}`}
                        className="group rounded-xl border p-3 transition dark:border-zinc-800"
                      >
                        <summary className="cursor-pointer select-none text-sm font-semibold">
                          <span className="mr-2 text-xs opacity-60">Q{index + 1}</span>
                          {item.question}
                        </summary>
                        <div className="mt-3 space-y-2 text-sm">
                          {item.contexte && (
                            <div className="text-xs italic opacity-70">Contexte : {item.contexte}</div>
                          )}
                          {item.analysis ? (
                            <>
                              <div>
                                <span className="font-semibold">Mention probable :</span> {item.analysis.mentionProbable}
                              </div>
                              <div>
                                <span className="font-semibold">Justification :</span> {item.analysis.justification}
                              </div>
                              <div>
                                <span className="font-semibold">Concurrents cités :</span>
                                {item.analysis.concurrents.length ? (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {item.analysis.concurrents.map((competitor, idx) => (
                                      <span
                                        key={idx}
                                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
                                      >
                                        {competitor}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="ml-1 opacity-70">Aucun</span>
                                )}
                              </div>
                              {item.analysis.commentaires && (
                                <div className="text-xs opacity-70">
                                  {item.analysis.commentaires}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="opacity-70">
                              Analyse de visibilité non disponible pour cette question.
                            </div>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-3 text-sm opacity-70 dark:border-zinc-800">
                    Impossible d&apos;extraire les questions depuis la réponse générée.
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="text-sm font-semibold uppercase tracking-wide">3.2 Analyse de visibilité</div>
                {analysis.report.part3.visibilite.introduction && (
                  <div className="text-sm opacity-80 whitespace-pre-wrap">
                    {analysis.report.part3.visibilite.introduction}
                  </div>
                )}
                {questionMatches.leftovers.length > 0 && (
                  <details className="rounded-xl border p-3 text-xs opacity-80 dark:border-zinc-800">
                    <summary className="cursor-pointer select-none font-semibold">
                      Analyses supplémentaires non associées
                    </summary>
                    <div className="mt-2 space-y-2">
                      {questionMatches.leftovers.map((analysisItem, idx) => (
                        <div key={idx} className="space-y-1 rounded-lg bg-gray-50 p-3 dark:bg-zinc-900">
                          <div className="text-sm font-semibold">{analysisItem.question}</div>
                          <div>
                            <span className="font-semibold">Mention probable :</span> {analysisItem.mentionProbable}
                          </div>
                          <div>
                            <span className="font-semibold">Justification :</span> {analysisItem.justification}
                          </div>
                          <div>
                            <span className="font-semibold">Concurrents cités :</span>{" "}
                            {analysisItem.concurrents.join(", ") || "Aucun"}
                          </div>
                          {analysisItem.commentaires && (
                            <div className="text-xs opacity-70">{analysisItem.commentaires}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </section>
            </div>
          )}

          {analysis.context && (
            <div className="rounded-xl bg-gray-50 p-3 text-xs leading-5 dark:bg-zinc-900">
              <div className="font-semibold">Paramètres utilisés</div>
              <div>
                <span className="font-semibold">Entreprise :</span> {analysis.context.companyName ?? projectName}
              </div>
              {analysis.context.city && (
                <div>
                  <span className="font-semibold">Ville :</span> {analysis.context.city}
                </div>
              )}
              {analysis.context.website && (
                <div>
                  <span className="font-semibold">Site :</span> {analysis.context.website}
                </div>
              )}
              <div>
                <span className="font-semibold">Concurrents pris en compte :</span>{" "}
                {analysis.context.competitors && analysis.context.competitors.length > 0
                  ? analysis.context.competitors.join(", ")
                  : "Aucun"}
              </div>
            </div>
          )}

          <details className="text-xs opacity-70">
            <summary className="cursor-pointer select-none font-semibold">Afficher les données brutes</summary>
            {analysis.rawText && (
              <>
                <div className="mt-2 font-semibold">Texte renvoyé par l&apos;API</div>
                <pre className="mt-1 whitespace-pre-wrap rounded-xl bg-gray-100 p-3 dark:bg-zinc-900">
                  {analysis.rawText}
                </pre>
              </>
            )}
            <div className="mt-4 font-semibold">JSON structuré</div>
            <pre className="mt-1 overflow-x-auto rounded-xl bg-gray-100 p-3 dark:bg-zinc-900">
              {JSON.stringify(analysis.raw ?? analysis.report, null, 2)}
            </pre>
            {analysis.prompt && (
              <>
                <div className="mt-4 font-semibold">Prompt utilisé</div>
                <pre className="mt-1 whitespace-pre-wrap rounded-xl bg-gray-100 p-3 dark:bg-zinc-900">
                  {analysis.prompt}
                </pre>
              </>
            )}
          </details>

          <div className="border-t pt-3 text-xs opacity-70 whitespace-pre-wrap">
            {analysis.report.notice}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed p-6 text-center text-sm opacity-70 dark:border-zinc-800">
          Lancez l&apos;analyse pour générer le rapport structuré.
        </div>
      )}
    </section>
  );
}
