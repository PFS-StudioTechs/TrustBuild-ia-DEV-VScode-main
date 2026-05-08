#!/usr/bin/env ts-node
// @ts-nocheck — fichier Node.js dans un répertoire Deno, hors scope du tsconfig Vite
/**
 * Test routeIntent() — 15 cas de routing
 *
 * Run :
 *   $env:ANTHROPIC_API_KEY="sk-ant-..."
 *   npx ts-node supabase/functions/_shared/intent-router.test.ts
 *
 * Ou créer supabase/.env.local :
 *   ANTHROPIC_API_KEY=sk-ant-...
 * puis lancer normalement.
 *
 * Requires: Node 18+ (global fetch)
 */

// Tentative de chargement du .env (plusieurs emplacements courants)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path") as typeof import("path");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require("dotenv") as { config: (opts?: { path: string }) => void };
  const root = path.join(__dirname, "../../..");
  for (const f of [".env.local", ".env", "supabase/.env.local"]) {
    dotenv.config({ path: path.join(root, f) });
  }
} catch {
  // dotenv absent — on utilise process.env directement
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error("❌  ANTHROPIC_API_KEY non défini. Exportez-le avant de lancer le script.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IntentResult {
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

interface TestCase {
  id: number;
  message: string;
  expected: {
    persona: string;
    intent: string;
    minConfidence?: number;
    entities?: Partial<IntentResult["entities"]>;
  };
  note?: string;
}

// ---------------------------------------------------------------------------
// Copie Node.js compatible de routeIntent() (même logique que intent-router.ts)
// ---------------------------------------------------------------------------

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

const FALLBACK: IntentResult = {
  persona: "jarvis",
  intent: "GENERAL",
  entities: {},
  confidence: 0,
};

async function routeIntent(message: string): Promise<IntentResult> {
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY!,
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
      console.error(`  API error: ${resp.status} ${resp.statusText}`);
      return FALLBACK;
    }

    const data = (await resp.json()) as { content?: { text: string }[] };
    const text: string = data.content?.[0]?.text ?? "";

    console.log("=== ROUTER RAW RESPONSE ===");
    console.log(JSON.stringify(data.content, null, 2));
    console.log("=== TEXT EXTRACTED ===");
    console.log(text);
    console.log("=== END ROUTER DEBUG ===");

    try {
      return JSON.parse(text.trim()) as IntentResult;
    } catch {
      console.error(`  JSON parse error. Raw: ${text}`);
      return FALLBACK;
    }
  } catch (e) {
    console.error(`  Fetch error: ${e}`);
    return FALLBACK;
  }
}

// ---------------------------------------------------------------------------
// Cas de test
// ---------------------------------------------------------------------------

