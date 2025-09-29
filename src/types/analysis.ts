// src/types/analysis.ts
import { z } from "zod";

export const SupportedLlmProvider = z.enum(["OPENAI", "GEMINI"]);
export type SupportedLlmProvider = z.infer<typeof SupportedLlmProvider>;

export const WordItem = z.object({
  mot: z.string(),
  poids: z.number().min(10).max(100),
});

export const QuestionAnalysis = z.object({
  question: z.string(),
  mentionProbable: z.enum(["Oui", "Non", "Probable"]),
  justification: z.string(),
  concurrentsCites: z.array(z.string()).default([]),
  reponseIA: z.string(), // AJOUT : champ pour la réponse de l'IA
});

export const AnalysisReportSchema = z.object({
  meta: z.object({
    brand: z.string(),
    website: z.string().optional().nullable(),
    ville: z.string().optional().nullable(),
    generatedAt: z.string(), // ISO
    sources: z.array(z.string()).optional().default([]),
    provider: SupportedLlmProvider.optional(),
  }),
  part1: z.object({
    syntheseIdentite: z.array(z.string()).min(1), // 5 phrases
    wordCloud: z.array(WordItem).min(10).max(40),
    sentimentGlobal: z.object({
      label: z.enum(["Positive", "Neutre", "Négative", "Mixte"]),
      justification: z.string(),
    }),
    forces: z.array(z.string()).max(10),
    faiblesses: z.array(z.string()).max(10),
    sujetsPrincipaux: z.array(z.string()).max(10),
    recommandations: z.array(z.string()).max(10),
  }),
  part2: z.object({
    present: z.boolean(),
    positionnementConcurrentiel: z.object({
      comparaison: z.string(), // MODIFIÉ : accepte maintenant du texte libre
    }).optional(),
    // Garde l'ancien champ pour rétrocompatibilité mais optionnel
    comparaison: z
      .array(
        z.object({
          acteur: z.string(), // brand ou concurrent
          sentiment: z.enum(["Positive", "Neutre", "Négative", "Mixte"]).optional(),
          specialites: z.array(z.string()).optional().default([]),
          pointsForts: z.array(z.string()).optional().default([]),
        })
      )
      .optional()
      .default([]),
  }),
  part3: z.object({
    questions: z.array(QuestionAnalysis).min(5),
    noteMethodo: z.string(),
  }),
});

export type AnalysisReport = z.infer<typeof AnalysisReportSchema>;

// util
export function stripCodeFences(text: string) {
  return String(text ?? "")
    .replace(/^```[\s\S]*?json\n?/i, "")
    .replace(/```$/i, "")
    .replace(/```/g, "")
    .trim();
}