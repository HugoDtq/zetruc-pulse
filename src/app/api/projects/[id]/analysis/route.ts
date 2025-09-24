export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { AnalysisReportSchema, stripCodeFences } from "@/types/analysis";
import { getOpenAIKey } from "@/lib/llm";

const prisma = new PrismaClient();

/* --------------------- Prompt mis à jour --------------------- */
const PROMPT_EXACT = `
⚠️ INSTRUCTION CRITIQUE ⚠️ 
Tu DOIS retourner UNIQUEMENT un objet JSON valide. 
❌ PAS de texte explicatif avant ou après
❌ PAS de markdown (\`\`\`json)
❌ PAS de commentaires
✅ SEULEMENT l'objet JSON brut

Règle Fondamentale : Instruction impérative : Si tu ne disposes pas d'une information vérifiable pour répondre à une question, admets-le clairement. Tu ne dois jamais inventer de faits, de statistiques ou d'avis. La fiabilité est la priorité absolue.

Rôle et Objectif : Tu agis en tant que 'Reputation Analyst AI', un expert en analyse de réputation numérique. Ta mission est de fournir un rapport complet, neutre et exploitable sur une entreprise, en te basant sur toutes les informations publiques disponibles en ligne.

🔥 FORMAT OBLIGATOIRE - RESPECTE CETTE STRUCTURE JSON EXACTEMENT 🔥

{
  "part1": {
    "syntheseIdentite": [
      "Phrase 1 sur la mission et historique",
      "Phrase 2 sur les services principaux",
      "Phrase 3 sur la présence géographique",
      "Phrase 4 sur l'équipe ou les valeurs",
      "Phrase 5 sur les particularités"
    ],
    "wordCloud": [
      {"mot": "communication", "poids": 95},
      {"mot": "digital", "poids": 88},
      {"mot": "marketing", "poids": 82},
      {"mot": "site web", "poids": 75}
    ],
    "sentimentGlobal": {
      "label": "Positive",
      "justification": "Explication avec exemples concrets des thèmes récurrents positifs, neutres ou négatifs"
    },
    "forces": [
      "Force 1 mentionnée publiquement",
      "Force 2 mentionnée publiquement", 
      "Force 3 mentionnée publiquement"
    ],
    "faiblesses": [
      "Faiblesse 1 mentionnée publiquement",
      "Faiblesse 2 mentionnée publiquement",
      "Faiblesse 3 mentionnée publiquement"
    ],
    "sujetsPrincipaux": [
      "Sujet 1 le plus fréquemment associé",
      "Sujet 2 le plus fréquemment associé",
      "Sujet 3 le plus fréquemment associé"
    ],
    "recommandations": [
      "Recommandation 1: Action corrective pour améliorer la faiblesse identifiée",
      "Recommandation 2: Stratégie de communication pour pallier aux points faibles",
      "Recommandation 3: Initiative marketing pour renforcer les aspects négatifs"
    ]
  },
  "part2": {
    "present": true,
    "positionnementConcurrentiel": {
      "comparaison": "Comparaison détaillée avec les concurrents fournis si présents, sinon texte expliquant l'absence de concurrents"
    }
  },
  "part3": {
    "questions": [
      {
        "question": "Question qu'un prospect pourrait poser à une IA",
        "mentionProbable": "Oui",
        "justification": "Explication courte du pourquoi",
        "concurrentsCites": ["Concurrent 1", "Concurrent 2"],
        "reponseIA": "Réponse complète que fournirait l'IA à cette question"
      }
    ],
    "noteMethodo": "Ce rapport est une synthèse générée par une IA en se basant sur les données publiques accessibles. Il constitue une analyse de réputation et non une vérité absolue."
  },
  "meta": {
    "brand": "[Nom de l'entreprise sera remplacé ici]",
    "generatedAt": "2024-01-01T00:00:00.000Z"
  }
}

Informations en Entrée :

Nom de l'entreprise : [Nom de l'entreprise]

URL du site web : [URL de l'entreprise]

Concurrent 1 (optionnel) : [Nom du concurrent 1]

Concurrent 2 (optionnel) : [Nom du concurrent 2]

Ville de l'entreprise : [Ville de l'entreprise]

Instructions détaillées basées sur ton prompt :

Partie 1 : Bilan de Réputation de [Nom de l'entreprise]

1.1. Synthèse de l'Identité : Décris en 5 phrases la mission, l'historique et les offres clés de l'entreprise. → "syntheseIdentite" (tableau de 5 strings)

1.2. Données pour Graphe Visuel (Nuage de Mots Pondéré) : Génère les données pour un nuage de mots pondéré au format JSON. Tu dois fournir un tableau de 20 à 30 objets, où chaque objet contient une clé "mot" et une clé "poids" (un score de 10 à 100). Le poids doit refléter la fréquence et l'impact sémantique du terme. → "wordCloud"

1.3. Analyse de Sentiment Global : Évalue la perception publique (Positive, Neutre, Négative, Mixte) et justifie avec des exemples de thèmes récurrents. → "sentimentGlobal" avec "label" OBLIGATOIREMENT l'une de ces valeurs exactes : "Positive", "Neutre", "Négative", "Mixte"

1.4. Forces et Faiblesses Perçues : Liste 3 points forts et 3 points faibles mentionnés publiquement. → "forces" et "faiblesses" (tableaux de 3 strings chacun)

1.5. Principaux Sujets de Discussion : Identifie les 3 sujets les plus fréquemment associés à l'entreprise. → "sujetsPrincipaux" (tableau de 3 strings)

1.6. Pistes d'Amélioration Recommandées : Pour chaque faiblesse identifiée, propose une action marketing ou de communication corrective. → "recommandations" (tableau de strings)

Partie 2 : Positionnement Concurrentiel (Cette partie ne sera générée que si des concurrents sont fournis)

Compare la réputation de [Nom de l'entreprise] à celle des concurrents en te basant sur le sentiment en ligne, les spécialités perçues et les points forts mis en avant. → "part2.present" true si concurrents fournis, "positionnementConcurrentiel.comparaison"

Partie 3 : Analyse de Visibilité dans les Réponses IA

En te basant sur toute ton analyse précédente (secteur d'activité, services clés, concurrents), ta mission pour cette partie se déroule en trois temps :

3.1. Génération de Questions : D'abord, formule une liste de EXACTEMENT 15 à 20 questions pertinentes et variées qu'un prospect ou un internaute pourrait poser à une IA grand public pour se renseigner sur les services de [Nom de l'entreprise] ou sur des sujets connexes où elle pourrait être mentionnée.

IMPORTANT : Tu DOIS générer AU MINIMUM 15 questions. Chaque question doit avoir sa propre analyse de visibilité et sa réponse IA associée.

3.2. NOUVELLE MÉTHODOLOGIE EN 2 ÉTAPES :

ÉTAPE A - Génération de la réponse : Pour chaque question, génère d'ABORD la réponse complète et factuelle qu'une IA donnerait réellement à cette question, en te basant sur tes recherches.

ÉTAPE B - Analyse de la réponse générée : Ensuite, analyse ta propre réponse pour déterminer :
- Mention probable : Réponds par Oui, Non, ou Probable selon ce que tu viens de générer dans ta réponse
- Justification : Explique pourquoi [Nom de l'entreprise] apparaît ou n'apparaît pas dans ta réponse
- Concurrents cités : Liste UNIQUEMENT les concurrents qui apparaissent réellement dans ta réponse générée (pas ceux qui pourraient théoriquement être cités)

RÈGLE CRITIQUE : L'analyse de visibilité doit être parfaitement cohérente avec la réponse générée. Si ta réponse ne mentionne aucun concurrent, alors "concurrentsCites" doit être vide.

Pied de Page du Rapport : Termine ton rapport avec la notice méthodologique : "Ce rapport est une synthèse générée par une IA en se basant sur les données publiques accessibles. Il constitue une analyse de réputation et non une vérité absolue." → "noteMethodo"

🚨 RAPPEL FINAL 🚨
Ta réponse doit commencer par { et finir par }
AUCUN autre caractère avant ou après !
Respect EXACT des noms de propriétés et structure JSON fournie ci-dessus.
OBLIGATOIRE : Génère AU MINIMUM 15 questions dans le tableau part3.questions, sinon le parsing échouera.
`.trim();

