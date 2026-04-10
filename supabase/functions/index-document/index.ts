import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CHUNK_SIZE = 500;   // tokens approximatifs (~4 chars/token → ~2000 chars)
const CHUNK_OVERLAP = 50; // overlap en tokens (~200 chars)
const CHARS_PER_TOKEN = 4;

// ---------------------------------------------------------------------------
// Extraction de texte selon le type MIME
// ---------------------------------------------------------------------------

function extractTextFromTxt(buffer: ArrayBuffer): string {
  return new TextDecoder("utf-8").decode(buffer);
}

/** Extraction PDF basique : lit les runs de texte lisible depuis les streams PDF */
function extractTextFromPdf(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const raw = new TextDecoder("latin1").decode(bytes);

  const parts: string[] = [];

  // Cherche les blocs entre BT (Begin Text) et ET (End Text)
  const btRegex = /BT([\s\S]*?)ET/g;
  let m: RegExpExecArray | null;
  while ((m = btRegex.exec(raw)) !== null) {
    const block = m[1];
    // Opérateurs Tj (single string) et TJ (array of strings)
    const strRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj|\[([^\]]*)\]\s*TJ/g;
    let s: RegExpExecArray | null;
    while ((s = strRegex.exec(block)) !== null) {
      const raw_str = s[1] ?? s[2] ?? "";
      const cleaned = raw_str
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\d{3}/g, " ")
        .replace(/\\(.)/g, "$1");
      if (cleaned.trim()) parts.push(cleaned);
    }
  }

  // Fallback : extraire les séquences ASCII lisibles si rien trouvé
  if (parts.length === 0) {
    const printable = raw.match(/[\x20-\x7E]{4,}/g) ?? [];
    return printable
      .filter((p) => !/^[\d\s.]+$/.test(p)) // ignorer séquences purement numériques
      .join(" ");
  }

  return parts.join(" ");
}

/** Extraction DOCX : lit le fichier XML word/document.xml dans le ZIP */
async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  // DOCX est un ZIP — on cherche word/document.xml
  try {
    const { BlobReader, TextWriter, ZipReader } = await import(
      "https://deno.land/x/zipjs@v2.7.52/index.js"
    );
    const blob = new Blob([buffer]);
    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();
    const docEntry = entries.find((e) => e.filename === "word/document.xml");
    if (!docEntry) return "";
    const text = await docEntry.getData!(new TextWriter());
    await reader.close();
    // Retire les balises XML
    return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

/** Extraction XLSX : lit le fichier XML xl/sharedStrings.xml */
async function extractTextFromXlsx(buffer: ArrayBuffer): Promise<string> {
  try {
    const { BlobReader, TextWriter, ZipReader } = await import(
      "https://deno.land/x/zipjs@v2.7.52/index.js"
    );
    const blob = new Blob([buffer]);
    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();

    const parts: string[] = [];

    // Shared strings (contient la plupart du texte)
    const sharedEntry = entries.find(
      (e) => e.filename === "xl/sharedStrings.xml"
    );
    if (sharedEntry) {
      const xml = await sharedEntry.getData!(new TextWriter());
      const matches = xml.match(/<t[^>]*>([^<]+)<\/t>/g) ?? [];
      matches.forEach((m) => {
        const v = m.replace(/<[^>]+>/g, "").trim();
        if (v) parts.push(v);
      });
    }

    await reader.close();
    return parts.join(" ");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Chunking avec overlap
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Génération d'embedding via OpenAI text-embedding-3-small
// ---------------------------------------------------------------------------

async function embed(text: string, apiKey: string): Promise<number[]> {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    }),
    signal: AbortSignal.timeout(30000), // 30s max par embedding
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI embedding error: ${err}`);
  }
  const json = await resp.json();
  return json.data[0].embedding as number[];
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

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

    // Récupère le user depuis le JWT utilisateur
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: "document_id requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Charge le document
    const { data: doc, error: docErr } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("id", document_id)
      .eq("artisan_id", user.id)
      .single();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Document introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Marque en cours
    await supabase
      .from("knowledge_documents")
      .update({ statut: "en_cours" })
      .eq("id", document_id);

    // Télécharge depuis storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("knowledge-documents")
      .download(doc.storage_path);

    if (dlErr || !fileData) {
      await supabase
        .from("knowledge_documents")
        .update({ statut: "erreur" })
        .eq("id", document_id);
      return new Response(JSON.stringify({ error: "Impossible de télécharger le fichier" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buffer = await fileData.arrayBuffer();
    const ext = doc.type_fichier.toLowerCase();

    let rawText = "";
    if (ext === "txt") {
      rawText = extractTextFromTxt(buffer);
    } else if (ext === "pdf") {
      rawText = extractTextFromPdf(buffer);
    } else if (ext === "docx") {
      rawText = await extractTextFromDocx(buffer);
    } else if (ext === "xlsx") {
      rawText = await extractTextFromXlsx(buffer);
    } else {
      // Tentative générique
      rawText = extractTextFromTxt(buffer);
    }

    rawText = rawText.replace(/\s+/g, " ").trim();
    if (rawText.length < 20) {
      const errMsg = ext === "pdf"
        ? "Impossible d'extraire du texte de ce PDF. Il s'agit peut-être d'un PDF scanné (image uniquement) — l'OCR n'est pas supporté."
        : "Impossible d'extraire du texte du document.";
      await supabase
        .from("knowledge_documents")
        .update({ statut: "erreur", metadata: { error: errMsg } })
        .eq("id", document_id);
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Supprime les anciens chunks (re-indexation)
    await supabase
      .from("knowledge_chunks")
      .delete()
      .eq("document_id", document_id);

    // Découpe en chunks et génère les embeddings
    const chunks = chunkText(rawText);
    let indexed = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const embedding = await embed(chunk, openaiKey);
        await supabase.from("knowledge_chunks").insert({
          document_id,
          artisan_id: user.id,
          contenu: chunk,
          embedding: JSON.stringify(embedding),
          metadata: {
            chunk_index: i,
            total_chunks: chunks.length,
            document_nom: doc.nom,
          },
        });
        indexed++;
      } catch (e) {
        console.error(`Erreur embedding chunk ${i}:`, e);
      }
    }

    // Marque comme indexé
    await supabase
      .from("knowledge_documents")
      .update({ statut: "indexe" })
      .eq("id", document_id);

    return new Response(
      JSON.stringify({ ok: true, chunks_indexed: indexed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("index-document error:", e);
    const errMsg = e instanceof Error ? e.message : "Erreur inconnue lors de l'indexation";
    // Tente de mettre le statut à erreur (best-effort, peut échouer si supabase pas encore init)
    try {
      const body = await req.clone().json().catch(() => ({}));
      const docId = (body as any).document_id;
      if (docId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const sb = createClient(supabaseUrl, serviceRoleKey);
        await sb.from("knowledge_documents")
          .update({ statut: "erreur", metadata: { error: errMsg } })
          .eq("id", docId);
      }
    } catch {}
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
