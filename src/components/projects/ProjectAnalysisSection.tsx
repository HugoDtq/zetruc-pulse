"use client";

import { useMemo, useState } from "react";

type QuestionAnalysis = {
  mention?: string;
  justification?: string;
  competitors?: string;
  extras?: string[];
  raw: string;
};

type QuestionItem = {
  question: string;
  analysis?: QuestionAnalysis;
};

type ParsedReport = {
  raw: string;
  part1?: string;
  part2?: string;
  part3Intro?: string;
  questionIntro?: string;
  analysisIntro?: string;
  part31Raw?: string;
  part32Raw?: string;
  questions: QuestionItem[];
  leftoverAnalyses: string[];
  notice?: string;
};

type AnalysisState = {
  parsed: ParsedReport;
  prompt?: string;
  context?: {
    companyName?: string;
    city?: string | null;
    website?: string | null;
    competitors?: string[];
  };
  fetchedAt: number;
};

type AnalysisSuccessResponse = {
  result?: unknown;
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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeNewlines(text: string) {
  return text.replace(/\r\n/g, "\n");
}

function splitSections(raw: string) {
  const normalized = normalizeNewlines(raw).trim();
  let body = normalized;
  let notice = "";
  const noticeRegex = /Ce rapport est une synthèse générée par une IA[\s\S]*$/i;
  const noticeMatch = body.match(noticeRegex);
  if (noticeMatch && noticeMatch.index !== undefined) {
    notice = noticeMatch[0].trim();
    body = body.slice(0, noticeMatch.index).trim();
  }

  const sections: Record<string, string> = {};
  const regex = /Partie\s+(\d)[\s\S]*?(?=Partie\s+\d|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    sections[match[1]] = match[0].trim();
  }

  const idxPart1 = body.search(/Partie\s+1/i);
  if (idxPart1 > 0) {
    const preface = body.slice(0, idxPart1).trim();
    if (preface) {
      const part1 = sections["1"] ?? body.slice(idxPart1).trim();
      sections["1"] = `${preface}\n\n${part1}`.trim();
    }
  }

  if (!sections["1"] && body) {
    sections["1"] = body;
  }

  return { sections, notice };
}

function splitPart3(section?: string) {
  if (!section) {
    return { intro: "", subsections: {} as Record<string, string> };
  }
  const normalized = normalizeNewlines(section).trim();
  const idx31 = normalized.search(/3\.1/i);
  let intro = "";
  let body = normalized;
  if (idx31 > 0) {
    intro = normalized.slice(0, idx31).trim();
    body = normalized.slice(idx31).trim();
  }

  const subsections: Record<string, string> = {};
  const regex = /3\.(\d)[\s\S]*?(?=3\.\d|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    subsections[match[1]] = match[0].trim();
  }

  if (!subsections["1"] && body) {
    subsections["1"] = body;
  }

  return { intro, subsections };
}

type ParsedQuestions = {
  intro?: string;
  questions: string[];
  raw?: string;
};

type ParsedAnalysis = {
  question?: string;
  mention?: string;
  justification?: string;
  competitors?: string;
  extras?: string[];
  raw: string;
  matched?: boolean;
};

type ParsedAnalyses = {
  intro?: string;
  analyses: ParsedAnalysis[];
  raw?: string;
};

function extractQuestions(section?: string): ParsedQuestions {
  if (!section) return { questions: [], raw: section };
  const normalized = normalizeNewlines(section).trim();
  const withoutHeader = normalized.replace(/^3\.1[^\n]*\n?/, "").trim();
  const lines = withoutHeader.split("\n");
  const introParts: string[] = [];
  const questions: string[] = [];
  let current: string | null = null;
  const questionStart = /^((?:\d+[\).\-\s]*)|(?:[-*•]\s+)|(?:Q\d+[:.)-]+))\s*(.+)/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) {
        questions.push(current.trim());
        current = null;
      }
      continue;
    }
    const match = trimmed.match(questionStart);
    if (match) {
      if (current) {
        questions.push(current.trim());
      }
      current = match[2].trim();
    } else if (current) {
      current = `${current} ${trimmed}`;
    } else {
      introParts.push(trimmed);
    }
  }
  if (current) {
    questions.push(current.trim());
  }

  const cleaned = questions
    .map((q) => q.replace(/\s+/g, " ").trim())
    .filter((q, idx, arr) => q && arr.indexOf(q) === idx);

  const intro = introParts.join(" ").trim();

  return { intro: intro || undefined, questions: cleaned, raw: normalized };
}

