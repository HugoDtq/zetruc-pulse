export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

import { getOpenAIKey } from "@/lib/llm";
import {
  REPUTATION_ANALYSIS_JSON_SCHEMA,
  sanitizeReputationReport,
} from "@/lib/reputation-report";

const prisma = new PrismaClient();

const PROMPT_TEMPLATE = `Règle Fondamentale : Instruction impérative : Si tu ne disposes pas d'une information vérifiable pour répondre à une question, admets-le clairement. Tu ne dois jamais inventer de faits, de statistiques ou d'avis. La fiabilité est la priorité absolue.

Rôle et Objectif : Tu agis en tant que 'Reputation Analyst AI', un expert en analyse de réputation numérique. Ta mission est de fournir un rapport complet, neutre et exploitable sur une entreprise, en te basant sur toutes les informations publiques disponibles en ligne.

Informations en Entrée :

Nom de l'entreprise : [Nom de l'entreprise]

URL du site web : [https://www.du.edu/](https://www.du.edu/)

Concurrent 1 (optionnel) : [Nom du concurrent 1]

Concurrent 2 (optionnel) : [Nom du concurrent 2]

Ville de l'entreprise : [Ville de l'entreprise]

Partie 1 : Bilan de Réputation de [Nom de l'entreprise]

1.1. Synthèse de l’Identité : Décris en 5 phrases la mission, l'historique et les offres clés de l'entreprise.

1.2. Données pour Graphe Visuel (Nuage de Mots Pondéré) : Génère les données pour un nuage de mots pondéré au format JSON. Tu dois fournir un tableau de 20 à 30 objets, où chaque objet contient une clé "mot" et une clé "poids" (un score de 10 à 100). Le poids doit refléter la fréquence et l'impact sémantique du terme.

1.3. Analyse de Sentiment Global : Évalue la perception publique (Positive, Neutre, Négative, Mixte) et justifie avec des exemples de thèmes récurrents.

1.4. Forces et Faiblesses Perçues : Liste 3 points forts et 3 points faibles mentionnés publiquement.

1.5. Principaux Sujets de Discussion : Identifie les 3 sujets les plus fréquemment associés à l'entreprise.

1.6. Pistes d'Amélioration Recommandées : Pour chaque faiblesse identifiée, propose une action marketing ou de communication corrective.

Partie 2 : Positionnement Concurrentiel (Cette partie ne sera générée que si des concurrents sont fournis)

Compare la réputation de [Nom de l'entreprise] à celle de [Nom du concurrent 1] et [Nom du concurrent 2] en te basant sur le sentiment en ligne, les spécialités perçues et les points forts mis en avant.

Partie 3 : Analyse de Visibilité dans les Réponses IA

En te basant sur toute ton analyse précédente (secteur d'activité, services clés, concurrents), ta mission pour cette partie se déroule en deux temps :

3.1. Génération de Questions : D'abord, formule une liste de 15 à 20 questions pertinentes et variées qu'un prospect ou un internaute pourrait poser à une IA grand public pour se renseigner sur les services de [Nom de l'entreprise] ou sur des sujets connexes où elle pourrait être mentionnée (ex: questions comparatives, questions sur le meilleur prestataire local, questions sur les tarifs, questions sur des services spécifiques, etc.).

3.2. Analyse de Visibilité : Ensuite, pour chacune des questions que tu viens de générer, fournis l'analyse concise en 3 points que nous avons définie :

Mention probable : Réponds par Oui, Non, ou Probable.

Justification : Explique en une courte phrase pourquoi (ex: "forte notoriété locale", "spécialiste reconnu du sujet", "la concurrence est plus visible sur ce créneau").

Concurrents cités : Liste les concurrents ou autres acteurs qui seraient probablement mentionnés.

---

Pied de Page du Rapport Termine ton rapport avec la notice méthodologique suivante : "Ce rapport est une synthèse générée par une IA en se basant sur les données publiques accessibles. Il constitue une analyse de réputation et non une vérité absolue.

---`;

function normalizeWebsite(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extractCompetitorNames(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const names: string[] = [];
      for (const item of parsed) {
        if (!item) continue;
        if (typeof item === "string") {
          if (item.trim()) names.push(item.trim());
        } else if (typeof item === "object" && "name" in item) {
          const value = (item as { name?: unknown }).name;
          if (typeof value === "string" && value.trim()) names.push(value.trim());
        }
      }
      if (names.length) return names;
    }
  } catch {
    /* ignore JSON parsing errors */
  }
  return String(raw)
    .split(/[\n,;]+/)
    .map((s) => s.replace(/^[-*•\s]+/, "").trim())
    .filter(Boolean);
}

function buildPrompt({
  companyName,
  website,
  competitor1,
  competitor2,
  city,
}: {
  companyName: string;
  website: string;
  competitor1: string;
  competitor2: string;
  city: string;
}) {
  return PROMPT_TEMPLATE
    .replaceAll("[Nom de l'entreprise]", companyName)
    .replaceAll("[Nom du concurrent 1]", competitor1)
    .replaceAll("[Nom du concurrent 2]", competitor2)
    .replaceAll("[Ville de l'entreprise]", city)
    .replaceAll("[https://www.du.edu/](https://www.du.edu/)", website);
}

function extractResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const root = payload as Record<string, unknown>;
  const candidates: string[] = [];

  if (typeof root.output_text === "string") candidates.push(root.output_text);

  const textField = root.text;
  if (textField && typeof textField === "object") {
    const content = (textField as { content?: unknown }).content;
    if (typeof content === "string") candidates.push(content);
  }

  const outputField = root.output;
  if (Array.isArray(outputField)) {
    for (const item of outputField) {
      if (!item || typeof item !== "object") continue;
      const content = (item as { content?: unknown }).content;
      const parts = Array.isArray(content) ? content : content !== undefined ? [content] : [];
      const text = parts
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object") {
            const partObj = part as { type?: unknown; text?: unknown };
            if (
              (partObj.type === "output_text" || partObj.type === "text") &&
              typeof partObj.text === "string"
            ) {
              return partObj.text;
            }
          }
          return undefined;
        })
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join("\n");
      if (text) candidates.push(text);
    }
  }

  const contentField = root.content;
  if (Array.isArray(contentField)) {
    const text = contentField
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const textValue = (part as { text?: unknown }).text;
          if (typeof textValue === "string") return textValue;
        }
        return undefined;
      })
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join("\n");
    if (text) candidates.push(text);
  }

  if (typeof root.result === "string") candidates.push(root.result);
  if (typeof root.response === "string") candidates.push(root.response);

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function extractResponseJson(payload: unknown): unknown | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as Record<string, unknown>;
  const direct = (root as { output_json?: unknown }).output_json;
  if (direct !== undefined) {
    return direct;
  }

  const outputField = root.output;
  if (Array.isArray(outputField)) {
    for (const item of outputField) {
      if (!item || typeof item !== "object") continue;
      const content = (item as { content?: unknown }).content;
      const parts = Array.isArray(content) ? content : content !== undefined ? [content] : [];
      for (const part of parts) {
        if (part && typeof part === "object") {
          const maybeJson = (part as { json?: unknown }).json;
          if (maybeJson !== undefined) {
            return maybeJson;
          }
        }
      }
    }
  }

  return undefined;
}

function safeParseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

async function callOpenAIResponses({
  prompt,
  apiKey,
  timeoutMs = 60000,
}: {
  prompt: string;
  apiKey: string;
  timeoutMs?: number;
}): Promise<{ text?: string; json?: unknown; raw: unknown }> {
  const body = {
    model: "gpt-4o",
    input: [
      {
        role: "user" as const,
        content: [
          {
            type: "input_text" as const,
            text: prompt,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema" as const,
        name: REPUTATION_ANALYSIS_JSON_SCHEMA.name,
        schema: REPUTATION_ANALYSIS_JSON_SCHEMA.schema,
      },
    },
    reasoning: {},
    tools: [
      {
        type: "web_search" as const,
        user_location: { type: "approximate" as const },
        search_context_size: "medium" as const,
      },
    ],
    temperature: 1,
    max_output_tokens: 2048,
    top_p: 1,
    store: true,
    include: ["web_search_call.action.sources"],
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`OpenAI error ${response.status}: ${detail}`);
    }

    const json = (await response.json()) as unknown;
    const text = extractResponseText(json);
    const structured = extractResponseJson(json);
    return { text, json: structured, raw: json };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      name: true,
      city: true,
      websiteUrl: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }

  const domains = await prisma.domain.findMany({
    where: { projectId: id },
    select: { competitors: true },
  });

  const competitorSet = new Set<string>();
  for (const domain of domains) {
    for (const name of extractCompetitorNames(domain.competitors)) {
      if (name) competitorSet.add(name);
    }
  }

  const competitors = Array.from(competitorSet).filter(Boolean);
  const competitor1 = competitors[0] ?? "Non fourni";
  const competitor2 = competitors[1] ?? "Non fourni";

  const normalizedWebsite = normalizeWebsite(project.websiteUrl);
  const websiteForPrompt = normalizedWebsite
    ? `[${normalizedWebsite}](${normalizedWebsite})`
    : "Non renseigné";

  const cityForPrompt = project.city?.trim() || "Non renseignée";
  const companyName = project.name?.trim() || "Entreprise";

  const prompt = buildPrompt({
    companyName,
    website: websiteForPrompt,
    competitor1,
    competitor2,
    city: cityForPrompt,
  });

  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Clé OpenAI manquante dans la configuration Superadmin" },
      { status: 500 }
    );
  }

  try {
    const { text, json: structured } = await callOpenAIResponses({ prompt, apiKey });
    const rawText = typeof text === "string" && text.trim().length > 0 ? text : undefined;
    const rawPayload = structured ?? (rawText ? safeParseJson(rawText) : undefined);

    if (!rawPayload) {
      return NextResponse.json(
        { error: "Réponse vide d'OpenAI" },
        { status: 502 }
      );
    }

    const report = sanitizeReputationReport(rawPayload);
    if (!report) {
      return NextResponse.json(
        { error: "Format de réponse inattendu" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      result: report,
      raw: rawPayload,
      rawText: rawText ?? null,
      prompt,
      context: {
        companyName,
        city: project.city ?? null,
        website: normalizedWebsite,
        competitors: competitors.slice(0, 5),
      },
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Impossible de générer l'analyse", detail },
      { status: 502 }
    );
  }
}
