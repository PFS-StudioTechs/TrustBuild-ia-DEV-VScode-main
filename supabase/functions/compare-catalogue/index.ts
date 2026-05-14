import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ProduitExtrait = {
  reference: string | null;
  designation: string;
  unite: string;
  prix_achat: number;
};

type EcartPrix = {
  reference: string | null;
  designation: string;
  unite_pdf: string;
  unite_db: string;
  prix_pdf: number;
  prix_db: number;
  delta: number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: cors });
    }

    const db = createClient(supabaseUrl, serviceKey);
    const { import_id } = await req.json();

    if (!import_id) {
      return new Response(JSON.stringify({ error: "import_id requis" }), { status: 400, headers: cors });
    }

    // Récupérer l'import
    const { data: imp, error: impErr } = await db
      .from("catalogue_imports")
      .select("fichier_url, fichier_type, artisan_id")
      .eq("id", import_id)
      .single();

    if (impErr || !imp) {
      return new Response(JSON.stringify({ error: "Import introuvable" }), { status: 404, headers: cors });
    }

    // Télécharger le fichier source
    const { data: fileData, error: dlErr } = await db.storage
      .from("artisan-documents")
      .download(imp.fichier_url);

    if (dlErr || !fileData) {
      throw new Error(`Téléchargement fichier: ${dlErr?.message}`);
    }

    // Extraire les produits du fichier source
    const produitsPDF = await extractFromFile(fileData, imp.fichier_type, anthropicKey);

    // Récupérer les produits en base
    const { data: produitsDB } = await db
      .from("produits")
      .select("reference, designation, unite, prix_achat")
      .eq("import_id", import_id)
      .eq("actif", true);

    const dbList = (produitsDB ?? []) as ProduitExtrait[];

    // Index par référence pour comparaison rapide
    const indexPDF = buildIndex(produitsPDF);
    const indexDB  = buildIndex(dbList);

    const manquants: ProduitExtrait[] = [];
    const fantomes: ProduitExtrait[]  = [];
    const ecarts_prix: EcartPrix[]    = [];

    // Articles dans PDF mais pas en DB
    for (const [key, p] of indexPDF) {
      if (!indexDB.has(key)) {
        manquants.push(p);
      } else {
        const d = indexDB.get(key)!;
        const delta = Math.abs(p.prix_achat - d.prix_achat);
        if (delta > 0.02) {
          ecarts_prix.push({
            reference: p.reference,
            designation: p.designation,
            unite_pdf: p.unite,
            unite_db: d.unite,
            prix_pdf: p.prix_achat,
            prix_db: d.prix_achat,
            delta: Math.round(delta * 100) / 100,
          });
        }
      }
    }

    // Articles en DB mais pas dans PDF
    for (const [key, d] of indexDB) {
      if (!indexPDF.has(key)) {
        fantomes.push(d);
      }
    }

    return new Response(
      JSON.stringify({
        total_pdf: produitsPDF.length,
        total_db: dbList.length,
        manquants,
        fantomes,
        ecarts_prix,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("compare-catalogue error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: cors }
    );
  }
});

function buildIndex(list: ProduitExtrait[]): Map<string, ProduitExtrait> {
  const map = new Map<string, ProduitExtrait>();
  for (const p of list) {
    const key = p.reference
      ? p.reference.trim().toLowerCase()
      : p.designation.trim().toLowerCase().slice(0, 40);
    map.set(key, p);
  }
  return map;
}

const MAX_PDF_PAGES = 90;

