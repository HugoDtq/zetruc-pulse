import { NextRequest, NextResponse } from "next/server";
import { getOpenAIKey } from "@/lib/llm";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    projectName,
    websiteUrl,
    competitor1,
    competitor2,
    city,
  } = body;

  if (!projectName || !websiteUrl) {
    return NextResponse.json(
      { error: "Project name and website URL are required" },
      { status: 400 }
    );
  }

  const openAIKey = await getOpenAIKey();
  if (!openAIKey) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured" },
      { status: 500 }
    );
  }

  const openai = new OpenAI({ apiKey: openAIKey });

  const prompt = `
Règle Fondamentale : Instruction impérative : Si tu ne disposes pas d'une information vérifiable pour répondre à une question, admets-le clairement. Tu ne dois jamais inventer de faits, de statistiques ou d'avis. La fiabilité est la priorité absolue.

Rôle et Objectif : Tu agis en tant que 'Reputation Analyst AI', un expert en analyse de réputation numérique. Ta mission est de fournir un rapport complet, neutre et exploitable sur une entreprise, en te basant sur toutes les informations publiques disponibles en ligne.

Informations en Entrée :

Nom de l'entreprise : ${projectName}
URL du site web : ${websiteUrl}
Concurrent 1 (optionnel) : ${competitor1 || "N/A"}
Concurrent 2 (optionnel) : ${competitor2 || "N/A"}
Ville de l'entreprise : ${city || "N/A"}

Partie 1 : Bilan de Réputation de ${projectName}

1.1. Synthèse de l’Identité : Décris en 5 phrases la mission, l'historique et les offres clés de l'entreprise.

1.2. Données pour Graphe Visuel (Nuage de Mots Pondéré) : Génère les données pour un nuage de mots pondéré au format JSON. Tu dois fournir un tableau de 20 à 30 objets, où chaque objet contient une clé "mot" et une clé "poids" (un score de 10 à 100). Le poids doit refléter la fréquence et l'impact sémantique du terme.

1.3. Analyse de Sentiment Global : Évalue la perception publique (Positive, Neutre, Négative, Mixte) et justifie avec des exemples de thèmes récurrents.

1.4. Forces et Faiblesses Perçues : Liste 3 points forts et 3 points faibles mentionnés publiquement.

1.5. Principaux Sujets de Discussion : Identifie les 3 sujets les plus fréquemment associés à l'entreprise.

1.6. Pistes d'Amélioration Recommandées : Pour chaque faiblesse identifiée, propose une action marketing ou de communication corrective.

Partie 2 : Positionnement Concurrentiel (Cette partie ne sera générée que si des concurrents sont fournis)

Compare la réputation de ${projectName} à celle de ${competitor1 || "N/A"} et ${
    competitor2 || "N/A"
  } en te basant sur le sentiment en ligne, les spécialités perçues et les points forts mis en avant.

Partie 3 : Analyse de Visibilité dans les Réponses IA

En te basant sur toute ton analyse précédente (secteur d'activité, services clés, concurrents), ta mission pour cette partie se déroule en deux temps :

3.1. Génération de Questions : D'abord, formule une liste de 15 à 20 questions pertinentes et variées qu'un prospect ou un internaute pourrait poser à une IA grand public pour se renseigner sur les services de ${projectName} ou sur des sujets connexes où elle pourrait être mentionnée (ex: questions comparatives, questions sur le meilleur prestataire local, questions sur les tarifs, questions sur des services spécifiques, etc.).

3.2. Analyse de Visibilité : Ensuite, pour chacune des questions que tu viens de générer, fournis l'analyse concise en 3 points que nous avons définie :

Mention probable : Réponds par Oui, Non, ou Probable.
Justification : Explique en une courte phrase pourquoi (ex: "forte notoriété locale", "spécialiste reconnu du sujet", "la concurrence est plus visible sur ce créneau").
Concurrents cités : Liste les concurrents ou autres acteurs qui seraient probablement mentionnés.

---

Pied de Page du Rapport Termine ton rapport avec la notice méthodologique suivante : "Ce rapport est une synthèse générée par une IA en se basant sur les données publiques accessibles. Il constitue une analyse de réputation et non une vérité absolue.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
    });

    const analysis = response.choices[0].message.content;

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    return NextResponse.json(
      { error: "Failed to get analysis from OpenAI" },
      { status: 500 }
    );
  }
}
