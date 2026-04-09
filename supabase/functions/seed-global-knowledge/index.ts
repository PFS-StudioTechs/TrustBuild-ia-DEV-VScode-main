import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Catalogue des sources globales BTP ──────────────────────────────────────
// Sélection de pages accessibles (pas de Cloudflare agressif sur les sous-pages)
const GLOBAL_SOURCES: Array<{ url: string; nom: string; categorie: string }> = [
  // ── Castorama ──────────────────────────────────────────────────────────────
  {
    url: "https://www.castorama.fr/idees-conseils/pieces/salle-de-bain",
    nom: "Castorama — Conseils salle de bain",
    categorie: "bricolage",
  },
  {
    url: "https://www.castorama.fr/idees-conseils/travaux/plomberie",
    nom: "Castorama — Conseils plomberie",
    categorie: "bricolage",
  },
  {
    url: "https://www.castorama.fr/idees-conseils/travaux/electricite",
    nom: "Castorama — Conseils électricité",
    categorie: "bricolage",
  },
  {
    url: "https://www.castorama.fr/idees-conseils/travaux/peinture",
    nom: "Castorama — Conseils peinture",
    categorie: "bricolage",
  },
  {
    url: "https://www.castorama.fr/idees-conseils/travaux/carrelage",
    nom: "Castorama — Conseils carrelage",
    categorie: "bricolage",
  },
  // ── Brico Dépôt ───────────────────────────────────────────────────────────
  {
    url: "https://www.bricodepot.fr/conseils-bricolage/plomberie/",
    nom: "Brico Dépôt — Guide plomberie",
    categorie: "bricolage",
  },
  {
    url: "https://www.bricodepot.fr/conseils-bricolage/electricite/",
    nom: "Brico Dépôt — Guide électricité",
    categorie: "bricolage",
  },
  {
    url: "https://www.bricodepot.fr/conseils-bricolage/peinture/",
    nom: "Brico Dépôt — Guide peinture",
    categorie: "bricolage",
  },
  // ── Leroy Merlin (sous-pages conseils, moins protégées que la home) ────────
  {
    url: "https://www.leroymerlin.fr/comment-choisir/plomberie-sanitaire/",
    nom: "Leroy Merlin — Guide plomberie & sanitaire",
    categorie: "bricolage",
  },
  {
    url: "https://www.leroymerlin.fr/comment-choisir/electricite/",
    nom: "Leroy Merlin — Guide électricité",
    categorie: "bricolage",
  },
  {
    url: "https://www.leroymerlin.fr/comment-choisir/peinture/",
    nom: "Leroy Merlin — Guide peinture",
    categorie: "bricolage",
  },
  {
    url: "https://www.leroymerlin.fr/comment-choisir/carrelage/",
    nom: "Leroy Merlin — Guide carrelage",
    categorie: "bricolage",
  },
  // ── Réglementation & normes ───────────────────────────────────────────────
  {
    url: "https://www.service-public.fr/professionnels-entreprises/vosdroits/F23449",
    nom: "Service-Public — Artisan : obligations légales",
    categorie: "reglementation",
  },
  {
    url: "https://www.service-public.fr/professionnels-entreprises/vosdroits/F23461",
    nom: "Service-Public — Garanties construction (décennale, biennale)",
    categorie: "reglementation",
  },
  {
    url: "https://www.service-public.fr/professionnels-entreprises/vosdroits/F31132",
    nom: "Service-Public — Devis et factures artisan",
    categorie: "reglementation",
  },
  {
    url: "https://bpifrance-creation.fr/encyclopedie/statuts-juridiques/entreprise-individuelle/auto-entrepreneur-micro-entrepreneur",
    nom: "BPI France — Micro-entrepreneur : guide complet",
    categorie: "reglementation",
  },
  // ── Sécurité & prévention ─────────────────────────────────────────────────
  {
    url: "https://www.oppbtp.fr/nos-offres/prevention-risques-metiers/",
    nom: "OPPBTP — Prévention des risques BTP",
    categorie: "securite",
  },
  // ── Fédérations ───────────────────────────────────────────────────────────
  {
    url: "https://www.ffbatiment.fr/federation-francaise-du-batiment/le-secteur-du-batiment/le-secteur-en-chiffres/",
    nom: "FFB — Secteur du bâtiment en chiffres",
    categorie: "secteur",
  },
];

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
  if (!resp.ok) throw new Error(`OpenAI: ${await resp.text()}`);
  return (await resp.json()).data[0].embedding as number[];
}

