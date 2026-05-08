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

const ROUTER_SYSTEM_PROMPT = `Tu es le routeur d'une application BTP pour artisans français.
Retourne UNIQUEMENT un JSON valide, sans markdown, sans explication.

━━━ RÈGLE PRINCIPALE : TYPE DE QUESTION ━━━

"auguste_p" — expert technique terrain
Déclenché si la question est de type :
  • "quelles normes / quelle réglementation pour X ?"
  • "comment faire / comment poser / comment installer X ?"
  • "quelle épaisseur / quel matériau / quelle section de câble ?"
  • "est-ce conforme / est-ce aux normes ?"
  • "comment diagnostiquer / pourquoi il y a X ?"
Mots-clés supplémentaires : norme, normes, réglementation, DTU, NF C, NF P, NF EN,
RT2020, RE2020, BBC, isolation, isolant, laine de verre, laine de roche, polystyrène,
polyuréthane, spot, spots encastrés, câble, circuit, disjoncteur, différentiel, tableau
électrique, IP44, IP65, étanchéité, pare-vapeur, condensation, pont thermique, béton,
armature, ferraillage, dalle, poutre, linteau, fondation, structure, charge admissible,
fissure, fissuration, humidité, moisissure, efflorescence, pathologie, enduit, mortier,
chape, carrelage, tuile, ardoise, membrane, EPDM, VMC, ventilation, acoustique.

"robert_b" — expert juridique artisan
Déclenché si la question porte sur :
  • droits et obligations légales de l'artisan
  • un client qui ne veut pas payer / impayé / litige
  • garanties (décennale, biennale, parfait achèvement)
  • contrats, sous-traitance, marché public
Mots-clés supplémentaires : contrat, garantie décennale, garantie biennale, assurance,
RC pro, responsabilité, litige, procès, tribunal, avocat, mise en demeure, impayé,
refus de payer, retenue de garantie, caution, pénalité, CCAP, marché public, résiliation,
abandon de chantier, réception, PV de réception, réserves, travail au noir, sous-traitant.

"jarvis" — assistant opérationnel (par défaut)
Déclenché pour : devis, facture, client, planning, prix, chiffrage, conversation générale.
DÉFAUT si aucune des deux autres personas ne correspond clairement.

━━━ PRIORITÉS EN CAS DE CONFLIT ━━━
1. Question "quelles normes / comment faire techniquement" → toujours "auguste_p"
2. Question sur litige / impayé / contrat / garantie → toujours "robert_b"
3. Demande de devis/facture explicite → toujours "jarvis"
4. Si conflit technique + juridique → choisir selon l'enjeu principal du message

CAS AMBIGUS :
• "isolation conforme + client ne paie pas" → "robert_b" (enjeu = impayé)
• "décennale + faire un devis" → "jarvis" (décennale mentionnée en passant)
• "normes pour poser des spots" → "auguste_p" (question technique même sans "DTU")
• "devis terrasse + DTU 51.4 ?" → "jarvis" (intent = DEVIS_CREATE, DTU secondaire)

━━━ INTENT ━━━
"DEVIS_CREATE" : créer un nouveau devis
"DEVIS_UPDATE" : modifier un devis existant
"QUOTE_SUGGEST" : situation décrite, l'agent propose un devis
"QUERY_EXPERT" : question technique ou juridique sans devis
"GENERAL" : bonjour, autre

━━━ ENTITÉS ━━━
Extraire si présents : client (nom), prestation (type travaux), surface (m²),
materiau (matériau principal), montant (euros)

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
