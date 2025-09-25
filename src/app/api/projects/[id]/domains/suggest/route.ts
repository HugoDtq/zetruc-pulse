// src/app/api/projects/[id]/domains/suggest/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getOpenAIKey } from "@/lib/llm";

const prisma = new PrismaClient();

/* ----------------------- Utils ----------------------- */

function buildAliasesText(json?: string | null) {
  if (!json) return "—";
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) && arr.length ? arr.join(", ") : "—";
  } catch {
    return "—";
  }
}

function stripCodeFences(text: string) {
  return String(text ?? "")
    .replace(/^```[\s\S]*?json\n?/i, "")
    .replace(/```$/i, "")
    .replace(/```/g, "")
    .trim();
}

function normalizeList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean);

  const toStrings = (value: unknown): string[] => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }
    if (Array.isArray(value)) {
      return value.flatMap(toStrings);
    }
    if (value && typeof value === "object") {
      return Object.values(value).flatMap(toStrings);
    }
    return [];
  };

  if (typeof raw !== "string") return [];
  let text = stripCodeFences(raw);
  try {
    const parsed = JSON.parse(text);
    const list = toStrings(parsed);
    if (list.length) return list;
  } catch {}
  return text
    .split(/\r?\n|,|;/)
    .map((s) => s.replace(/^[-*•\s]+/, "").trim())
    .filter(Boolean);
}

function sanitizeCompetitors(
  items: Array<{ name: string; website?: string }>
): Array<{ name: string; website?: string }> {
  const out: Array<{ name: string; website?: string }> = [];
  for (const it of items) {
    if (!it?.name) continue;
    let website: string | undefined;
    if (it.website) {
      try {
        const u = new URL(it.website);
        if (["http:", "https:"].includes(u.protocol) && u.hostname.includes(".")) {
          website = it.website;
        }
      } catch {
        /* ignore */
      }
    }
    const key = it.name.toLowerCase();
    if (!out.some((e) => e.name.toLowerCase() === key)) out.push({ name: it.name, website });
  }
  return out.slice(0, 20);
}

/* -------------------- OpenAI helpers -------------------- */

/** Chat completions (gpt-4o-mini) — rapide */
async function callChat({
  apiKey,
  model,
  messages,
  temperature = 0.2,
  timeoutMs = 9000,
}: {
  apiKey: string;
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  timeoutMs?: number;
}): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        messages,
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    const json = await resp.json();
    return String(json?.choices?.[0]?.message?.content ?? "");
  } finally {
    clearTimeout(t);
  }
}

/** GPT-4o avec Web Search via API Responses - Structure exacte du playground */
async function callGPT4oResponsesWithWebSearch({
  apiKey,
  brand,
  city,
  domainName,
  timeoutMs = 30000,
}: {
  apiKey: string;
  brand: string;
  city: string;
  domainName: string;
  timeoutMs?: number;
}): Promise<string> {
  // Structure EXACTE du playground avec GPT-4o
  const body = {
    model: "gpt-4o",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Peux-tu me donner des concurrents directs de "${brand}" localisé à ${city}, dans le domaine "${domainName}".
Contraintes OBLIGATOIRES :
Même ville : ${city} Même domaine : ${domainName} Ne pas inventer. Réponds strictement au format JSON suivant (sans texte autour) : { "competitors": [ { "name": "Nom", "website": "https://..." } ] }`
          }
        ]
      }
    ],
    text: {
      format: {
        type: "text"
      }
    },
    reasoning: {}, // Vide comme dans le playground
    tools: [
      {
        type: "web_search",
        user_location: {
          type: "approximate"
        },
        search_context_size: "medium"
      }
    ],
    temperature: 1,
    max_output_tokens: 2048,
    top_p: 1,
    store: false, // false pour l'API (true dans playground uniquement)
    include: ["web_search_call.action.sources"]
  };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  
  try {
    console.log("🚀 GPT-4o Responses API (structure playground)...");
    console.log(`📍 Paramètres: ${brand} | ${city} | ${domainName}`);
    
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        // Pas de openai-beta pour GPT-4o contrairement à o3
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error(`❌ GPT-4o Responses API Error (${resp.status}):`, errorText);
      throw new Error(`GPT-4o Responses API Error: ${resp.status} - ${errorText}`);
    }

    const json = await resp.json();
    console.log("✅ Réponse GPT-4o reçue, clés:", Object.keys(json));
    
    // Debug web search
    if (json.web_search_call) {
      const searches = Array.isArray(json.web_search_call) ? json.web_search_call : [json.web_search_call];
      console.log("🔍 Web search détecté:", searches.length, "recherches");
    }
    
    // Extraction du contenu - Multiple tentatives
    let content = "";
    
    // Priorité 1: output_text
    if (json.output_text) {
      content = json.output_text;
      console.log("📄 Contenu extrait via output_text");
    }
    // Priorité 2: text.content
    else if (json.text?.content) {
      content = json.text.content;
      console.log("📄 Contenu extrait via text.content");
    }
    // Priorité 3: result
    else if (json.result) {
      content = typeof json.result === 'string' ? json.result : JSON.stringify(json.result);
      console.log("📄 Contenu extrait via result");
    }
    // Priorité 4: response
    else if (json.response) {
      content = typeof json.response === 'string' ? json.response : JSON.stringify(json.response);
      console.log("📄 Contenu extrait via response");
    }
    // Priorité 5: exploration
    else {
      console.log("🔍 Structure inconnue, exploration complète...");
      
      // Chercher récursivement le JSON competitors
      const findCompetitors = (obj: any, path = ""): string => {
        if (typeof obj === 'string' && obj.includes('competitors')) {
          console.log(`📄 JSON trouvé dans ${path}`);
          return obj;
        }
        if (typeof obj === 'object' && obj !== null) {
          for (const [key, value] of Object.entries(obj)) {
            const result = findCompetitors(value, `${path}.${key}`);
            if (result) return result;
          }
        }
        return "";
      };
      
      content = findCompetitors(json);
      
      if (!content) {
        console.log("📋 Aucun contenu trouvé, structure complète:");
        console.log(JSON.stringify(json, null, 2).substring(0, 1000));
      }
    }

    console.log(`📊 Contenu final: ${content.length} caractères`);
    if (content.length > 0) {
      console.log("📋 Aperçu:", content.substring(0, 300) + "...");
    }
    
    return content;
    
  } finally {
    clearTimeout(t);
  }
}

