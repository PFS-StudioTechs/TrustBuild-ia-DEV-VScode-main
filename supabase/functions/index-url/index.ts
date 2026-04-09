import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const CHARS_PER_TOKEN = 4;

function chunkText(text: string): string[] {
  const chunkChars = CHUNK_SIZE * CHARS_PER_TOKEN;
  const overlapChars = CHUNK_OVERLAP * CHARS_PER_TOKEN;
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkChars, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 20) chunks.push(chunk);
    if (end >= text.length) break;
    start += chunkChars - overlapChars;
  }
  return chunks;
}

async function embed(text: string, apiKey: string): Promise<number[]> {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
  });
  if (!resp.ok) throw new Error(`OpenAI embedding error: ${await resp.text()}`);
  const json = await resp.json();
  return json.data[0].embedding as number[];
}

/** Scrape une URL et retourne le texte brut */
async function scrapeUrl(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TrustBuildIA/1.0; +https://trust-build.ia)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "fr,en;q=0.9",
    },
    redirect: "follow",
  });

  if (!resp.ok) throw new Error(`Impossible d'accéder à l'URL (${resp.status})`);

  const contentType = resp.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    throw new Error("Le contenu de l'URL n'est pas du texte HTML");
  }

  const html = await resp.text();

  // Extraction du texte depuis le HTML
  let text = html
    // Supprime scripts et styles
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    // Remplace les balises block par des sauts de ligne
    .replace(/<\/?(p|div|h[1-6]|li|br|tr|td|th)[^>]*>/gi, "\n")
    // Supprime toutes les balises restantes
    .replace(/<[^>]+>/g, " ")
    // Décode les entités HTML courantes
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    // Nettoie les espaces multiples
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Récupère l'utilisateur depuis le JWT
    const token = authHeader.replace("Bearer ", "");
    const parts = token.split(".");
    if (parts.length !== 3) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let artisanId: string;
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      artisanId = payload.sub;
      if (!artisanId) throw new Error();
    } catch {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url } = await req.json();
    if (!url?.trim()) {
      return new Response(JSON.stringify({ error: "url requise" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Valide le format de l'URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
    } catch {
      return new Response(JSON.stringify({ error: "URL invalide (doit commencer par http:// ou https://)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Nom du document = domaine + chemin
    const nom = `${parsedUrl.hostname}${parsedUrl.pathname !== "/" ? parsedUrl.pathname : ""}`;

    // Crée l'entrée en BDD avec statut en_cours
    const { data: doc, error: docErr } = await supabase
      .from("knowledge_documents")
      .insert({
        artisan_id: artisanId,
        nom,
        type_fichier: "url",
        statut: "en_cours",
        storage_path: url, // on stocke l'URL dans storage_path
      })
      .select()
      .single();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: docErr?.message ?? "Erreur BDD" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Répond immédiatement avec le document créé, l'indexation continue en arrière-plan
    const response = new Response(JSON.stringify({ ok: true, document: doc }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    // Indexation asynchrone
    (async () => {
      try {
        const rawText = await scrapeUrl(url);

        if (rawText.length < 50) {
          await supabase.from("knowledge_documents").update({ statut: "erreur" }).eq("id", doc.id);
          return;
        }

        // Supprime les anciens chunks (re-indexation)
        await supabase.from("knowledge_chunks").delete().eq("document_id", doc.id);

        const chunks = chunkText(rawText);
        let indexed = 0;

        for (let i = 0; i < chunks.length; i++) {
          try {
            const embedding = await embed(chunks[i], openaiKey);
            await supabase.from("knowledge_chunks").insert({
              document_id: doc.id,
              artisan_id: artisanId,
              contenu: chunks[i],
              embedding: JSON.stringify(embedding),
              metadata: {
                chunk_index: i,
                total_chunks: chunks.length,
                document_nom: nom,
                source_url: url,
              },
            });
            indexed++;
          } catch (e) {
            console.error(`Erreur embedding chunk ${i}:`, e);
          }
        }

        await supabase
          .from("knowledge_documents")
          .update({ statut: indexed > 0 ? "indexe" : "erreur" })
          .eq("id", doc.id);
      } catch (e) {
        console.error("index-url background error:", e);
        await supabase.from("knowledge_documents").update({ statut: "erreur" }).eq("id", doc.id);
      }
    })();

    return response;
  } catch (e) {
    console.error("index-url error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
