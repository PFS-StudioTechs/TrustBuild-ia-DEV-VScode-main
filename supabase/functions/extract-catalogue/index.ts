import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ProduitExtrait = {
  reference: string | null;
  designation: string;
  unite: string;
  prix_achat: number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const artisanId = user.id;

    const body = await req.json();
    const { import_id, storage_path, fichier_type } = body as {
      import_id: string;
      storage_path: string;
      fichier_type: "csv" | "image" | "pdf";
    };

    if (!import_id || !storage_path || !fichier_type) {
      return new Response(
        JSON.stringify({ error: "import_id, storage_path et fichier_type sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: importRecord, error: importError } = await supabase
      .from("catalogue_imports")
      .select("fournisseur_id, artisan_id")
      .eq("id", import_id)
      .single();

    if (importError || !importRecord || importRecord.artisan_id !== artisanId) {
      return new Response(JSON.stringify({ error: "Import introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fournisseurId = importRecord.fournisseur_id;

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("artisan-documents")
      .download(storage_path);

    if (downloadError || !fileData) {
      throw new Error("Impossible de télécharger le fichier depuis le stockage");
    }

    let produits: ProduitExtrait[] = [];

    if (fichier_type === "csv") {
      const text = await fileData.text();
      produits = parseCSV(text);
    } else {
      produits = await extractFromAI(fileData, fichier_type, anthropicKey);
    }

    if (produits.length === 0) {
      await supabase
        .from("catalogue_imports")
        .update({ statut: "termine", nb_produits_extraits: 0 })
        .eq("id", import_id);

      return new Response(
        JSON.stringify({ nb_produits: 0, message: "Aucun produit extrait" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: manuels } = await supabase
      .from("produits")
      .select("id, reference, prix_achat")
      .eq("artisan_id", artisanId)
      .eq("fournisseur_id", fournisseurId)
      .eq("statut_import", "manuel")
      .eq("actif", true);

    const manuelsByRef = new Map((manuels ?? []).map((m: any) => [m.reference?.trim().toLowerCase(), m]));

    const toInsert: any[] = [];
    for (const p of produits) {
      const refKey = p.reference?.trim().toLowerCase() ?? null;
      const existing = refKey ? manuelsByRef.get(refKey) : null;
      if (existing) {
        await supabase.from("produits").update({
          import_id,
          designation: p.designation,
          unite: p.unite,
          statut_import: fichier_type === "csv" ? "valide" : "ia",
          prix_negocie: true,
        }).eq("id", existing.id);
      } else {
        toInsert.push({
          artisan_id: artisanId,
          fournisseur_id: fournisseurId,
          import_id,
          reference: p.reference,
          designation: p.designation,
          unite: p.unite,
          prix_achat: p.prix_achat,
          prix_negocie: false,
          statut_import: fichier_type === "csv" ? "valide" : "ia",
        });
      }
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from("produits").insert(toInsert);
      if (insertError) throw new Error(`Erreur insertion produits: ${insertError.message}`);
    }

    await supabase
      .from("catalogue_imports")
      .update({ statut: "termine", nb_produits_extraits: produits.length })
      .eq("id", import_id);

    const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
    if (sendgridKey) {
      const [{ data: fournisseur }, { data: profile }] = await Promise.all([
        supabase.from("fournisseurs").select("nom").eq("id", fournisseurId).single(),
        supabase.from("profiles").select("prenom, nom").eq("user_id", artisanId).single(),
      ]);
      const artisanNom = profile ? `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() : artisanId;
      const fournisseurNom = fournisseur?.nom ?? fournisseurId;
      await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { "Authorization": `Bearer ${sendgridKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: "contact@pfs-studio-techs.fr" }] }],
          from: { email: Deno.env.get("SENDGRID_FROM_EMAIL") ?? "noreply@trustbuild.ia", name: "TrustBuild-IA" },
          subject: `[Cataverif] Nouveau catalogue à vérifier — ${fournisseurNom}`,
          content: [{
            type: "text/plain",
            value: `Un nouveau catalogue vient d'être importé et attend vérification.\n\nFournisseur : ${fournisseurNom}\nArticles extraits : ${produits.length}\nArtisan : ${artisanNom}\n\nConnectez-vous à Cataverif pour vérifier l'import.`,
          }],
        }),
      });
    }

    return new Response(
      JSON.stringify({ nb_produits: produits.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-catalogue error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

const MAX_PDF_PAGES = 90; // marge de sécurité sous la limite API de 100

async function extractFromAI(
  fileData: Blob,
  fichier_type: "image" | "pdf",
  anthropicKey: string
): Promise<ProduitExtrait[]> {
  if (fichier_type !== "pdf") {
    return callClaudeAPIWithRetry(fileData, "image", anthropicKey);
  }

  try {
    const buffer = await fileData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(buffer);
    const totalPages = pdfDoc.getPageCount();

    if (totalPages <= MAX_PDF_PAGES) {
      return callClaudeAPIWithRetry(fileData, "pdf", anthropicKey);
    }

    const allProduits: ProduitExtrait[] = [];
    for (let start = 0; start < totalPages; start += MAX_PDF_PAGES) {
      const end = Math.min(start + MAX_PDF_PAGES, totalPages);
      const chunkDoc = await PDFDocument.create();
      const indices = Array.from({ length: end - start }, (_, i) => start + i);
      const pages = await chunkDoc.copyPages(pdfDoc, indices);
      pages.forEach((p) => chunkDoc.addPage(p));
      const chunkBytes = await chunkDoc.save();
      const chunkBlob = new Blob([chunkBytes], { type: "application/pdf" });
      const chunkProduits = await callClaudeAPIWithRetry(chunkBlob, "pdf", anthropicKey);
      allProduits.push(...chunkProduits);
      if (start + MAX_PDF_PAGES < totalPages) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    return deduplicateProduits(allProduits);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Erreur API IA") || msg.includes("rate_limit") || msg.includes("tentatives")) throw e;
    console.warn("pdf-lib échec, tentative directe:", msg);
    return callClaudeAPIWithRetry(fileData, "pdf", anthropicKey);
  }
}

async function callClaudeAPIWithRetry(
  fileData: Blob,
  fichier_type: "image" | "pdf",
  anthropicKey: string,
  maxRetries = 4
): Promise<ProduitExtrait[]> {
  let delay = 8000; // 8s initial — laisse le compteur tokens/min se vider
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callClaudeAPI(fileData, fichier_type, anthropicKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isRateLimit = msg.includes("rate_limit_error") || msg.includes("rate limit");
      if (!isRateLimit || attempt === maxRetries) throw e;
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 60000); // backoff exponentiel, max 60s
    }
  }
  throw new Error("Impossible d'appeler l'API après plusieurs tentatives");
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function callClaudeAPI(
  fileData: Blob,
  fichier_type: "image" | "pdf",
  anthropicKey: string
): Promise<ProduitExtrait[]> {
  const buffer = await fileData.arrayBuffer();
  const base64 = toBase64(buffer);

  const contentItem = fichier_type === "pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } };

  // Compact format: r=référence, d=désignation, u=unité, pa=prix_achat
  // Short field names reduce output tokens ~50% vs verbose names
  const prompt = `Extrais tous les produits de ce catalogue fournisseur.
Pour chaque produit : référence article, désignation, unité de vente, prix HT en euros.
Réponds UNIQUEMENT en JSON compact sur une seule ligne, sans aucun texte avant ou après :
{"p":[{"r":"ref_ou_null","d":"designation","u":"unite","pa":0.00}]}
Règles : r=null si absent, u="u" si absente, pa=0 si absent.`;

  const reqHeaders: Record<string, string> = {
    "x-api-key": anthropicKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
  if (fichier_type === "pdf") {
    reqHeaders["anthropic-beta"] = "pdfs-2024-09-25";
  }

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: reqHeaders,
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      messages: [{ role: "user", content: [contentItem, { type: "text", text: prompt }] }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Erreur API IA: ${errText}`);
  }

  const data = await resp.json();
  const responseText = (data.content?.[0]?.text ?? "").trim();
  return parseAIResponse(responseText);
}

function deduplicateProduits(produits: ProduitExtrait[]): ProduitExtrait[] {
  const seen = new Set<string>();
  return produits.filter((p) => {
    const key = `${p.reference ?? ""}|${p.designation.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseAIResponse(responseText: string): ProduitExtrait[] {
  // Try full JSON parse first
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const items: unknown[] = Array.isArray(parsed.p) ? parsed.p
        : Array.isArray(parsed.produits) ? parsed.produits : [];
      if (items.length > 0) {
        return items.map(normalizeProduct).filter((p) => p.designation);
      }
    } catch {}
  }

  // Fallback: extract individual complete objects from truncated JSON
  const produits: ProduitExtrait[] = [];
  for (const m of responseText.matchAll(/\{[^{}]+\}/g)) {
    try {
      const p = normalizeProduct(JSON.parse(m[0]));
      if (p.designation) produits.push(p);
    } catch {}
  }
  return produits;
}

function normalizeProduct(obj: unknown): ProduitExtrait {
  const o = obj as Record<string, unknown>;
  const raw = o.pa ?? o.prix_achat ?? 0;
  const prix_achat = typeof raw === "number" ? raw : parseFloat(String(raw)) || 0;
  return {
    reference: ((o.r ?? o.reference ?? null) as string | null) || null,
    designation: ((o.d ?? o.designation ?? "") as string).trim(),
    unite: ((o.u ?? o.unite ?? "u") as string).trim() || "u",
    prix_achat: prix_achat >= 0 ? prix_achat : 0,
  };
}

function parseCSV(text: string): ProduitExtrait[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/"/g, ""));

  const colIndex = (...names: string[]) => {
    for (const name of names) {
      const idx = headers.findIndex((h) => h.includes(name));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const refCol    = colIndex("ref", "code", "article", "référence", "reference");
  const designCol = colIndex("désignation", "designation", "libellé", "libelle", "description", "nom");
  const uniteCol  = colIndex("unité", "unite", "conditionnement");
  const prixCol   = colIndex("prix", "tarif", "pa", "prix_achat", "montant");

  if (designCol === -1) return [];

  const result: ProduitExtrait[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim().replace(/"/g, ""));
    const designation = cols[designCol] ?? "";
    if (!designation) continue;
    const prixRaw = prixCol !== -1 ? (cols[prixCol] ?? "0") : "0";
    result.push({
      reference: refCol !== -1 ? (cols[refCol] || null) : null,
      designation,
      unite: uniteCol !== -1 ? (cols[uniteCol] || "u") : "u",
      prix_achat: parseFloat(prixRaw.replace(",", ".")) || 0,
    });
  }
  return result;
}