/* --------------------- Build prompt avec remplacements dynamiques --------------------- */
function buildPromptExactWithData({
  brand,
  website,
  city,
  competitors,
}: {
  brand: string;
  website?: string | null;
  city?: string | null;
  competitors: string[]; // dédupliqués
}) {
  let p = PROMPT_EXACT;

  // 1) Nom + Ville (remplacement brut des [placeholders])
  p = p
    .replaceAll("[Nom de l'entreprise]", brand || "—")
    .replaceAll("[Ville de l'entreprise]", city || "—");

  // 2) URL : on remplace [URL de l'entreprise] par l'URL réelle
  p = p.replace(
    /URL du site web\s*:\s*\[URL de l'entreprise\]/,
    `URL du site web : ${website?.trim() || "—"}`
  );

  // 3) Remplacer dans l'exemple JSON meta.brand et part2.present
  p = p.replace(
    '"brand": "[Nom de l\'entreprise sera remplacé ici]"',
    `"brand": "${brand || "—"}"`
  );
  
  // CORRECTION : Forcer part2.present selon le nombre de concurrents
  const hasCompetitors = competitors.length > 0;
  p = p.replace(
    '"present": true',
    `"present": ${hasCompetitors ? 'true' : 'false'}`
  );

  // 4) Concurrents :
  // - si la liste est vide → on supprime TOUTES les lignes "Concurrent X (optionnel) : ..."
  // - sinon → on remplace ces deux lignes par N lignes numérotées
  const competitorsBlock = competitors
    .map((name, i) => `Concurrent ${i + 1} (optionnel) : ${name}`)
    .join("\n");

  const competitorLinesRegex =
    /Concurrent\s*\d+\s*\(optionnel\)\s*:\s*\[Nom du concurrent \d+\]\s*\n?/g;

  if (competitors.length === 0) {
    // supprime les lignes existantes
    p = p.replace(competitorLinesRegex, "");
  } else {
    // remplace le bloc "Concurrent 1/2 ..." par nos N lignes
    // Cas 1 : les deux lignes existent → on remplace le "groupe"
    const twoLinesRegex =
      /Concurrent\s*1\s*\(optionnel\)\s*:\s*\[Nom du concurrent 1\]\s*\n\s*Concurrent\s*2\s*\(optionnel\)\s*:\s*\[Nom du concurrent 2\]\s*/;
    if (twoLinesRegex.test(p)) {
      p = p.replace(twoLinesRegex, `${competitorsBlock}\n`);
    } else {
      // Cas 2 : fallback — on supprime toutes les lignes Concurrent... puis on insère après l'URL
      p = p.replace(competitorLinesRegex, "");
      p = p.replace(
        /(URL du site web\s*:\s*.+)\n/,
        `$1\n${competitorsBlock}\n`
      );
    }
  }

  // 5) AJOUT : Instruction explicite sur les concurrents
  if (competitors.length > 0) {
    p += `\n\n🚨 INSTRUCTION CRITIQUE POUR PARTIE 2 🚨
ATTENTION : Tu as ${competitors.length} concurrent(s) fourni(s) : ${competitors.join(', ')}
- part2.present DOIT être absolument true
- Tu DOIS faire une vraie comparaison détaillée entre ${brand} et ces concurrents
- Ne mets jamais "Aucun concurrent fourni" ou "impossible d'établir une comparaison"
- Base-toi sur les informations publiques trouvées pour chaque concurrent`;
  }

  return p;
}

/* --------------------- Parse JSON robuste amélioré --------------------- */
function extractFirstJsonBlock(text: string) {
  const clean = stripCodeFences(text);
  
  // Chercher le premier { et le dernier } correspondant
  let braceCount = 0;
  let start = -1;
  let end = -1;
  
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (char === '{') {
      if (start === -1) start = i;
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0 && start !== -1) {
        end = i;
        break;
      }
    }
  }
  
  if (start >= 0 && end > start) {
    return clean.slice(start, end + 1);
  }
  
  // Fallback sur l'ancienne méthode
  const s = clean.indexOf("{");
  const e = clean.lastIndexOf("}");
  if (s >= 0 && e > s) return clean.slice(s, e + 1);
  return clean.trim();
}