const TESTS: TestCase[] = [
  {
    id: 1,
    message:
      "J'ai posé 60m² de parquet chez M. Martin rue des Lilas, fourniture et pose, j'ai utilisé du chêne huilé",
    expected: {
      persona: "jarvis",
      intent: "DEVIS_CREATE",
      minConfidence: 0.9,
      entities: { client: "M. Martin", surface: 60, materiau: "chêne huilé" },
    },
    note: "Jarvis pré-remplit le formulaire devis avec les entités",
  },
  {
    id: 2,
    message:
      "Mon client me réclame des fissures 3 ans après la fin du chantier, est-ce que je suis couvert ?",
    expected: {
      persona: "robert_b",
      intent: "QUERY_EXPERT",
      minConfidence: 0.9,
      entities: { domaine: "juridique" },
    },
    note: "Robert B explique garantie décennale 10 ans",
  },
  {
    id: 3,
    message:
      "Quelle épaisseur de laine de verre je dois mettre en combles perdus pour être en RE2020 ?",
    expected: {
      persona: "auguste_p",
      intent: "QUERY_EXPERT",
      minConfidence: 0.9,
      entities: { prestation: "isolation combles", materiau: "laine de verre" },
    },
    note: "Auguste P donne R≥7, cite DTU 45.11",
  },
  {
    id: 4,
    message:
      "J'ai un client qui veut isoler sa maison de 1920, murs en pierre de 50cm, 120m² habitable",
    expected: {
      persona: "auguste_p",
      intent: "QUOTE_SUGGEST",
      minConfidence: 0.85,
      entities: { surface: 120, prestation: "isolation", materiau: "pierre" },
    },
    note: "Auguste P conseille ITE, passe la main à Jarvis pour chiffrer",
  },
  {
    id: 5,
    message:
      "Mon isolation est conforme DTU mais le client dit qu'il fait froid, il menace de pas payer",
    expected: {
      persona: "robert_b",
      intent: "QUERY_EXPERT",
      minConfidence: 0.75,
    },
    note: "Enjeu principal = impayé/litige → Robert B (DTU est secondaire)",
  },
  {
    id: 6,
    message:
      "Je dois faire un devis pour une terrasse en bois, 40m², mais je sais pas si je dois mettre le DTU 51.4 dans les conditions",
    expected: {
      persona: "jarvis",
      intent: "DEVIS_CREATE",
      minConfidence: 0.8,
      entities: { prestation: "terrasse bois", surface: 40 },
    },
    note: "Intent principal = DEVIS_CREATE. Question DTU est secondaire.",
  },
  {
    id: 7,
    message: "C'est quoi la différence entre biennale et décennale ?",
    expected: {
      persona: "robert_b",
      intent: "QUERY_EXPERT",
      minConfidence: 0.85,
    },
    note: "Keywords Robert B clairs : biennale, décennale",
  },
  {
    id: 8,
    message:
      "J'ai mis de l'isolant mais pas assez épais selon le client, il refuse de payer la dernière facture",
    expected: {
      persona: "robert_b",
      intent: "QUERY_EXPERT",
      minConfidence: 0.75,
    },
    note: "Technique sous-jacent, enjeu = impayé → Robert B (mentionne Auguste P)",
  },
  {
    id: 9,
    message:
      "Euh ouais donc j'étais chez Dupont ce matin, salle de bain, robinetterie, enfin tu vois",
    expected: {
      persona: "jarvis",
      intent: "DEVIS_CREATE",
      minConfidence: 0.65,
      entities: { client: "Dupont", prestation: "robinetterie salle de bain" },
    },
    note: "Message flou — confidence ~0.70 attendu, zone grise acceptable",
  },
  {
    id: 10,
    message: "Bonjour",
    expected: {
      persona: "jarvis",
      intent: "GENERAL",
      minConfidence: 0.95,
    },
    note: "Salutation simple — Jarvis répond normalement",
  },
  {
    id: 11,
    message: "J'ai besoin d'un devis pour poser de la décennale sur mon camion",
    expected: {
      persona: "jarvis",
      intent: "DEVIS_CREATE",
      minConfidence: 0.8,
    },
    note: '"décennale" présent mais contexte = devis. Router doit peser l\'intent global.',
  },
  {
    id: 12,
    message: "DTU isolation",
    expected: {
      persona: "auguste_p",
      intent: "QUERY_EXPERT",
      minConfidence: 0.85,
    },
    note: "Message court — Auguste P demande contexte complémentaire",
  },
  {
    id: 13,
    message:
      "Sur le devis Leblanc, rajoute une ligne pour l'évacuation des gravats, 200 euros",
    expected: {
      persona: "jarvis",
      intent: "DEVIS_UPDATE",
      minConfidence: 0.9,
      entities: { client: "Leblanc", montant: 200, prestation: "évacuation gravats" },
    },
    note: "Jarvis confirme la modification et met à jour",
  },
  {
    id: 14,
    message:
      "J'ai un sous-traitant qui veut que je le paie cash, sans contrat écrit",
    expected: {
      persona: "robert_b",
      intent: "QUERY_EXPERT",
      minConfidence: 0.9,
    },
    note: "Robert B explique obligation légale contrat écrit + risques travail au noir",
  },
  {
    id: 15,
    message:
      "J'ai des moisissures dans une chambre que j'ai isolée il y a 6 mois, le client veut que je revienne",
    expected: {
      persona: "auguste_p",
      intent: "QUERY_EXPERT",
      minConfidence: 0.85,
    },
    note: "Auguste P diagnostique condensation interstitielle, mentionne Robert B pour responsabilité",
  },
];

// ---------------------------------------------------------------------------
// Comparaison des entités (souple — on vérifie seulement les clés attendues)
// ---------------------------------------------------------------------------

