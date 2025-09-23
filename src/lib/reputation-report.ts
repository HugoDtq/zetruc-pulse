export type WordCloudEntry = {
  mot: string;
  poids: number;
};

export type ReputationRecommendation = {
  faiblesse: string;
  action: string;
};

export type ReputationSentiment = {
  evaluation: string;
  justification: string;
  exemples?: string[];
  details?: string;
};

export type ReputationPart1 = {
  syntheseIdentite: string[];
  nuageMots: WordCloudEntry[];
  sentimentGlobal: ReputationSentiment;
  forces: string[];
  faiblesses: string[];
  sujets: string[];
  recommandations: ReputationRecommendation[];
};

export type ReputationPart2Detail = {
  acteur?: string;
  sentiment?: string;
  specialites?: string;
  pointsForts?: string[];
  faiblesses?: string[];
  commentaires?: string;
};

export type ReputationPart2 = {
  resume?: string;
  details?: ReputationPart2Detail[];
};

export type ReputationQuestion = {
  question: string;
  contexte?: string;
};

export type ReputationVisibilityAnalysis = {
  question: string;
  mentionProbable: string;
  justification: string;
  concurrents: string[];
  commentaires?: string;
};

export type ReputationPart3 = {
  introduction?: string;
  generation: {
    introduction?: string;
    questions: ReputationQuestion[];
  };
  visibilite: {
    introduction?: string;
    analyses: ReputationVisibilityAnalysis[];
  };
};

export type ReputationReport = {
  part1: ReputationPart1;
  part2?: ReputationPart2;
  part3: ReputationPart3;
  notice: string;
};

export const REPUTATION_ANALYSIS_JSON_SCHEMA = {
  name: "reputation_analysis",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["part1", "part3", "notice"],
    properties: {
      part1: {
        type: "object",
        additionalProperties: false,
        required: [
          "syntheseIdentite",
          "nuageMots",
          "sentimentGlobal",
          "forces",
          "faiblesses",
          "sujets",
          "recommandations",
        ],
        properties: {
          syntheseIdentite: {
            type: "array",
            minItems: 3,
            items: { type: "string" },
          },
          nuageMots: {
            type: "array",
            minItems: 10,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["mot", "poids"],
              properties: {
                mot: { type: "string" },
                poids: { type: "number" },
              },
            },
          },
          sentimentGlobal: {
            type: "object",
            additionalProperties: false,
            required: ["evaluation", "justification"],
            properties: {
              evaluation: { type: "string" },
              justification: { type: "string" },
              exemples: {
                type: "array",
                items: { type: "string" },
              },
              details: { type: "string" },
            },
          },
          forces: {
            type: "array",
            minItems: 1,
            items: { type: "string" },
          },
          faiblesses: {
            type: "array",
            minItems: 1,
            items: { type: "string" },
          },
          sujets: {
            type: "array",
            minItems: 1,
            items: { type: "string" },
          },
          recommandations: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["faiblesse", "action"],
              properties: {
                faiblesse: { type: "string" },
                action: { type: "string" },
              },
            },
          },
        },
      },
      part2: {
        type: "object",
        additionalProperties: false,
        properties: {
          resume: { type: "string" },
          details: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                acteur: { type: "string" },
                sentiment: { type: "string" },
                specialites: { type: "string" },
                pointsForts: {
                  type: "array",
                  items: { type: "string" },
                },
                faiblesses: {
                  type: "array",
                  items: { type: "string" },
                },
                commentaires: { type: "string" },
              },
            },
          },
        },
      },
      part3: {
        type: "object",
        additionalProperties: false,
        required: ["generation", "visibilite"],
        properties: {
          introduction: { type: "string" },
          generation: {
            type: "object",
            additionalProperties: false,
            required: ["questions"],
            properties: {
              introduction: { type: "string" },
              questions: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["question"],
                  properties: {
                    question: { type: "string" },
                    contexte: { type: "string" },
                  },
                },
              },
            },
          },
          visibilite: {
            type: "object",
            additionalProperties: false,
            required: ["analyses"],
            properties: {
              introduction: { type: "string" },
              analyses: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["question", "mentionProbable", "justification", "concurrents"],
                  properties: {
                    question: { type: "string" },
                    mentionProbable: { type: "string" },
                    justification: { type: "string" },
                    concurrents: {
                      type: "array",
                      items: { type: "string" },
                    },
                    commentaires: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      notice: { type: "string" },
    },
  },
} as const;

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  return result.length > 0 ? result : undefined;
}

function sanitizeWordCloud(value: unknown): WordCloudEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: WordCloudEntry[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const mot = asString(obj.mot);
    if (!mot) continue;
    const poidsRaw = obj.poids;
    const poids = typeof poidsRaw === "number" ? poidsRaw : typeof poidsRaw === "string" ? Number(poidsRaw) : NaN;
    if (!Number.isFinite(poids)) continue;
    const clamped = Math.max(0, Math.min(100, poids));
    items.push({ mot, poids: clamped });
  }
  return items.length > 0 ? items : undefined;
}

function sanitizeRecommendations(value: unknown): ReputationRecommendation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: ReputationRecommendation[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const faiblesse = asString(obj.faiblesse);
    const action = asString(obj.action);
    if (!faiblesse || !action) continue;
    items.push({ faiblesse, action });
  }
  return items.length > 0 ? items : undefined;
}

