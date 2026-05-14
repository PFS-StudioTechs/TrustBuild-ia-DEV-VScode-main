export interface IntentResult {
  persona: "jarvis" | "robert_b" | "auguste_p";
  intent:
    | "DEVIS_CREATE"
    | "DEVIS_UPDATE"
    | "QUOTE_SUGGEST"
    | "QUERY_EXPERT"
    | "GENERAL";
  entities: {
    client?: string;
    prestation?: string;
    surface?: number;
    materiau?: string;
    montant?: number;
    domaine?: "juridique" | "technique";
  };
  confidence: number;
}

const FALLBACK: IntentResult = {
  persona: "jarvis",
  intent: "GENERAL",
  entities: {},
  confidence: 0,
};

const ROUTER_SYSTEM_PROMPT = `Tu es un classificateur pour une application BTP française.
Retourne UNIQUEMENT ce JSON (sans markdown, sans texte autour) :
{"persona":"...","intent":"...","entities":{...},"confidence":0.95}

DÉCISION — applique dans cet ordre :

1. persona = "robert_b" si le message parle de :
   litige, dispute, conflit avec client, client ne veut pas payer, impayé, refus de paiement,
   garantie décennale, garantie biennale, garantie parfait achèvement,
   contrat de sous-traitance, sous-traitant (aspect légal), travail au noir,
   mise en demeure, résiliation, abandon de chantier, procès, tribunal, avocat,
   assurance RC pro, responsabilité civile, réserves de réception, pénalité de retard,
   retenue de garantie, CCAP, marché public.

2. persona = "auguste_p" si le message parle de :
   normes, réglementation, DTU, NF C, NF P, RE2020, RT2020,
   comment poser / installer / dimensionner / mettre en œuvre,
   quelle épaisseur, quelle section de câble, conformité technique,
   isolation, isolant, laine de verre, laine de roche, polystyrène,
   spots encastrés, circuit électrique, disjoncteur, tableau électrique,
   étanchéité, pare-vapeur, condensation, pont thermique,
   béton, armature, dalle, poutre, fondation, structure, charge,
   fissure, humidité, moisissure, pathologie bâtiment,
   enduit, chape, carrelage, tuile, ardoise, VMC, ventilation.

3. persona = "jarvis" pour tout le reste :
   créer ou modifier un devis / facture, tarif, prix, planning, client (gestion), général.

RÈGLES ABSOLUES :
- "litige" ou "ne veut pas payer" → TOUJOURS robert_b, même si "client" ou "devis" apparaît
- "quelles normes pour X" → TOUJOURS auguste_p, même sans "DTU" ni "NF"
- "décennale" dans un contexte de devis → jarvis (assurance citée en passant)
- "devis + DTU" → jarvis si l'intent principal est de chiffrer

INTENT :
- "DEVIS_CREATE" : créer un nouveau devis
- "DEVIS_UPDATE" : modifier un devis existant
- "QUOTE_SUGGEST" : situation décrite, chiffrage attendu
- "QUERY_EXPERT" : question juridique ou technique sans devis
- "GENERAL" : bonjour, autre

ENTITÉS (extraire seulement si présentes dans le message) :
client (nom), prestation (type de travaux), surface (nombre en m²), materiau, montant (€)

FORMAT EXACT : {"persona":"jarvis","intent":"GENERAL","entities":{},"confidence":0.95}`;

export async function routeIntent(message: string): Promise<IntentResult> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return FALLBACK;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        temperature: 0,
        system: ROUTER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: message }],
      }),
    });

    if (!resp.ok) {
      console.error("routeIntent API error:", resp.status, await resp.text());
      return FALLBACK;
    }

    const data = await resp.json();
    const text: string = data.content?.[0]?.text ?? "";

    try {
      const result = JSON.parse(text.trim()) as IntentResult;
      console.log(`routeIntent → persona=${result.persona} intent=${result.intent} conf=${result.confidence}`);
      return result;
    } catch {
      console.error("routeIntent JSON.parse failed:", text);
      return FALLBACK;
    }
  } catch (e) {
    console.error("routeIntent error:", e);
    return FALLBACK;
  }
}