/* ----------------------- Handler ----------------------- */

type ReqBody =
  | { type: "domains" }
  | { type: "competitors"; domainName: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      name: true,
      description: true,
      countryCode: true,
      city: true,
      aliasesJson: true,
      websiteUrl: true,
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const openAIKey = await getOpenAIKey();
  if (!openAIKey) {
    return NextResponse.json(
      { error: "Clé OpenAI manquante dans la configuration Superadmin" },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as ReqBody;

  /* ---------- 1) Suggestions de domaines (rapide) ---------- */
  if (body.type === "domains") {
    const user = `
Tu es un consultant marketing. À partir des informations ci-dessous, propose **5 à 8** domaines d'activité pertinents pour la marque. 
Réponds **uniquement** avec un **tableau JSON** de chaînes (ex: ["Conseil", "Technologie"]).

Contexte:
- Marque: ${project.name}
- Description: ${project.description ?? "—"}
- Pays: ${project.countryCode ?? "—"}
- Ville: ${project.city ?? "—"}
- Alias/produits: ${buildAliasesText(project.aliasesJson)}
- Site: ${project.websiteUrl ?? "—"}
`.trim();

    try {
      const raw = await callChat({
        apiKey: openAIKey,
        model: "gpt-4o-mini",
        temperature: 0.5,
        messages: [{ role: "user", content: user }],
        timeoutMs: 7000,
      });
      const items = normalizeList(raw).slice(0, 15);
      return NextResponse.json({ items });
    } catch (e: any) {
      return NextResponse.json(
        { error: "OpenAI error", detail: String(e?.message || e) },
        { status: 500 }
      );
    }
  }

  /* ---------- 2) Suggestions de concurrents (GPT-4o rapide + Web Search) ---------- */
  if (body.type === "competitors") {
    const domainName = (body.domainName ?? "").trim();
    if (!domainName) {
      return NextResponse.json({ error: "domainName requis" }, { status: 400 });
    }

    const brand = project.name;
    const city = (project.city ?? "").trim();
    const country = (project.countryCode ?? "").trim();

    try {
      console.log("⚡ Recherche rapide avec GPT-4o + web search...");
      console.log(`📍 Paramètres: ${brand} | ${city} | ${domainName}`);
      
      let result = "";
      let source = "none";
      let webSearchUsed = false;

      // 1. GPT-4o avec API Responses (structure exacte du playground)
      try {
        console.log("1. GPT-4o Responses API (playground structure)...");
        result = await callGPT4oResponsesWithWebSearch({
          apiKey: openAIKey,
          brand,
          city,
          domainName,
          timeoutMs: 35000, // Plus généreux pour API Responses
        });
        
        if (result && result.length > 50) {
          source = "gpt4o-responses";
          webSearchUsed = true; // API Responses avec web_search = web search utilisé
          console.log("✅ GPT-4o Responses API réussi");
        }
      } catch (responsesError: any) {
        console.log("❌ GPT-4o Responses API échoué:", responsesError.message);
        
        // 2. GPT-4o Chat Completions (fallback)
        try {
          console.log("2. GPT-4o Chat Completions (fallback)...");
          result = await callGPT4oWithWebSearch({
            apiKey: openAIKey,
            brand,
            city,
            domainName,
            timeoutMs: 25000,
          });
          
          if (result && result.length > 50) {
            source = "gpt4o-chat";
            webSearchUsed = true;
            console.log("✅ GPT-4o Chat Completions réussi");
          }
        } catch (chatError: any) {
          console.log("❌ GPT-4o Chat aussi échoué:", chatError.message);
        }
      }

      // 3. o3 Fallback (si GPT-4o échoue complètement)
      if (!result || result.length < 30) {
        try {
          console.log("3. Fallback o3 (lent mais précis)...");
          
          // o3 avec structure playground
          const o3Body = {
            model: "o3",
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: `Peux-tu me donner des concurrents directs de "${brand}" localisé à ${city}, dans le domaine "${domainName}".

Contraintes OBLIGATOIRES :
Même ville : ${city}
Même domaine : ${domainName}
Ne pas inventer.
Réponds strictement au format JSON suivant (sans texte autour) : { "competitors": [ { "name": "Nom", "website": "https://..." } ] }`
                  }
                ]
              }
            ],
            text: {
              format: {
                type: "text"
              }
            },
            reasoning: {
              effort: "medium"
            },
            tools: [
              {
                type: "web_search",
                user_location: {
                  type: "approximate"
                },
                search_context_size: "medium"
              }
            ],
            store: false,
            include: ["web_search_call.action.sources"]
          };

          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 45000);
          
          try {
            const resp = await fetch("https://api.openai.com/v1/responses", {
              method: "POST",
              signal: ctrl.signal,
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${openAIKey}`,
                "openai-beta": "reasoning-alpha-20250109",
              },
              body: JSON.stringify(o3Body),
            });

            if (resp.ok) {
              const json = await resp.json();
              const content = json.output_text || json.text?.content || json.result || "";
              
              if (content && content.length > 50) {
                result = content;
                source = "o3-fallback";
                webSearchUsed = true;
                console.log("✅ o3 fallback réussi");
              }
            }
          } finally {
            clearTimeout(t);
          }
        } catch (o3Error: any) {
          console.log("❌ o3 fallback aussi échoué:", o3Error.message);
        }
      }

      // 4. Dernier recours GPT-4o-mini simple
      if (!result || result.length < 30) {
        console.log("4. Dernier recours GPT-4o-mini...");
        const fallbackPrompt = `
Trouve 5-10 concurrents de "${brand}" à ${city} dans le domaine "${domainName}".
Format JSON uniquement: {"competitors": [{"name": "...", "website": "..."}]}
`;
        
        try {
          result = await callChat({
            apiKey: openAIKey,
            model: "gpt-4o-mini",
            temperature: 0.1,
            messages: [
              { role: "system", content: "Réponds en JSON strict." },
              { role: "user", content: fallbackPrompt },
            ],
            timeoutMs: 10000,
          });
          
          source = "gpt4mini-fallback";
          console.log("✅ GPT-4o-mini fallback réussi");
        } catch (miniError: any) {
          console.log("❌ Tous les fallbacks ont échoué:", miniError.message);
        }
      }

      // Si aucun résultat
      if (!result || result.length < 10) {
        return NextResponse.json({
          error: "Aucun résultat obtenu",
          message: "Toutes les méthodes ont échoué",
          debug: {
            source,
            resultLength: result.length,
            brand,
            city,
            domainName,
            attempts: ["gpt4o-websearch", "gpt4o-alt", "o3-fallback", "gpt4mini-fallback"]
          }
        }, { status: 503 });
      }

      // Parsing du résultat JSON - Version optimisée
      const parseCompetitors = (raw: string) => {
        if (!raw?.trim()) return [];
        
        console.log(`🔧 Parsing résultat (${raw.length} chars)`);
        
        // Nettoyer le texte
        let cleanText = raw.trim();
        cleanText = stripCodeFences(cleanText);
        
        let items: Array<{ name: string; website?: string }> = [];
        
        try {
          // Tentative parsing JSON direct
          const parsed = JSON.parse(cleanText);
          
          if (parsed && typeof parsed === "object") {
            const arr = Array.isArray(parsed.competitors) 
              ? parsed.competitors 
              : Array.isArray(parsed) 
                ? parsed 
                : [];
                
            items = arr
              .map((o: any) => {
                if (!o || typeof o !== 'object') return null;
                return {
                  name: String(o.name || "").trim(),
                  website: String(o.website || "").trim() || undefined,
                };
              })
              .filter((item: any) => {
                return item && 
                       item.name && 
                       item.name.length > 2 && 
                       !item.name.toLowerCase().includes(brand.toLowerCase());
              });
          }
        } catch (parseError) {
          console.log("❌ JSON parsing échoué, tentative regex...");
          
          // Regex de secours
          const matches = cleanText.matchAll(/"name"\s*:\s*"([^"]+)"(?:[^}]*?"website"\s*:\s*"([^"]*)")?/g);
          items = Array.from(matches).map(match => ({
            name: match[1].trim(),
            website: match[2]?.trim() || undefined
          })).filter(item => item.name.length > 2);
        }
        
        return sanitizeCompetitors(items);
      };

      const finalItems = parseCompetitors(result);
      const executionTime = source.includes('o3') ? "~45-90s" : "~10-20s";
      
      console.log(`⚡ RÉSULTAT: ${finalItems.length} concurrents en ${executionTime}`);
      console.log(`🔍 Source: ${source}, Web search: ${webSearchUsed ? "✅" : "❌"}`);

      if (finalItems.length > 0) {
        return NextResponse.json({ 
          items: finalItems, 
          source, 
          webSearchUsed,
          method: "gpt4o-fast-websearch",
          totalFound: finalItems.length,
          executionTime,
          performance: source.includes('gpt4o') ? "fast" : "slow"
        });
      } else {
        return NextResponse.json({ 
          items: [], 
          source,
          webSearchUsed,
          error: "Aucun concurrent parsé",
          debug: { 
            resultLength: result.length,
            resultPreview: result.substring(0, 300)
          } 
        });
      }

    } catch (e: any) {
      console.error("❌ Erreur critique:", e);
      return NextResponse.json(
        { 
          error: "Erreur lors de la recherche", 
          detail: String(e?.message || e)
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "type invalide" }, { status: 400 });
}