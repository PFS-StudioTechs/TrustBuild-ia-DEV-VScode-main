import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storage_path, mime_type } = await req.json();

    if (!storage_path) {
      return new Response(
        JSON.stringify({ error: "storage_path est requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Télécharge le fichier depuis le storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("artisan-documents")
      .download(storage_path);

    if (downloadError || !fileData) {
      throw new Error("Impossible de télécharger le fichier depuis le stockage");
    }

    // Conversion en base64
    const buffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    const effectiveMime = mime_type || "application/pdf";
    const isImage = effectiveMime.startsWith("image/");
    const isPdf = effectiveMime.includes("pdf");

    if (!isImage && !isPdf) {
      return new Response(
        JSON.stringify({
          is_kbis: false,
          siret_found: null,
          reason: "Type de fichier non supporté (PDF, JPG ou PNG requis)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const verifyPrompt = `Analyse ce document. Est-ce un extrait Kbis officiel français délivré par le Registre du Commerce et des Sociétés (RCS) ?
Réponds UNIQUEMENT avec du JSON valide sur une seule ligne, sans texte avant ou après :
{"is_kbis": boolean, "siret_found": string_or_null, "reason": string}
- is_kbis: true si c'est un extrait Kbis (doit mentionner RCS, extrait du registre du commerce, ou KBIS)
- siret_found: numéro SIRET à 14 chiffres trouvé dans le document, null sinon
- reason: explication courte en français (max 100 caractères)`;

    const userContent = isImage
      ? [
          { type: "image", source: { type: "base64", media_type: effectiveMime, data: base64 } },
          { type: "text", text: verifyPrompt },
        ]
      : [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: verifyPrompt },
        ];

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      console.error("Anthropic error:", anthropicResp.status, errText);
      throw new Error("Erreur lors de l'analyse IA");
    }

    const anthropicData = await anthropicResp.json();
    const responseText = (anthropicData.content?.[0]?.text ?? "").trim();

    // Extrait le JSON de la réponse
    const jsonMatch = responseText.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      throw new Error("Réponse IA non parseable");
    }

    const result = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-kbis error:", e);
    return new Response(
      JSON.stringify({
        is_kbis: false,
        siret_found: null,
        reason: e instanceof Error ? e.message : "Erreur inconnue",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