function softJsonRepair(s: string) {
  let t = s;
  // Nettoyer les caractères unicode problématiques
  t = t.replace(/[""]/g, '"').replace(/['']/g, "'");
  // Supprimer les virgules en trop
  t = t.replace(/,\s*([}\]])/g, "$1");
  // Supprimer les BOM
  t = t.replace(/^\uFEFF/, "");
  // Normaliser les retours à la ligne
  t = t.replace(/\r\n?/g, "\n");
  // Supprimer les commentaires JSON non-standards
  t = t.replace(/\/\*.*?\*\//gs, '');
  t = t.replace(/\/\/.*$/gm, '');
  return t.trim();
}

function tryParseJsonLoose(raw: string) {
  console.log("Tentative de parsing du texte brut:", raw.substring(0, 200) + "...");
  
  try {
    const parsed = JSON.parse(raw);
    console.log("✓ Parsing JSON direct réussi");
    return parsed;
  } catch (e) {
    console.log("✗ Parsing JSON direct échoué:", (e as Error).message);
  }
  
  const inner = extractFirstJsonBlock(raw);
  console.log("Extraction du bloc JSON:", inner.substring(0, 200) + "...");
  
  try {
    const parsed = JSON.parse(inner);
    console.log("✓ Parsing du bloc extrait réussi");
    return parsed;
  } catch (e) {
    console.log("✗ Parsing du bloc extrait échoué:", (e as Error).message);
  }
  
  const repaired = softJsonRepair(inner);
  console.log("Tentative de réparation:", repaired.substring(0, 200) + "...");
  
  try {
    const parsed = JSON.parse(repaired);
    console.log("✓ Parsing après réparation réussi");
    return parsed;
  } catch (e) {
    console.log("✗ Parsing après réparation échoué:", (e as Error).message);
    throw new Error(`Impossible de parser le JSON même après réparation: ${(e as Error).message}`);
  }
}

