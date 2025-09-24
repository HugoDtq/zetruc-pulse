// src/components/projects/AnalysisTabs.tsx
"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import type { AnalysisReport } from "@/types/analysis";

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "positive" | "negative" | "mixed"; }) {
  const color =
    tone === "positive" ? "bg-emerald-100 text-emerald-700" :
    tone === "negative" ? "bg-rose-100 text-rose-700" :
    tone === "mixed" ? "bg-amber-100 text-amber-700" :
    "bg-muted text-foreground";
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>{children}</span>;
}

// Composant WordCloud amélioré dans le même style
function WordCloudImproved({ words }: { words: Array<{ mot: string; poids: number }> }) {
  // Fonction pour calculer la taille de police basée sur le poids
  const getFontSize = (poids: number) => {
    const minSize = 12;
    const maxSize = 28;
    const normalizedWeight = (poids - 30) / (100 - 30);
    return Math.max(minSize, Math.min(maxSize, minSize + normalizedWeight * (maxSize - minSize)));
  };

  // Palette de couleurs moderne
  const getColor = (poids: number) => {
    if (poids >= 80) return '#1e40af'; // Bleu foncé
    if (poids >= 60) return '#3b82f6'; // Bleu
    if (poids >= 45) return '#60a5fa'; // Bleu clair
    if (poids >= 35) return '#93c5fd'; // Bleu très clair
    return '#9ca3af'; // Gris
  };

  // Fonction pour obtenir l'opacité
  const getOpacity = (poids: number) => {
    return Math.max(0.7, Math.min(1, poids / 100));
  };

  return (
    <div className="rounded-xl border p-4">
      <h4 className="font-semibold mb-3">Nuage de mots pondéré</h4>
      
      {/* Nuage de mots */}
      <div className="flex flex-wrap gap-2 justify-center items-center min-h-[180px] mb-4">
        {words.map((word, index) => (
          <span
            key={index}
            className="inline-block px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-105 cursor-pointer"
            style={{
              fontSize: `${getFontSize(word.poids)}px`,
              color: getColor(word.poids),
              backgroundColor: `${getColor(word.poids)}15`,
              border: `1px solid ${getColor(word.poids)}25`,
              opacity: getOpacity(word.poids),
              fontWeight: word.poids >= 70 ? '600' : word.poids >= 50 ? '500' : 'normal'
            }}
            title={`Poids: ${word.poids}`}
          >
            {word.mot}
          </span>
        ))}
      </div>

      {/* Légende compacte */}
      <div className="flex items-center justify-center space-x-4 text-xs text-muted-foreground border-t pt-3">
        <div className="flex items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-800 mr-1.5"></div>
          <span>80+</span>
        </div>
        <div className="flex items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-1.5"></div>
          <span>60-79</span>
        </div>
        <div className="flex items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-300 mr-1.5"></div>
          <span>45-59</span>
        </div>
        <div className="flex items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-400 mr-1.5"></div>
          <span>&lt;45</span>
        </div>
      </div>
    </div>
  );
}

