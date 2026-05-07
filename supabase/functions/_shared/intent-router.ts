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

const ROUTER_SYSTEM_PROMPT = `Tu es le routeur intelligent d'une application BTP pour artisans français.
Analyse le message et retourne UNIQUEMENT un JSON valide, sans markdown, sans explication.

RÈGLES PERSONA :
- "robert_b" : contrat, garantie décennale, assurance, litige, clause,
  responsabilité civile, sous-traitant, pénalité, CCAP, marché public,
  résiliation, mise en demeure, dommage, procès, avocat
- "auguste_p" : DTU, norme NF, RT2020, RE2020, béton, structure,
  fondation, étanchéité, isolation thermique, calcul de charge,
  résistance matériau, pathologie bâtiment, humidité, fissure, sinistre
- "jarvis" : devis, facture, client, planning, tarif, prix, m²,
  fourniture, main d'œuvre, tout le reste

RÈGLES INTENT :
- "DEVIS_CREATE" : l'utilisateur dicte ou décrit un devis à créer
- "DEVIS_UPDATE" : l'utilisateur modifie un devis existant
- "QUOTE_SUGGEST" : l'utilisateur décrit une situation, l'agent doit
  proposer un devis adapté
- "QUERY_EXPERT" : question technique ou juridique sans création de devis
- "GENERAL" : conversation, bonjour, autre

EXTRACTION ENTITÉS : extraire si présents dans le message :
client (nom), prestation (type de travaux), surface (nombre en m²),
materiau (matériau principal), montant (nombre en euros)

FORMAT : {"persona":"...","intent":"...","entities":{...},"confidence":0.95}`;

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
        max_tokens: 150,
        temperature: 0,
        system: ROUTER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: message }],
      }),
    });

    if (!resp.ok) return FALLBACK;

    const data = await resp.json();
    const text: string = data.content?.[0]?.text ?? "";

    try {
      return JSON.parse(text.trim()) as IntentResult;
    } catch {
      return FALLBACK;
    }
  } catch {
    return FALLBACK;
  }
}