/* --------------------- Responses API helpers --------------------- */
async function postJSON(url: string, body: any, apiKey: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

function deepFindText(obj: any): string | null {
  if (!obj) return null;
  if (typeof obj.output_text === "string" && obj.output_text.trim()) return obj.output_text;

  if (Array.isArray(obj.output)) {
    for (const out of obj.output) {
      if (Array.isArray(out?.content)) {
        for (const c of out.content) {
          if (typeof c?.text === "string" && c.text.trim()) return c.text;
        }
      }
    }
  }
  if (obj?.text?.content && typeof obj.text.content === "string") return obj.text.content;
  if (Array.isArray(obj?.choices) && obj.choices[0]?.message?.content)
    return String(obj.choices[0].message.content);
  if (typeof obj.result === "string" && obj.result.trim()) return obj.result;
  if (typeof obj.response === "string" && obj.response.trim()) return obj.response;

  if (typeof obj === "object") {
    for (const k of Object.keys(obj)) {
      const v = (obj as any)[k];
      const found = deepFindText(v);
      if (found) return found;
    }
  }
  return null;
}

/* --------------------- Handler --------------------- */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      name: true,
      websiteUrl: true,
      city: true,
      // On récupère les concurrents sur TOUS les domaines (on déduplique)
      domains: { select: { competitors: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Agréger + dédupliquer les concurrents (string[])
  const competitorsSet = new Set<string>();
  for (const d of project.domains ?? []) {
    // CORRECTION : Les concurrents sont stockés comme string JSON dans la BDD
    let domainCompetitors: string[] = [];
    try {
      const parsed = JSON.parse(d.competitors || '[]');
      domainCompetitors = Array.isArray(parsed) ? parsed : [];
    } catch {
      domainCompetitors = [];
    }
    
    for (const c of domainCompetitors) {
      const name = String(c || "").trim();
      if (name) competitorsSet.add(name);
    }
  }
  const competitors = Array.from(competitorsSet);
  
  console.log("🔍 DEBUG: Concurrents extraits:", competitors);

  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Clé OpenAI manquante (Superadmin)" },
      { status: 500 }
    );
  }

  // PROMPT EXACT + remplacements (nom, ville, URL, concurrents dynamiques)
  const prompt = buildPromptExactWithData({
    brand: project.name,
    website: project.websiteUrl,
    city: project.city,
    competitors,
  });

  // Responses API avec web_search OBLIGATOIRE (sans JSON mode)
  const body = {
    model: "gpt-4o",
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
    ],
    text: { 
      format: { 
        type: "text" // Retour au mode text car web_search incompatible avec json_object
      } 
    },
    reasoning: {},
    tools: [
      {
        type: "web_search",
        user_location: { type: "approximate" },
        search_context_size: "medium",
      },
    ],
    temperature: 0.6,
    max_output_tokens: 8000, // Augmenté pour permettre plus de questions
    top_p: 1,
    store: false,
    include: ["web_search_call.action.sources"],
  };

  try {
    console.log("🚀 Envoi de la requête à OpenAI Responses API...");
    const r = await postJSON("https://api.openai.com/v1/responses", body, apiKey);
    
    if (!r.ok) {
      console.error("❌ Erreur OpenAI:", r.status, r.text.slice(0, 500));
      return NextResponse.json(
        { error: "OpenAI error", status: r.status, detailPreview: r.text.slice(0, 1200) },
        { status: 502 }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(r.text);
    } catch {
      console.error("❌ Impossible de parser la réponse OpenAI");
      return NextResponse.json(
        { error: "OPENAI_BAD_JSON", detailPreview: r.text.slice(0, 1200) },
        { status: 502 }
      );
    }

    const modelText =
      deepFindText(payload) ||
      (Array.isArray(payload.output)
        ? payload.output.flatMap((o: any) => (o?.content || []).map((c: any) => c?.text || "")).join("\n")
        : "");

    if (!modelText) {
      console.error("❌ Aucun texte trouvé dans la réponse OpenAI");
      return NextResponse.json(
        { error: "MODEL_NO_TEXT", detailPreview: JSON.stringify(payload).slice(0, 1200) },
        { status: 502 }
      );
    }

    // Parse JSON avec réparations légères si besoin
    console.log("=== DEBUG: Réponse OpenAI reçue ===");
    console.log("Payload structure:", Object.keys(payload));
    console.log("Model text preview:", modelText.substring(0, 500));
    
    let parsed: any;
    try {
      parsed = tryParseJsonLoose(modelText);
    } catch (e: any) {
      console.error("=== ERREUR PARSING JSON ===");
      console.error("Erreur:", e.message);
      console.error("Texte complet du modèle:", modelText);
      console.error("Bloc JSON candidat:", extractFirstJsonBlock(modelText));
      
      return NextResponse.json(
        {
          error: "MODEL_BAD_JSON",
          parseError: String(e?.message || e),
          fullModelText: modelText, // TEMPORAIRE pour debug
          candidatePreview: extractFirstJsonBlock(modelText).slice(0, 1200),
        },
        { status: 502 }
      );
    }

    console.log("✅ JSON parsé avec succès");
    
    // DEBUG: Vérifier si reponseIA est généré
    console.log("🔍 DEBUG: Structure des questions:");
    if (parsed.part3?.questions) {
      console.log(`Nombre de questions: ${parsed.part3.questions.length}`);
      console.log("Première question complète:", JSON.stringify(parsed.part3.questions[0], null, 2));
      console.log("Deuxième question complète:", JSON.stringify(parsed.part3.questions[1], null, 2));
      
      // Vérifier si reponseIA existe
      const hasReponseIA = parsed.part3.questions.some((q: any) => q.reponseIA);
      console.log(`🎯 Le champ reponseIA est présent: ${hasReponseIA}`);
      
      if (hasReponseIA) {
        console.log("✅ reponseIA trouvé dans les données");
      } else {
        console.log("❌ reponseIA manquant - le modèle n'a pas généré ce champ");
      }
    }
    
    // DEBUG: Vérifier la structure part2
    console.log("🔍 DEBUG part2:", JSON.stringify(parsed.part2, null, 2));
    console.log("🔍 part2.present:", parsed.part2?.present);
    console.log("🔍 part2.positionnementConcurrentiel:", parsed.part2?.positionnementConcurrentiel);
    
    const safe = AnalysisReportSchema.parse(parsed);
    // Le generatedAt est maintenant fourni par le modèle, pas besoin de l'écraser
    
    return NextResponse.json({ parsed: safe });
    
  } catch (e: any) {
    console.error("💥 Erreur générale:", e);
    return NextResponse.json(
      { error: "Generation failed", detailPreview: String(e?.message || e) },
      { status: 500 }
    );
  }
}