async function scrapeUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let resp: Response;
  try {
    resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });
  } catch (e: any) {
    throw new Error(e?.name === "AbortError" ? "Timeout 20s" : e?.message ?? String(e));
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const html = await resp.text();
  const htmlLow = html.toLowerCase();

  if (
    (htmlLow.includes("cloudflare") && htmlLow.includes("challenge")) ||
    (html.length < 5000 && htmlLow.includes("enable javascript"))
  ) throw new Error("Protection anti-bot détectée");

  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<\/?(p|div|h[1-6]|li|br|tr|td|th)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // Only allow super_admin / service role calls
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;
    const openaiKey   = Deno.env.get("OPENAI_API_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: cors });

    const db = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await db.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = roles?.some(r => ["admin", "super_admin"].includes(r.role));
    if (!isAdmin) return new Response(JSON.stringify({ error: "Réservé aux admins" }), { status: 403, headers: cors });

    const body = await req.json().catch(() => ({}));
    // Allow re-seeding specific URLs or all
    const urlsToSeed: string[] = body.urls ?? GLOBAL_SOURCES.map(s => s.url);

    const results: Array<{ url: string; status: "ok" | "skip" | "error"; chunks?: number; error?: string }> = [];

    for (const urlStr of urlsToSeed) {
      const source = GLOBAL_SOURCES.find(s => s.url === urlStr);
      if (!source) { results.push({ url: urlStr, status: "skip", error: "URL inconnue" }); continue; }

      // Check if already indexed (skip unless force)
      const { data: existing } = await db.from("knowledge_documents")
        .select("id, statut")
        .eq("storage_path", source.url)
        .eq("is_global", true)
        .maybeSingle();

      if (existing?.statut === "indexe" && !body.force) {
        results.push({ url: urlStr, status: "skip" });
        continue;
      }

      // Delete old doc + chunks if re-indexing
      if (existing?.id) {
        await db.from("knowledge_chunks").delete().eq("document_id", existing.id);
        await db.from("knowledge_documents").delete().eq("id", existing.id);
      }

      // Create doc
      const { data: doc, error: docErr } = await db.from("knowledge_documents").insert({
        artisan_id: user.id, // admin as owner
        nom: source.nom,
        type_fichier: "url",
        statut: "en_cours",
        storage_path: source.url,
        is_global: true,
        metadata: { categorie: source.categorie },
      }).select().single();

      if (docErr || !doc) {
        results.push({ url: urlStr, status: "error", error: docErr?.message });
        continue;
      }

      try {
        const text = await scrapeUrl(source.url);
        if (text.length < 50) throw new Error("Contenu trop court");

        const chunks = chunkText(text);
        let indexed = 0;
        for (let i = 0; i < chunks.length; i++) {
          try {
            const embedding = await embed(chunks[i], openaiKey);
            await db.from("knowledge_chunks").insert({
              document_id: doc.id,
              artisan_id: user.id,
              contenu: chunks[i],
              embedding: JSON.stringify(embedding),
              is_global: true,
              metadata: {
                chunk_index: i,
                total_chunks: chunks.length,
                document_nom: source.nom,
                source_url: source.url,
                categorie: source.categorie,
              },
            });
            indexed++;
          } catch { /* skip bad chunk */ }
        }

        await db.from("knowledge_documents").update({
          statut: indexed > 0 ? "indexe" : "erreur",
          metadata: { categorie: source.categorie, chunks: indexed },
        } as any).eq("id", doc.id);

        results.push({ url: urlStr, status: "ok", chunks: indexed });
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        await db.from("knowledge_documents").update({
          statut: "erreur",
          metadata: { categorie: source.categorie, error: msg },
        } as any).eq("id", doc.id);
        results.push({ url: urlStr, status: "error", error: msg });
      }

      // Small delay between requests to be polite
      await new Promise(r => setTimeout(r, 1000));
    }

    const ok = results.filter(r => r.status === "ok").length;
    const errors = results.filter(r => r.status === "error").length;
    const skipped = results.filter(r => r.status === "skip").length;

    return new Response(JSON.stringify({ ok, errors, skipped, results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: cors }
    );
  }
});
