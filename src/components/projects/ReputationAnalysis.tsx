"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, AlertCircle } from "lucide-react";

// Define the structure for the parsed analysis data
interface AnalysisData {
  synthese: string;
  nuageDeMots: { mot: string; poids: number }[];
  sentiment: string;
  forces: string;
  faiblesses: string;
  sujets: string;
  pistes: string;
  positionnement: string;
  questions: {
    question: string;
    mention: string;
    justification: string;
    concurrents: string;
  }[];
}

// Helper function to parse the raw text from the AI
const parseAnalysis = (text: string): AnalysisData => {
  const getSection = (start: string, end?: string) => {
    const startIndex = text.indexOf(start);
    if (startIndex === -1) return "";
    const contentStart = startIndex + start.length;
    const endIndex = end ? text.indexOf(end, contentStart) : undefined;
    return text.substring(contentStart, endIndex).trim();
  };

  const nuageSection = getSection("1.2. Données pour Graphe Visuel (Nuage de Mots Pondéré) :", "1.3. Analyse de Sentiment Global");
  let nuageDeMots: { mot: string; poids: number }[] = [];
  try {
    const jsonMatch = nuageSection.match(/```json\n([\s\S]*?)\n```|(\[[\s\S]*\])/);
    if (jsonMatch) {
      nuageDeMots = JSON.parse(jsonMatch[1] || jsonMatch[2]);
    }
  } catch (e) {
    console.error("Failed to parse word cloud JSON:", e);
  }

  const questionsText = getSection("3.1. Génération de Questions :", "Pied de Page du Rapport");
  const questionBlocks = questionsText.split(/\d+\.\s+/).filter(Boolean);
  const questions = questionBlocks.map(block => {
      const questionMatch = block.match(/^(.*)/);
      const mentionMatch = block.match(/Mention probable\s?:\s?(.*)/);
      const justificationMatch = block.match(/Justification\s?:\s?(.*)/);
      const concurrentsMatch = block.match(/Concurrents cités\s?:\s?(.*)/);
      return {
          question: questionMatch ? questionMatch[1].trim() : "N/A",
          mention: mentionMatch ? mentionMatch[1].trim() : "N/A",
          justification: justificationMatch ? justificationMatch[1].trim() : "N/A",
          concurrents: concurrentsMatch ? concurrentsMatch[1].trim() : "N/A",
      };
  });


  return {
    synthese: getSection("1.1. Synthèse de l’Identité :", "1.2. Données pour Graphe Visuel"),
    nuageDeMots,
    sentiment: getSection("1.3. Analyse de Sentiment Global :", "1.4. Forces et Faiblesses Perçues"),
    forces: getSection("Forces perçues :", "Faiblesses perçues :") || getSection("Points forts :", "Points faibles :"),
    faiblesses: getSection("Faiblesses perçues :", "1.5. Principaux Sujets de Discussion") || getSection("Points faibles :", "1.5. Principaux Sujets de Discussion"),
    sujets: getSection("1.5. Principaux Sujets de Discussion :", "1.6. Pistes d'Amélioration Recommandées"),
    pistes: getSection("1.6. Pistes d'Amélioration Recommandées :", "Partie 2 : Positionnement Concurrentiel"),
    positionnement: getSection("Partie 2 : Positionnement Concurrentiel", "Partie 3 : Analyse de Visibilité"),
    questions,
  };
};


export default function ReputationAnalysis({ project }: { project: any }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);

  const handleAnalyse = async () => {
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch("/api/reputation/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: project.name,
          websiteUrl: project.websiteUrl,
          // Note: Competitors are not in the project model yet.
          // This would be an improvement for later.
          competitor1: "",
          competitor2: "",
          city: project.city,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Une erreur est survenue.");
      }

      const data = await response.json();
      if (data.analysis) {
        setAnalysis(parseAnalysis(data.analysis));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Analyse de réputation IA</h2>
        <Button onClick={handleAnalyse} disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Lancer l'analyse
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
          <AlertCircle className="h-5 w-5" />
          <div>{error}</div>
        </div>
      )}

      {analysis && (
        <Tabs defaultValue="bilan" className="w-full">
          <TabsList>
            <TabsTrigger value="bilan">Bilan de Réputation</TabsTrigger>
            <TabsTrigger value="concurrence" disabled={!analysis.positionnement.trim()}>Positionnement</TabsTrigger>
            <TabsTrigger value="visibilite">Analyse de Visibilité</TabsTrigger>
          </TabsList>

          <TabsContent value="bilan" className="mt-4 space-y-4 rounded-2xl border p-4 dark:border-zinc-800">
            <div className="prose prose-sm dark:prose-invert max-w-none">
                <h4>Synthèse de l’identité</h4>
                <p>{analysis.synthese}</p>

                <h4>Analyse de Sentiment Global</h4>
                <p>{analysis.sentiment}</p>

                <h4>Forces et Faiblesses Perçues</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h5>Forces</h5>
                        <p>{analysis.forces}</p>
                    </div>
                    <div>
                        <h5>Faiblesses</h5>
                        <p>{analysis.faiblesses}</p>
                    </div>
                </div>

                <h4>Principaux Sujets de Discussion</h4>
                <p>{analysis.sujets}</p>

                <h4>Pistes d'Amélioration Recommandées</h4>
                <p>{analysis.pistes}</p>

                <h4>Données pour Nuage de Mots</h4>
                <pre className="whitespace-pre-wrap rounded-md bg-gray-100 p-2 text-xs dark:bg-zinc-900">
                    {JSON.stringify(analysis.nuageDeMots, null, 2)}
                </pre>
            </div>
          </TabsContent>

          <TabsContent value="concurrence" className="mt-4 space-y-4 rounded-2xl border p-4 dark:border-zinc-800">
             <div className="prose prose-sm dark:prose-invert max-w-none">
                <h4>Positionnement Concurrentiel</h4>
                <p>{analysis.positionnement || "Aucune donnée de concurrence n'a été fournie pour l'analyse."}</p>
            </div>
          </TabsContent>

          <TabsContent value="visibilite" className="mt-4">
            <Accordion type="single" collapsible className="w-full">
              {analysis.questions.map((q, i) => (
                <AccordionItem value={`item-${i}`} key={i}>
                  <AccordionTrigger>{q.question}</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm">
                        <p><b>Mention probable :</b> {q.mention}</p>
                        <p><b>Justification :</b> {q.justification}</p>
                        <p><b>Concurrents cités :</b> {q.concurrents}</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}
