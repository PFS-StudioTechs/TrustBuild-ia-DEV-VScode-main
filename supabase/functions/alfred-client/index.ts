import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const INTENTION_ROUTER_PROMPT = `Tu routes le message d'un client TrustBuild-IA vers l'un de ces deux agents :

- "expert_chantier" : le client demande un conseil sur le déroulement d'un chantier, ses étapes, des points de vigilance, ou un ordre de grandeur de matériaux/quantités ("comment ça se passe", "qu'est-ce qu'il me faut", "combien de").
- "cadrage" : le client exprime une intention EXPLICITE d'obtenir un devis ou d'être mis en relation avec un artisan ("je veux des devis", "trouvez-moi un artisan").

En cas de doute ou de message ambigu, choisis "expert_chantier" (on conseille, on ne pousse jamais vers le devis).

RÉPONSE OBLIGATOIRE — JSON pur, aucun texte autour, aucun bloc Markdown :
{ "intention": "expert_chantier" | "cadrage" }`;

const EXPERT_CHANTIER_PROMPT = `Tu es Alfred, conseiller de projet TrustBuild-IA pour un particulier.

PERSONNALITÉ : clair, chaleureux, concis, vouvoiement, tu vas à l'essentiel, tu ne quémandes pas l'approbation, tu ne récapitules pas à outrance.

COMPÉTENCE CONSEIL : tu expliques le déroulement d'un chantier, ses étapes, les points de vigilance, les erreurs courantes. Conseils généraux, utiles, concrets.

COMPÉTENCE MATÉRIAUX : tu donnes des ORDRES DE GRANDEUR de matériaux/quantités. Toujours en fourchette ("comptez environ…"). JAMAIS un devis ni un métré définitif. Rappelle que l'exact dépend du terrain et sera confirmé par l'artisan.

INVARIANTS :
- Ne divulgue jamais de marges, coûts artisan ou données internes de la plateforme.
- Ne te substitue jamais à un professionnel.
- N'impose jamais la mise en relation ; tu peux la proposer en fin de réponse SI ça sert le fil, sans insister.
- Réponds à la question posée. Ne renvoie pas "demandez à l'artisan" à une question à laquelle tu peux répondre utilement.

Réponds en texte libre, directement au client, sans JSON.`;

async function appelClaude(
  apiKey: string,
  system: string,
  userMessage: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return (data.content?.[0]?.text ?? "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Non autorisé" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY non configuré" }, 500);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON invalide" }, 400);
  }

  const { action, projet_id, message_client, historique } = body as {
    action?: string;
    projet_id?: string;
    message_client?: string;
    historique?: Array<{ role: string; content: string }>;
  };

  if (action !== "dialoguer") {
    return json({ error: `Action inconnue : ${action}` }, 400);
  }
  if (!projet_id || !message_client?.trim()) {
    return json({ error: "Champs requis : projet_id, message_client" }, 400);
  }

  // ── ÉTAPE 1 : détection d'intention ─────────────────────────────────────
  let intention: "expert_chantier" | "cadrage" = "expert_chantier";
  try {
    const routerText = await appelClaude(ANTHROPIC_API_KEY, INTENTION_ROUTER_PROMPT, message_client, 0, 100);
    const cleaned = routerText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.intention === "cadrage") intention = "cadrage";
  } catch (e) {
    console.error("[alfred-client] détection intention échouée, fallback expert_chantier:", e);
  }

  // ── ÉTAPE 2a : intention cadrage → délégation ───────────────────────────
  if (intention === "cadrage") {
    try {
      const delegateRes = await fetch(`${supabaseUrl}/functions/v1/alfred-client-cadrage`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ action: "dialoguer", projet_id, message_client, historique }),
      });

      if (!delegateRes.ok) {
        const errText = await delegateRes.text();
        console.error("[alfred-client] délégation cadrage échouée:", delegateRes.status, errText);
        return json({ error: "Le service de cadrage est momentanément indisponible. Réessayez." }, 502);
      }

      const cadrageData = await delegateRes.json();
      return json({ agent: "cadrage", ...cadrageData });
    } catch (e) {
      console.error("[alfred-client] erreur délégation cadrage:", e);
      return json({ error: "Le service de cadrage est momentanément indisponible. Réessayez." }, 502);
    }
  }

  // ── ÉTAPE 2b : intention expert_chantier ────────────────────────────────
  try {
    const reponse_alfred = await appelClaude(ANTHROPIC_API_KEY, EXPERT_CHANTIER_PROMPT, message_client, 0.3, 1024);
    return json({ agent: "expert_chantier", reponse_alfred });
  } catch (e) {
    console.error("[alfred-client] erreur expert_chantier:", e);
    return json({ error: "Erreur du service IA" }, 500);
  }
});