export default function AnalysisTabs({ data }: { data: AnalysisReport }) {
  // DEBUG: Vérifier si reponseIA arrive au front (vous pouvez enlever ces lignes plus tard)
  console.log("🔍 DEBUG Front: Première question:", data.part3.questions[0]);
  console.log("🎯 reponseIA dans le front:", !!data.part3.questions[0]?.reponseIA);
  
  // DEBUG: Vérifier part2 dans le front
  console.log("🔍 DEBUG Front part2:", data.part2);
  console.log("🔍 Front part2.present:", data.part2.present);
  console.log("🔍 Front part2.positionnementConcurrentiel:", data.part2.positionnementConcurrentiel);
  
  const sentimentTone =
    data.part1.sentimentGlobal.label === "Positive" ? "positive" :
    data.part1.sentimentGlobal.label === "Négative" ? "negative" :
    data.part1.sentimentGlobal.label === "Mixte" ? "mixed" : "neutral";

  return (
    <Tabs defaultValue="synthese" className="mt-6">
      <TabsList>
        <TabsTrigger value="synthese">Synthèse</TabsTrigger>
        <TabsTrigger value="concurrence">Positionnement concurrentiel</TabsTrigger>
        <TabsTrigger value="questions">Questions & visibilité</TabsTrigger>
      </TabsList>

      {/* TAB 1 : Synthèse */}
      <TabsContent value="synthese" className="mt-4 space-y-6">
        {/* Header meta */}
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{data.meta.brand}</h3>
              {data.meta.website && (
                <a className="text-sm text-blue-600 hover:underline" href={data.meta.website} target="_blank">{data.meta.website}</a>
              )}
              {data.meta.ville && <p className="text-sm text-muted-foreground">Ville : {data.meta.ville}</p>}
            </div>
            <div className="text-right">
              <div>
                <Pill tone={sentimentTone as any}>{data.part1.sentimentGlobal.label}</Pill>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Généré le {new Date(data.meta.generatedAt).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Synthèse identité */}
        <div className="rounded-xl border p-4 space-y-2">
          <h4 className="font-semibold">Synthèse de l'identité</h4>
          <ul className="list-disc pl-5 space-y-1">
            {data.part1.syntheseIdentite.map((p, i) => (
              <li key={i} className="text-sm leading-6">{p}</li>
            ))}
          </ul>
        </div>

        {/* Word cloud amélioré */}
        <WordCloudImproved words={data.part1.wordCloud} />

        {/* Forces & Faiblesses */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border p-4">
            <h4 className="font-semibold mb-2">Forces</h4>
            <ul className="list-disc pl-5 space-y-1">
              {data.part1.forces.map((x, i) => <li key={i} className="text-sm">{x}</li>)}
            </ul>
          </div>
          <div className="rounded-xl border p-4">
            <h4 className="font-semibold mb-2">Faiblesses</h4>
            <ul className="list-disc pl-5 space-y-1">
              {data.part1.faiblesses.map((x, i) => <li key={i} className="text-sm">{x}</li>)}
            </ul>
          </div>
        </div>

        {/* Sujets + Recos */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border p-4">
            <h4 className="font-semibold mb-2">Principaux sujets de discussion</h4>
            <ul className="list-disc pl-5 space-y-1">
              {data.part1.sujetsPrincipaux.map((x, i) => <li key={i} className="text-sm">{x}</li>)}
            </ul>
          </div>
          <div className="rounded-xl border p-4">
            <h4 className="font-semibold mb-2">Pistes d'amélioration recommandées</h4>
            <ul className="list-disc pl-5 space-y-1">
              {data.part1.recommandations.map((x, i) => <li key={i} className="text-sm">{x}</li>)}
            </ul>
          </div>
        </div>

        {/* Justification sentiment */}
        <div className="rounded-xl border p-4">
          <h4 className="font-semibold mb-2">Justification du sentiment global</h4>
          <p className="text-sm leading-6">{data.part1.sentimentGlobal.justification}</p>
        </div>
      </TabsContent>

      {/* TAB 2 : Concurrence */}
      <TabsContent value="concurrence" className="mt-4 space-y-4">
        {!data.part2.present ? (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            Aucun concurrent fourni : cette section n'a pas été générée.
          </div>
        ) : (
          <div className="rounded-xl border p-4">
            <h4 className="font-semibold mb-3">Comparaison concurrentielle</h4>
            {/* Affichage du texte libre de comparaison */}
            {typeof data.part2.positionnementConcurrentiel?.comparaison === 'string' ? (
              <div className="prose prose-sm max-w-none">
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {data.part2.positionnementConcurrentiel.comparaison}
                </p>
              </div>
            ) : (
              /* Fallback pour l'ancien format tableau (si il existe encore) */
              <div className="overflow-x-auto">
                <table className="min-w-[700px] w-full text-sm">
                  <thead className="text-left">
                    <tr className="border-b">
                      <th className="py-2 pr-4">Acteur</th>
                      <th className="py-2 pr-4">Sentiment</th>
                      <th className="py-2 pr-4">Spécialités perçues</th>
                      <th className="py-2 pr-4">Points forts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.part2.comparaison || []).map((row, i) => (
                      <tr key={i} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-4 font-medium">{row.acteur}</td>
                        <td className="py-2 pr-4">
                          {row.sentiment ? <Pill tone={
                            row.sentiment === "Positive" ? "positive" :
                            row.sentiment === "Négative" ? "negative" :
                            row.sentiment === "Mixte" ? "mixed" : "neutral"
                          }>{row.sentiment}</Pill> : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {row.specialites?.map((s, k) => (
                              <span key={k} className="rounded bg-muted px-2 py-0.5">{s}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          <ul className="list-disc pl-5 space-y-0.5">
                            {row.pointsForts?.map((p, k) => <li key={k}>{p}</li>)}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </TabsContent>

      {/* TAB 3 : Questions & visibilité */}
      <TabsContent value="questions" className="mt-4 space-y-4">
        <div className="rounded-xl border p-4">
          <h4 className="font-semibold mb-3">Questions générées & analyse de visibilité</h4>
          <Accordion type="single" collapsible className="w-full">
            {data.part3.questions.map((q, i) => (
              <AccordionItem key={i} value={`q-${i}`}>
                <AccordionTrigger className="text-left">{q.question}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium mr-2">Mention probable :</span>
                      <Pill tone={
                        q.mentionProbable === "Oui" ? "positive" :
                        q.mentionProbable === "Non" ? "negative" : "mixed"
                      }>
                        {q.mentionProbable}
                      </Pill>
                    </div>
                    <div>
                      <span className="font-medium">Justification :</span>{" "}
                      <span className="text-sm">{q.justification}</span>
                    </div>
                    <div>
                      <span className="font-medium">Concurrents cités :</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {q.concurrentsCites.map((c, k) => (
                          <span key={k} className="rounded bg-muted px-2 py-0.5 text-sm">{c}</span>
                        ))}
                        {q.concurrentsCites.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
                      </div>
                    </div>
                    
                    {/* Réponse IA - ajout minimal */}
                    {q.reponseIA && (
                      <div className="border-t pt-2 mt-3">
                        <div className="mb-1">
                          <span className="font-medium">Réponse de l'IA :</span>
                        </div>
                        <div className="text-sm leading-relaxed whitespace-pre-line bg-gray-50 rounded p-2">
                          {q.reponseIA}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="rounded-xl border p-4">
          <h4 className="font-semibold mb-2">Notice méthodologique</h4>
          <p className="text-sm leading-6">{data.part3.noteMethodo}</p>
        </div>
      </TabsContent>
    </Tabs>
  );
}