function extractAnalyses(section?: string): ParsedAnalyses {
  if (!section) return { analyses: [], raw: section };
  const normalized = normalizeNewlines(section).trim();
  const withoutHeader = normalized.replace(/^3\.2[^\n]*\n?/, "").trim();
  const blocks = withoutHeader.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);

  const analyses: ParsedAnalysis[] = [];
  const introParts: string[] = [];
  let seenAnalysis = false;

  for (const block of blocks) {
    const hasKeywords = /Mention probable|Justification|Concurrents?/i.test(block);
    if (!hasKeywords && !seenAnalysis) {
      introParts.push(block);
      continue;
    }
    seenAnalysis = true;

    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    let questionLine = "";
    const restLines: string[] = [];

    for (const line of lines) {
      const cleanLine = line.replace(/^[-*•]\s*/, "").trim();
      if (!questionLine) {
        if (/^(mention probable|justification|concurr)/i.test(cleanLine)) {
          restLines.push(cleanLine);
          continue;
        }
        const match = cleanLine.match(/^((?:\d+[\).\-\s]*)|(?:Q\d+[:.)-]+))\s*(.+)/i);
        questionLine = match ? match[2].trim() : cleanLine;
      } else {
        restLines.push(cleanLine);
      }
    }

    const extras: string[] = [];
    let mention: string | undefined;
    let justification: string | undefined;
    let competitors: string | undefined;

    for (const line of restLines) {
      const lower = line.toLowerCase();
      if (lower.startsWith("mention probable")) {
        const value = line.split(/[:\-–]/).slice(1).join(":").trim();
        if (value) mention = value;
      } else if (lower.startsWith("justification")) {
        const value = line.split(/[:\-–]/).slice(1).join(":").trim();
        if (value) justification = value;
      } else if (lower.startsWith("concurr")) {
        const value = line.split(/[:\-–]/).slice(1).join(":").trim();
        if (value) competitors = value;
      } else if (line) {
        extras.push(line);
      }
    }

    analyses.push({
      question: questionLine || undefined,
      mention,
      justification,
      competitors,
      extras: extras.length ? extras : undefined,
      raw: block,
    });
  }

  const intro = introParts.join("\n\n").trim();

  return { intro: intro || undefined, analyses, raw: withoutHeader };
}

function normalizeQuestionText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchQuestions(questions: string[], analyses: ParsedAnalysis[]) {
  const items: QuestionItem[] = questions.map((question) => ({ question }));
  const used = new Set<number>();

  function attach(index: number, analysis: ParsedAnalysis) {
    items[index].analysis = {
      mention: analysis.mention,
      justification: analysis.justification,
      competitors: analysis.competitors,
      extras: analysis.extras,
      raw: analysis.raw,
    };
    used.add(index);
    analysis.matched = true;
  }

  const normalizedMap = new Map<string, number[]>();
  questions.forEach((question, index) => {
    const norm = normalizeQuestionText(question);
    if (!normalizedMap.has(norm)) normalizedMap.set(norm, []);
    normalizedMap.get(norm)!.push(index);
  });

  analyses.forEach((analysis) => {
    if (!analysis.question) return;
    const norm = normalizeQuestionText(analysis.question);
    const indexes = normalizedMap.get(norm);
    if (indexes) {
      const available = indexes.find((idx) => !used.has(idx));
      if (available !== undefined) {
        attach(available, analysis);
        return;
      }
    }
    const fallback = questions.findIndex((question, idx) => {
      if (used.has(idx)) return false;
      const normQuestion = normalizeQuestionText(question);
      return normQuestion.includes(norm) || norm.includes(normQuestion);
    });
    if (fallback >= 0) {
      attach(fallback, analysis);
    }
  });

  analyses.forEach((analysis) => {
    if (analysis.matched) return;
    const idx = questions.findIndex((_, index) => !used.has(index));
    if (idx >= 0) attach(idx, analysis);
  });

  const leftovers = analyses
    .filter((analysis) => !analysis.matched)
    .map((analysis) => analysis.raw)
    .filter(Boolean);

  return { items, leftovers };
}