function sanitizeSentiment(value: unknown): ReputationSentiment | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  const evaluation = asString(obj.evaluation);
  const justification = asString(obj.justification);
  if (!evaluation || !justification) return undefined;
  const sentiment: ReputationSentiment = {
    evaluation,
    justification,
  };
  const exemples = asStringArray(obj.exemples);
  if (exemples) {
    sentiment.exemples = exemples;
  }
  const details = asString(obj.details);
  if (details) {
    sentiment.details = details;
  }
  return sentiment;
}

function sanitizePart1(value: unknown): ReputationPart1 | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  const syntheseIdentite = asStringArray(obj.syntheseIdentite);
  const nuageMots = sanitizeWordCloud(obj.nuageMots);
  const sentimentGlobal = sanitizeSentiment(obj.sentimentGlobal);
  const forces = asStringArray(obj.forces);
  const faiblesses = asStringArray(obj.faiblesses);
  const sujets = asStringArray(obj.sujets);
  const recommandations = sanitizeRecommendations(obj.recommandations);

  if (!syntheseIdentite || !nuageMots || !sentimentGlobal || !forces || !faiblesses || !sujets || !recommandations) {
    return undefined;
  }

  return {
    syntheseIdentite,
    nuageMots,
    sentimentGlobal,
    forces,
    faiblesses,
    sujets,
    recommandations,
  };
}

function sanitizePart2Details(value: unknown): ReputationPart2Detail[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: ReputationPart2Detail[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const detail: ReputationPart2Detail = {};
    const acteur = asString(obj.acteur);
    if (acteur) detail.acteur = acteur;
    const sentiment = asString(obj.sentiment);
    if (sentiment) detail.sentiment = sentiment;
    const specialites = asString(obj.specialites);
    if (specialites) detail.specialites = specialites;
    const pointsForts = asStringArray(obj.pointsForts);
    if (pointsForts) detail.pointsForts = pointsForts;
    const faiblesses = asStringArray(obj.faiblesses);
    if (faiblesses) detail.faiblesses = faiblesses;
    const commentaires = asString(obj.commentaires);
    if (commentaires) detail.commentaires = commentaires;

    if (Object.keys(detail).length > 0) {
      items.push(detail);
    }
  }
  return items.length > 0 ? items : undefined;
}

function sanitizePart2(value: unknown): ReputationPart2 | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  const resume = asString(obj.resume);
  const details = sanitizePart2Details(obj.details);
  if (!resume && !details) return undefined;
  const result: ReputationPart2 = {};
  if (resume) result.resume = resume;
  if (details) result.details = details;
  return result;
}

function sanitizeQuestions(value: unknown): ReputationQuestion[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: ReputationQuestion[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const question = asString(obj.question);
    if (!question) continue;
    const item: ReputationQuestion = { question };
    const contexte = asString(obj.contexte);
    if (contexte) item.contexte = contexte;
    items.push(item);
  }
  return items.length > 0 ? items : undefined;
}

function sanitizeAnalyses(value: unknown): ReputationVisibilityAnalysis[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: ReputationVisibilityAnalysis[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const question = asString(obj.question);
    const mentionProbable = asString(obj.mentionProbable);
    const justification = asString(obj.justification);
    const concurrents = asStringArray(obj.concurrents);
    if (!question || !mentionProbable || !justification || !concurrents) continue;
    const item: ReputationVisibilityAnalysis = {
      question,
      mentionProbable,
      justification,
      concurrents,
    };
    const commentaires = asString(obj.commentaires);
    if (commentaires) item.commentaires = commentaires;
    items.push(item);
  }
  return items;
}

function sanitizePart3(value: unknown): ReputationPart3 | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  const generationRaw = obj.generation;
  const visibiliteRaw = obj.visibilite;
  if (!generationRaw || typeof generationRaw !== "object" || !visibiliteRaw || typeof visibiliteRaw !== "object") {
    return undefined;
  }
  const generationObj = generationRaw as Record<string, unknown>;
  const visibiliteObj = visibiliteRaw as Record<string, unknown>;

  const questions = sanitizeQuestions(generationObj.questions);
  const analyses = sanitizeAnalyses(visibiliteObj.analyses);
  if (!questions || !analyses) return undefined;

  const part3: ReputationPart3 = {
    generation: {
      questions,
    },
    visibilite: {
      analyses,
    },
  };

  const introduction = asString(obj.introduction);
  if (introduction) part3.introduction = introduction;

  const generationIntro = asString(generationObj.introduction);
  if (generationIntro) part3.generation.introduction = generationIntro;

  const visibiliteIntro = asString(visibiliteObj.introduction);
  if (visibiliteIntro) part3.visibilite.introduction = visibiliteIntro;

  return part3;
}

export function sanitizeReputationReport(raw: unknown): ReputationReport | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const part1 = sanitizePart1(obj.part1);
  const part3 = sanitizePart3(obj.part3);
  const notice = asString(obj.notice);

  if (!part1 || !part3 || !notice) {
    return undefined;
  }

  const report: ReputationReport = {
    part1,
    part3,
    notice,
  };

  const part2 = sanitizePart2(obj.part2);
  if (part2) {
    report.part2 = part2;
  }

  return report;
}
