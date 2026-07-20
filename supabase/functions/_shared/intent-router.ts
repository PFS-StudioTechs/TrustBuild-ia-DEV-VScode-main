export interface IntentResult {
  persona: "alfred" | "simone" | "gustave";
  intent:
    | "DEVIS_CREATE"
    | "DEVIS_UPDATE"
    | "QUOTE_SUGGEST"
    | "QUERY_EXPERT"
    | "GUIDE_APP"
    | "SEARCH_HISTORY"
    | "GENERAL";
  entities: {
    client?: string;
    prestation?: string;
    surface?: number;
    materiau?: string;
    montant?: number;
    domaine?: "juridique" | "technique";
    recherche?: string;
  };
  confidence: number;
}

const FALLBACK: IntentResult = {
  persona: "alfred",
  intent: "GENERAL",
  entities: {},
  confidence: 0,
};

const ROUTER_SYSTEM_PROMPT = `Tu es un classificateur pour une application BTP française.
Retourne UNIQUEMENT ce JSON (sans markdown, sans texte autour) :
{"persona":"...","intent":"...","entities":{...},"confidence":0.95}

DÉCISION — applique dans cet ordre :

1. persona = "simone" si le message parle de :
   litige, dispute, conflit avec client, client ne veut pas payer, impayé, refus de paiement,
   garantie décennale, garantie biennale, garantie parfait achèvement,
   contrat de sous-traitance, sous-traitant (aspect légal), travail au noir,
   mise en demeure, résiliation, abandon de chantier, procès, tribunal, avocat,
   assurance RC pro, responsabilité civile, réserves de réception, pénalité de retard,
   retenue de garantie, CCAP, marché public.

2. persona = "gustave" si le message parle de :
   normes, réglementation, DTU, NF C, NF P, RE2020, RT2020,
   comment poser / installer / dimensionner / mettre en œuvre,
   quelle épaisseur, quelle section de câble, conformité technique,
   isolation, isolant, laine de verre, laine de roche, polystyrène,
   spots encastrés, circuit électrique, disjoncteur, tableau électrique,
   étanchéité, pare-vapeur, condensation, pont thermique,
   béton, armature, dalle, poutre, fondation, structure, charge,
   fissure, humidité, moisissure, pathologie bâtiment,
   enduit, chape, carrelage, tuile, ardoise, VMC, ventilation.

3. persona = "alfred", intent = "GUIDE_APP" si le message porte sur la prise en main de l'application elle-même : comment configurer/personnaliser/trouver/paramétrer un écran, un champ, une fonctionnalité de l'app (profil, logo, SIRET, documents légaux, navigation), PAS sur le contenu métier d'un devis/chantier/client en cours.

4. persona = "alfred", intent = "SEARCH_HISTORY" si le message porte sur la RECHERCHE d'une information déjà saisie dans un devis passé de CET artisan : "retrouve", "je cherche", "j'avais mis", "dans un devis précédent/passé/il y a", "quel était le prix de", "c'était combien déjà". Extrais le terme cherché (référence ou nom du produit/prestation) dans entities.recherche quand il est identifiable.
   Distinction vs DEVIS_UPDATE : SEARCH_HISTORY est une question de lecture, sans devis_id/document actif visé pour modification — "change/modifie/ajoute sur ce devis" reste DEVIS_UPDATE.
   Distinction vs QUERY_EXPERT : même si le terme cherché est technique (épaisseur, DTU, matériau...), une recherche dans SES PROPRES devis passés reste SEARCH_HISTORY et persona alfred, jamais gustave/simone.

5. persona = "alfred" pour tout le reste :
   créer ou modifier un devis / facture, tarif, prix, planning, client (gestion), général.

RÈGLES ABSOLUES :
- "litige" ou "ne veut pas payer" → TOUJOURS simone, même si "client" ou "devis" apparaît
- "quelles normes pour X" → TOUJOURS gustave, même sans "DTU" ni "NF"
- "décennale" dans un contexte de devis → alfred (assurance citée en passant)
- "devis + DTU" → alfred si l'intent principal est de chiffrer
- Si le message commence par "[Persona du tour précédent : X]" : reste sur X seulement si aucun mot-clé des règles 1/2/4 n'apparaît dans le message actuel. Dès qu'un mot-clé de règle 1, 2 ou 4 apparaît, applique cette règle même si le message référence le tour précédent par un pronom ou une expression comme "à ce sujet", "sur ce point", "pour ça".
- "comment créer un devis" (demande d'action, chiffrage à faire maintenant) → DEVIS_CREATE. "où est le bouton pour créer un devis" / "comment fonctionne l'écran devis" (mode d'emploi de l'app, aucune action de chiffrage attendue) → GUIDE_APP. Le persona reste "alfred" dans les deux cas.

INTENT :
- "DEVIS_CREATE" : créer un nouveau devis
- "DEVIS_UPDATE" : modifier un devis existant
- "QUOTE_SUGGEST" : situation décrite, chiffrage attendu
- "QUERY_EXPERT" : question juridique ou technique sans devis
- "GUIDE_APP" : question sur le fonctionnement/la prise en main de l'application (pas une action métier)
- "SEARCH_HISTORY" : recherche d'une info déjà saisie dans un devis passé de l'artisan (lecture, pas d'édition)
- "GENERAL" : bonjour, autre

ENTITÉS (extraire seulement si présentes dans le message) :
client (nom), prestation (type de travaux), surface (nombre en m²), materiau, montant (€), recherche (terme cherché dans l'historique des devis)

FORMAT EXACT : {"persona":"alfred","intent":"GENERAL","entities":{},"confidence":0.95}`;

export function stripJsonFence(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "");
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.replace(/```\s*$/, "");
  }
  return cleaned.trim();
}

export async function routeIntent(
  message: string,
  previousPersona?: "alfred" | "simone" | "gustave"
): Promise<IntentResult> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return FALLBACK;

  const userContent = previousPersona
    ? `[Persona du tour précédent : ${previousPersona}]\n${message}`
    : message;

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
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!resp.ok) {
      console.error("routeIntent API error:", resp.status, await resp.text());
      return FALLBACK;
    }

    const data = await resp.json();
    const text: string = data.content?.[0]?.text ?? "";

    try {
      const result = JSON.parse(stripJsonFence(text)) as IntentResult;
      console.log(`routeIntent → persona=${result.persona} intent=${result.intent} conf=${result.confidence}`);
      return result;
    } catch {
      console.error("routeIntent JSON.parse failed:", `len=${text.length}`, text);
      return FALLBACK;
    }
  } catch (e) {
    console.error("routeIntent error:", e);
    return FALLBACK;
  }
}
