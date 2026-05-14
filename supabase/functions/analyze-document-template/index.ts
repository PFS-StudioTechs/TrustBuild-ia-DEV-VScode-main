import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANALYZE_PROMPT = `Tu es un expert en design de documents professionnels.
Analyse ce document (devis ou facture d'artisan) et extrais les informations suivantes au format JSON strict.
Ne réponds RIEN d'autre que le JSON.

{
  "secteur": "plomberie|electricite|architecture|peinture|menuiserie|general",
  "couleur_primaire": "#xxxxxx (couleur dominante de l'en-tête ou du bandeau)",
  "couleur_secondaire": "#xxxxxx (couleur secondaire ou de fond)",
  "couleur_accent": "#xxxxxx (couleur d'accentuation, boutons, totaux)",
  "coordonnees": {
    "nom_entreprise": "...",
    "siret": "...",
    "adresse": "...",
    "telephone": "...",
    "email": "..."
  },
  "mentions_legales": ["mention 1", "mention 2"],
  "structure": {
    "a_logo": true/false,
    "position_logo": "gauche|centre|droite",
    "a_signature": true/false,
    "colonnes_tableau": ["description", "quantite", "prix_unitaire", "total"]
  },
  "observations": "Résumé court du style et de la structure du document"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    // Auth
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: cors });

    const db = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { file_base64, file_type, nom, secteur_hint } = body;

    if (!file_base64) {
      return new Response(JSON.stringify({ error: "file_base64 requis" }), { status: 400, headers: cors });
    }

    // ── Call Claude with PDF/image document ──────────────────────────────
    const mediaType = file_type ?? "application/pdf";
    const isImage = mediaType.startsWith("image/");

    const contentBlock = isImage
      ? { type: "image", source: { type: "base64", media_type: mediaType, data: file_base64 } }
      : { type: "document", source: { type: "base64", media_type: "application/pdf", data: file_base64 } };

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              contentBlock,
              { type: "text", text: ANALYZE_PROMPT },
            ],
          },
        ],
      }),
    });

    if (!anthropicResp.ok) {
      const err = await anthropicResp.text();
      throw new Error(`Claude API error: ${err}`);
    }

    const claudeData = await anthropicResp.json();
    const rawText = claudeData.content?.[0]?.text ?? "{}";

    // Extract JSON from response (Claude sometimes wraps in ```)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    const secteur = parsed.secteur ?? secteur_hint ?? "general";

    // ── Save template to DB ───────────────────────────────────────────────
    // Deactivate previous templates
    await db.from("document_templates")
      .update({ is_active: false })
      .eq("artisan_id", user.id);

    const { data: newTemplate, error: tplErr } = await db.from("document_templates").insert({
      artisan_id:          user.id,
      secteur,
      nom:                 nom ?? `Template analysé — ${new Date().toLocaleDateString("fr-FR")}`,
      couleur_primaire:    parsed.couleur_primaire ?? "#2563eb",
      couleur_secondaire:  parsed.couleur_secondaire ?? "#1e40af",
      couleur_accent:      parsed.couleur_accent ?? "#f59e0b",
      metadata: {
        coordonnees:   parsed.coordonnees ?? {},
        structure:     parsed.structure ?? {},
        observations:  parsed.observations ?? "",
        analyzed_at:   new Date().toISOString(),
      },
      is_active: true,
    }).select().single();

    if (tplErr) throw new Error(`Template insert: ${tplErr.message}`);

    // ── Save mentions légales ─────────────────────────────────────────────
    const mentions: string[] = parsed.mentions_legales ?? [];
    if (mentions.length > 0 && newTemplate?.id) {
      await db.from("template_elements").insert(
        mentions.map(m => ({ template_id: newTemplate.id, type: "mention", valeur: m }))
      );
    }

    return new Response(JSON.stringify({
      success: true,
      template_id: newTemplate?.id,
      secteur,
      couleur_primaire:   parsed.couleur_primaire,
      couleur_secondaire: parsed.couleur_secondaire,
      observations:       parsed.observations,
      coordonnees:        parsed.coordonnees,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-document-template error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: cors }
    );
  }
});