async function extractFromFile(
  fileData: Blob,
  fichier_type: string,
  anthropicKey: string
): Promise<ProduitExtrait[]> {
  if (fichier_type === "csv") {
    return parseCSV(await fileData.text());
  }

  if (fichier_type !== "pdf") {
    return callClaude(fileData, "image", anthropicKey);
  }

  try {
    const buffer = await fileData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(buffer);
    const totalPages = pdfDoc.getPageCount();

    if (totalPages <= MAX_PDF_PAGES) {
      return callClaude(fileData, "pdf", anthropicKey);
    }

    const all: ProduitExtrait[] = [];
    for (let start = 0; start < totalPages; start += MAX_PDF_PAGES) {
      const end = Math.min(start + MAX_PDF_PAGES, totalPages);
      const chunk = await PDFDocument.create();
      const pages = await chunk.copyPages(pdfDoc, Array.from({ length: end - start }, (_, i) => start + i));
      pages.forEach(p => chunk.addPage(p));
      const blob = new Blob([await chunk.save()], { type: "application/pdf" });
      all.push(...await callClaude(blob, "pdf", anthropicKey));
      if (start + MAX_PDF_PAGES < totalPages) await new Promise(r => setTimeout(r, 3000));
    }
    return deduplicate(all);
  } catch {
    return callClaude(fileData, "pdf", anthropicKey);
  }
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(bin);
}

async function callClaude(fileData: Blob, type: "pdf" | "image", anthropicKey: string): Promise<ProduitExtrait[]> {
  const base64 = toBase64(await fileData.arrayBuffer());
  const contentItem = type === "pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } };

  const prompt = `Extrais tous les produits de ce catalogue fournisseur.
Pour chaque produit : référence article, désignation, unité de vente, prix HT en euros.
Réponds UNIQUEMENT en JSON compact sur une seule ligne, sans aucun texte avant ou après :
{"p":[{"r":"ref_ou_null","d":"designation","u":"unite","pa":0.00}]}
Règles : r=null si absent, u="u" si absente, pa=0 si absent.`;

  const headers: Record<string, string> = {
    "x-api-key": anthropicKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
  if (type === "pdf") headers["anthropic-beta"] = "pdfs-2024-09-25";

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      messages: [{ role: "user", content: [contentItem, { type: "text", text: prompt }] }],
    }),
  });

  if (!resp.ok) throw new Error(`Claude API: ${await resp.text()}`);
  const data = await resp.json();
  return parseAI((data.content?.[0]?.text ?? "").trim());
}

function parseAI(text: string): ProduitExtrait[] {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      const items: unknown[] = Array.isArray(parsed.p) ? parsed.p : [];
      if (items.length > 0) return items.map(normalize).filter(p => p.designation);
    } catch { /* fall through */ }
  }
  const result: ProduitExtrait[] = [];
  for (const m of text.matchAll(/\{[^{}]+\}/g)) {
    try { const p = normalize(JSON.parse(m[0])); if (p.designation) result.push(p); } catch { /* skip */ }
  }
  return result;
}

function normalize(o: unknown): ProduitExtrait {
  const obj = o as Record<string, unknown>;
  const raw = obj.pa ?? obj.prix_achat ?? 0;
  return {
    reference: ((obj.r ?? obj.reference ?? null) as string | null) || null,
    designation: ((obj.d ?? obj.designation ?? "") as string).trim(),
    unite: ((obj.u ?? obj.unite ?? "u") as string).trim() || "u",
    prix_achat: Math.max(0, typeof raw === "number" ? raw : parseFloat(String(raw)) || 0),
  };
}

function deduplicate(list: ProduitExtrait[]): ProduitExtrait[] {
  const seen = new Set<string>();
  return list.filter(p => {
    const k = `${p.reference ?? ""}|${p.designation.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function parseCSV(text: string): ProduitExtrait[] {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, ""));
  const col = (...names: string[]) => names.map(n => headers.findIndex(h => h.includes(n))).find(i => i !== -1) ?? -1;
  const refCol = col("ref", "code", "article"); const desCol = col("désignation", "designation", "libellé", "nom");
  const uCol = col("unité", "unite"); const pCol = col("prix", "pa", "tarif");
  if (desCol === -1) return [];
  return lines.slice(1).map(l => {
    const c = l.split(sep).map(x => x.trim().replace(/"/g, ""));
    if (!c[desCol]) return null;
    return {
      reference: refCol !== -1 ? (c[refCol] || null) : null,
      designation: c[desCol],
      unite: uCol !== -1 ? (c[uCol] || "u") : "u",
      prix_achat: pCol !== -1 ? parseFloat((c[pCol] ?? "0").replace(",", ".")) || 0 : 0,
    };
  }).filter(Boolean) as ProduitExtrait[];
}