function parseReport(raw: string): ParsedReport {
  const { sections, notice } = splitSections(raw);
  const part1 = sections["1"]?.trim();
  const part2 = sections["2"]?.trim();
  const part3 = sections["3"]?.trim();

  const { intro: part3Intro, subsections } = splitPart3(part3);
  const questionsSection = subsections["1"];
  const analysesSection = subsections["2"];

  const parsedQuestions = extractQuestions(questionsSection);
  const parsedAnalyses = extractAnalyses(analysesSection);
  const { items, leftovers } = matchQuestions(parsedQuestions.questions, parsedAnalyses.analyses);

  return {
    raw,
    part1,
    part2,
    part3Intro: part3Intro || undefined,
    questionIntro: parsedQuestions.intro,
    analysisIntro: parsedAnalyses.intro,
    part31Raw: parsedQuestions.raw,
    part32Raw: analysesSection,
    questions: items,
    leftoverAnalyses: leftovers,
    notice: notice || undefined,
  };
}

function sanitizeContext(value: unknown): AnalysisState["context"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const ctx = value as Record<string, unknown>;
  const sanitized: AnalysisState["context"] = {};

  if (typeof ctx.companyName === "string" && ctx.companyName.trim()) {
    sanitized.companyName = ctx.companyName;
  }

  if (typeof ctx.city === "string" || ctx.city === null) {
    sanitized.city = ctx.city as string | null;
  }

  if (typeof ctx.website === "string" && ctx.website.trim()) {
    sanitized.website = ctx.website;
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

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/analysis`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const raw = (await response.json().catch(() => ({}))) as AnalysisSuccessResponse & AnalysisErrorResponse;
      if (!response.ok) {
        const message = typeof raw.error === "string" && raw.error.trim() ? raw.error : "Échec de l'analyse";
        const detail = typeof raw.detail === "string" && raw.detail.trim() ? raw.detail : undefined;
        throw new Error(detail ? `${message} (${detail})` : message);
      }

      const resultText = typeof raw.result === "string" ? raw.result : "";
      if (!resultText.trim()) {
        throw new Error("La réponse de l'IA est vide.");
      }
      const parsed = parseReport(resultText);
      setAnalysis({
        parsed,
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
          <div className="text-xs opacity-60">
            <div><span className="font-semibold">Entreprise :</span> {projectName}</div>
            {city && <div><span className="font-semibold">Ville :</span> {city}</div>}
            {websiteUrl && <div><span className="font-semibold">Site :</span> {websiteUrl}</div>}
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
        <div className="rounded-2xl border p-4 dark:border-zinc-800">
          <div className="mb-3 text-xs opacity-60">
            Rapport généré le {new Date(analysis.fetchedAt).toLocaleString()}
          </div>
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

          <div className="mt-4 text-sm leading-6">
            {activeTab === "part1" && (
              <div className="whitespace-pre-wrap">{analysis.parsed.part1 ?? "Aucune donnée pour cette section."}</div>
            )}
            {activeTab === "part2" && (
              <div className="whitespace-pre-wrap">
                {analysis.parsed.part2 && analysis.parsed.part2.trim()
                  ? analysis.parsed.part2
                  : "Aucune comparaison concurrentielle fournie (vérifiez que des concurrents sont renseignés)."}
              </div>
            )}
            {activeTab === "part3" && (
              <div className="space-y-4">
                {analysis.parsed.part3Intro && (
                  <div className="whitespace-pre-wrap">{analysis.parsed.part3Intro}</div>
                )}
                {analysis.parsed.questionIntro && (
                  <div className="whitespace-pre-wrap">{analysis.parsed.questionIntro}</div>
                )}
                {analysis.parsed.questions.length ? (
                  <div className="space-y-2">
                    {analysis.parsed.questions.map((item, index) => (
                      <details
                        key={`${index}-${item.question.slice(0, 30)}`}
                        className="group rounded-xl border p-3 transition dark:border-zinc-800"
                      >
                        <summary className="cursor-pointer select-none text-sm font-semibold">
                          <span className="mr-2 text-xs opacity-60">Q{index + 1}</span>
                          {item.question}
                        </summary>
                        <div className="mt-3 space-y-2 text-sm">
                          {item.analysis ? (
                            <>
                              {item.analysis.mention && (
                                <div>
                                  <span className="font-semibold">Mention probable :</span> {item.analysis.mention}
                                </div>
                              )}
                              {item.analysis.justification && (
                                <div>
                                  <span className="font-semibold">Justification :</span> {item.analysis.justification}
                                </div>
                              )}
                              {item.analysis.competitors && (
                                <div>
                                  <span className="font-semibold">Concurrents cités :</span> {item.analysis.competitors}
                                </div>
                              )}
                              {item.analysis.extras?.map((extra, idx) => (
                                <div key={idx} className="opacity-80">
                                  {extra}
                                </div>
                              ))}
                              {!item.analysis.mention &&
                                !item.analysis.justification &&
                                !item.analysis.competitors && (
                                  <div className="opacity-80 whitespace-pre-wrap">{item.analysis.raw}</div>
                                )}
                            </>
                          ) : (
                            <div className="opacity-70">Analyse de visibilité non disponible pour cette question.</div>
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
                {analysis.parsed.analysisIntro && (
                  <div className="whitespace-pre-wrap text-xs opacity-70">
                    {analysis.parsed.analysisIntro}
                  </div>
                )}
                {analysis.parsed.leftoverAnalyses.length > 0 && (
                  <details className="rounded-xl border p-3 text-xs opacity-80 dark:border-zinc-800">
                    <summary className="cursor-pointer select-none font-semibold">
                      Analyses supplémentaires non associées
                    </summary>
                    <div className="mt-2 space-y-2">
                      {analysis.parsed.leftoverAnalyses.map((block, idx) => (
                        <div key={idx} className="whitespace-pre-wrap">
                          {block}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          {analysis.context && (
            <div className="mt-6 rounded-xl bg-gray-50 p-3 text-xs leading-5 dark:bg-zinc-900">
              <div className="font-semibold">Paramètres utilisés</div>
              <div><span className="font-semibold">Entreprise :</span> {analysis.context.companyName ?? projectName}</div>
              {analysis.context.city && <div><span className="font-semibold">Ville :</span> {analysis.context.city}</div>}
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

          <details className="mt-4 text-xs opacity-70">
            <summary className="cursor-pointer select-none font-semibold">Afficher la réponse brute</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-100 p-3 dark:bg-zinc-900">
              {analysis.parsed.raw}
            </pre>
            {analysis.prompt && (
              <>
                <div className="mt-4 font-semibold">Prompt utilisé :</div>
                <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-100 p-3 dark:bg-zinc-900">
                  {analysis.prompt}
                </pre>
              </>
            )}
          </details>

          {analysis.parsed.notice && (
            <div className="mt-6 border-t pt-3 text-xs opacity-70">
              {analysis.parsed.notice}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed p-6 text-center text-sm opacity-70 dark:border-zinc-800">
          Lancez l&apos;analyse pour générer le rapport structuré.
        </div>
      )}
    </section>
  );
}