function checkEntities(
  expected: Partial<IntentResult["entities"]> | undefined,
  actual: IntentResult["entities"]
): { ok: boolean; details: string[] } {
  if (!expected || Object.keys(expected).length === 0) return { ok: true, details: [] };

  const details: string[] = [];
  let ok = true;

  for (const [key, expectedVal] of Object.entries(expected)) {
    const actualVal = actual[key as keyof IntentResult["entities"]];
    if (actualVal === undefined) {
      details.push(`  entité "${key}" absente (attendu: ${expectedVal})`);
      ok = false;
    } else if (key === "surface" || key === "montant") {
      // Valeur numérique — tolérance ±5%
      const diff = Math.abs(Number(actualVal) - Number(expectedVal));
      if (diff > Number(expectedVal) * 0.05) {
        details.push(`  entité "${key}": ${actualVal} ≠ ${expectedVal}`);
        ok = false;
      }
    } else if (key === "client" || key === "prestation" || key === "materiau") {
      // Correspondance souple : mot-clé principal présent
      const keyword = String(expectedVal).toLowerCase().split(/[\s,]+/)[0];
      if (!String(actualVal).toLowerCase().includes(keyword)) {
        details.push(`  entité "${key}": "${actualVal}" ne contient pas "${keyword}"`);
        // Entités texte : WARN, pas FAIL
      }
    } else if (actualVal !== expectedVal) {
      details.push(`  entité "${key}": "${actualVal}" ≠ "${expectedVal}"`);
      ok = false;
    }
  }

  return { ok, details };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

(async () => {
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;
  const failDetails: string[] = [];

  const SEP = "─".repeat(72);
  console.log(`\n${"═".repeat(72)}`);
  console.log(`  intent-router — suite de test (15 cas)`);
  console.log(`  Modèle : claude-haiku-4-5-20251001`);
  console.log(`${"═".repeat(72)}\n`);

  for (const tc of TESTS) {
    console.log(`${SEP}`);
    console.log(`Test ${tc.id.toString().padStart(2, "0")}/15`);
    console.log(`  Message  : "${tc.message}"`);
    if (tc.note) console.log(`  Attendu  : ${tc.note}`);

    const result = await routeIntent(tc.message);

    console.log(`  Résultat : persona=${result.persona}  intent=${result.intent}  confidence=${result.confidence.toFixed(2)}`);
    if (Object.keys(result.entities).length > 0) {
      console.log(`  Entités  : ${JSON.stringify(result.entities)}`);
    }

    // Jugement
    const personaOk = result.persona === tc.expected.persona;
    const intentOk = result.intent === tc.expected.intent;
    const confOk = result.confidence >= (tc.expected.minConfidence ?? 0);
    const { details: entDetails } = checkEntities(
      tc.expected.entities,
      result.entities
    );

    if (!personaOk || !intentOk) {
      // FAIL — persona ou intent incorrect
      failCount++;
      const reason = [
        !personaOk ? `persona="${result.persona}" attendu "${tc.expected.persona}"` : "",
        !intentOk ? `intent="${result.intent}" attendu "${tc.expected.intent}"` : "",
      ]
        .filter(Boolean)
        .join(", ");
      console.log(`  ❌ FAIL  : ${reason}`);
      failDetails.push(`Test ${tc.id.toString().padStart(2, "0")} — ${reason}`);
    } else if (!confOk) {
      // WARN — persona/intent corrects mais confidence faible
      warnCount++;
      console.log(
        `  ⚠️  WARN  : persona+intent OK, confidence=${result.confidence.toFixed(2)} < ${tc.expected.minConfidence}`
      );
    } else {
      // PASS
      passCount++;
      console.log(`  ✅ PASS`);
    }

    if (entDetails.length > 0) {
      console.log(`  Entités manquantes :`);
      entDetails.forEach((d) => console.log(d));
    }
  }

  // -------------------------------------------------------------------------
  // Résumé final
  // -------------------------------------------------------------------------
  console.log(`\n${"═".repeat(72)}`);
  console.log(`  RÉSUMÉ`);
  console.log(`${"═".repeat(72)}`);
  console.log(`  ✅ PASS : ${passCount}/15`);
  console.log(`  ⚠️  WARN : ${warnCount}  (persona+intent OK, confidence zone grise)`);
  console.log(`  ❌ FAIL : ${failCount}`);
  if (failDetails.length > 0) {
    console.log(`\n  Détail des FAIL :`);
    failDetails.forEach((d) => console.log(`    • ${d}`));
  }
  console.log(`${"═".repeat(72)}\n`);

  process.exit(failCount > 0 ? 1 : 0);
})();
