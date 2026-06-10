import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RelanceItem {
  type: "devis" | "facture" | "acompte";
  id: string;
  numero: string;
  client_name: string;
  client_email: string;
  montant: number;
  date: string;
  artisan_name: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { items }: { items: RelanceItem[] } = await req.json();
  if (!items || items.length === 0) {
    return new Response(JSON.stringify({ error: "Aucun item fourni" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const draft_ids: string[] = [];

  for (const item of items) {
    const typeLabel =
      item.type === "devis" ? "devis" : item.type === "facture" ? "facture" : "acompte";
    const dateFormatted = item.date
      ? new Date(item.date).toLocaleDateString("fr-FR")
      : "";
    const dateContext =
      item.type === "devis"
        ? `Le devis expire le ${dateFormatted}.`
        : `L'échéance était le ${dateFormatted}.`;
    const montantStr = item.montant.toLocaleString("fr-FR", { minimumFractionDigits: 2 });

    const prompt = `Tu es Alfred, assistant IA pour artisans BTP. Rédige un email de relance professionnel et courtois en français.

Informations :
- Artisan : ${item.artisan_name}
- Client : ${item.client_name}
- Type de document : ${typeLabel}${item.numero ? ` n°${item.numero}` : ""}
- Montant : ${montantStr} € HT
- ${dateContext}

Génère un JSON valide avec exactement ces deux champs :
{"subject":"...","body":"..."}

Règles impératives :
- subject : court, professionnel (ex: "Relance – Devis n°DEV-001")
- body : entre 80 et 150 mots, commence par "Bonjour ${item.client_name},", se termine par une formule de politesse signée "${item.artisan_name}"
- Pas de balises HTML
- Utilise les vraies valeurs, pas de placeholders comme [nom]
- Réponds uniquement avec le JSON, rien d'autre`;

    let subject = `Relance – ${typeLabel}${item.numero ? ` n°${item.numero}` : ""}`;
    let body =
      `Bonjour ${item.client_name},\n\nNous vous contactons concernant votre ${typeLabel}${item.numero ? ` n°${item.numero}` : ""} d'un montant de ${montantStr} € HT. ${dateContext}\n\nNous restons disponibles pour tout renseignement.\n\nCordialement,\n${item.artisan_name}`;

    try {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (anthropicRes.ok) {
        const data = await anthropicRes.json();
        const text = (data.content?.[0]?.text ?? "").trim();
        try {
          const parsed = JSON.parse(text);
          if (parsed.subject) subject = parsed.subject;
          if (parsed.body) body = parsed.body;
        } catch {
          console.warn("[generate-relance] JSON parse failed for item", item.id, "using fallback");
        }
      } else {
        console.error("[generate-relance] Anthropic error:", anthropicRes.status);
      }
    } catch (e) {
      console.error("[generate-relance] Anthropic call failed:", e);
    }

    const { data: inserted, error: insertErr } = await serviceClient
      .from("messages")
      .insert({
        artisan_id: user.id,
        to_email: item.client_email,
        to_name: item.client_name,
        subject,
        body,
        status: "draft",
        document_type: item.type,
        document_id: item.id,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[generate-relance] Insert error:", insertErr.message);
    } else if (inserted?.id) {
      draft_ids.push(inserted.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, draft_ids }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
