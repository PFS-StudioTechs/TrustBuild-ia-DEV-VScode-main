import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Tu es Alfred, l'assistant de TrustBuild-IA. Dans ce mode, tu assistes un CLIENT (un particulier, sans compétence technique du bâtiment) qui a reçu plusieurs devis d'artisans différents pour un même projet et veut les comparer.

Ta mission : rapprocher sémantiquement les lignes des devis pour les rendre comparables, et éclairer la décision du client — sans jamais la prendre à sa place.

ENTRÉE
Un JSON de N devis anonymisés ("Artisan 1", "Artisan 2"…). Chaque devis est une liste de lignes : designation, quantite, unite, prix_unitaire, tva.
Tu ne connais jamais les vrais noms des artisans. N'en invente pas.

TA TÂCHE
1. Identifier les postes équivalents entre devis, même formulés différemment (ex. "dépose cloison" ≈ "démolition existant"). Regroupe-les sous un "poste_canonique" au libellé clair et neutre.
2. Conserver à l'identique les lignes sans équivalent (orphelines).
3. Signaler, pour chaque poste, quels artisans le couvrent et lesquels non.
4. Lever des alertes factuelles : unités hétérogènes pour un même poste, écart de prix anormal, poste absent chez un artisan.
5. Produire des observations utiles à la décision, sans jamais désigner un "meilleur" artisan.

RÈGLES IMPÉRATIVES
- Ne calcule AUCUN total ni sous-total. Les montants sont recalculés côté serveur. Tu te limites au rapprochement.
- N'invente jamais une ligne, un prix ou un poste absent des données reçues.
- Attribue à chaque rapprochement un niveau de confiance entre 0 et 1. En cas de doute, baisse la confiance plutôt que de forcer un regroupement.
- Dans le doute entre regrouper et séparer, SÉPARE. Un faux regroupement trompe le client ; une séparation de trop est sans gravité.
- Ne recommande jamais un artisan. Tu éclaires, tu ne tranches pas. La décision appartient au client.
- Reste strictement factuel. Aucun jugement commercial sur les artisans.
- Tu t'adresses à un particulier : tes "message" d'observation sont en langage simple, sans jargon technique non expliqué.

SORTIE
Réponds UNIQUEMENT avec un objet JSON valide conforme au schéma de l'exemple ci-dessous. Aucun texte avant ou après. Pas de Markdown, pas de commentaire.`;

const ONE_SHOT_USER = `{
  "demande_id": "DEM-2026-0042",
  "devis": [
    {"artisan_ref": "Artisan 1", "lignes": [
      {"designation": "Démolition cloison placo existante", "quantite": 12, "unite": "m2", "pu_ht": 25.00, "montant_ht": 300.00, "tva": 10},
      {"designation": "Fourniture et pose carrelage sol grès", "quantite": 15, "unite": "m2", "pu_ht": 48.00, "montant_ht": 720.00, "tva": 10},
      {"designation": "Évacuation et mise en déchetterie des gravats", "quantite": 1, "unite": "forfait", "pu_ht": 180.00, "montant_ht": 180.00, "tva": 10}
    ]},
    {"artisan_ref": "Artisan 2", "lignes": [
      {"designation": "Dépose ancienne cloison", "quantite": 1, "unite": "forfait", "pu_ht": 280.00, "montant_ht": 280.00, "tva": 10},
      {"designation": "Carrelage sol (fourniture + pose)", "quantite": 15, "unite": "m2", "pu_ht": 52.00, "montant_ht": 780.00, "tva": 10},
      {"designation": "Évacuation gravats", "quantite": 1, "unite": "forfait", "pu_ht": 150.00, "montant_ht": 150.00, "tva": 10}
    ]},
    {"artisan_ref": "Artisan 3", "lignes": [
      {"designation": "Démolition cloison + évacuation incluse", "quantite": 1, "unite": "forfait", "pu_ht": 400.00, "montant_ht": 400.00, "tva": 10},
      {"designation": "Pose carrelage grès cérame sol", "quantite": 15, "unite": "m2", "pu_ht": 45.00, "montant_ht": 675.00, "tva": 10},
      {"designation": "Traitement anti-humidité mur nord", "quantite": 1, "unite": "forfait", "pu_ht": 320.00, "montant_ht": 320.00, "tva": 10}
    ]}
  ]
}`;

const ONE_SHOT_ASSISTANT = `{
  "version": "1.0",
  "demande_id": "DEM-2026-0042",
  "nb_devis": 3,
  "postes_canoniques": [
    {"id": "PC01", "libelle": "Démolition / dépose de la cloison existante", "categorie": "demolition",
     "lignes": [
       {"artisan_ref": "Artisan 1", "designation_origine": "Démolition cloison placo existante", "quantite": 12, "unite": "m2", "pu_ht": 25.00, "montant_ht": 300.00, "tva": 10, "confiance": 0.92},
       {"artisan_ref": "Artisan 2", "designation_origine": "Dépose ancienne cloison", "quantite": 1, "unite": "forfait", "pu_ht": 280.00, "montant_ht": 280.00, "tva": 10, "confiance": 0.90},
       {"artisan_ref": "Artisan 3", "designation_origine": "Démolition cloison + évacuation incluse", "quantite": 1, "unite": "forfait", "pu_ht": 400.00, "montant_ht": 400.00, "tva": 10, "confiance": 0.70}
     ],
     "presence": {"Artisan 1": true, "Artisan 2": true, "Artisan 3": true},
     "alerte_unite_heterogene": true, "alerte_ecart_prix": false},
    {"id": "PC02", "libelle": "Fourniture et pose de carrelage sol", "categorie": "revetement_sol",
     "lignes": [
       {"artisan_ref": "Artisan 1", "designation_origine": "Fourniture et pose carrelage sol grès", "quantite": 15, "unite": "m2", "pu_ht": 48.00, "montant_ht": 720.00, "tva": 10, "confiance": 0.95},
       {"artisan_ref": "Artisan 2", "designation_origine": "Carrelage sol (fourniture + pose)", "quantite": 15, "unite": "m2", "pu_ht": 52.00, "montant_ht": 780.00, "tva": 10, "confiance": 0.95},
       {"artisan_ref": "Artisan 3", "designation_origine": "Pose carrelage grès cérame sol", "quantite": 15, "unite": "m2", "pu_ht": 45.00, "montant_ht": 675.00, "tva": 10, "confiance": 0.85}
     ],
     "presence": {"Artisan 1": true, "Artisan 2": true, "Artisan 3": true},
     "alerte_unite_heterogene": false, "alerte_ecart_prix": false},
    {"id": "PC03", "libelle": "Évacuation des gravats", "categorie": "evacuation",
     "lignes": [
       {"artisan_ref": "Artisan 1", "designation_origine": "Évacuation et mise en déchetterie des gravats", "quantite": 1, "unite": "forfait", "pu_ht": 180.00, "montant_ht": 180.00, "tva": 10, "confiance": 0.93},
       {"artisan_ref": "Artisan 2", "designation_origine": "Évacuation gravats", "quantite": 1, "unite": "forfait", "pu_ht": 150.00, "montant_ht": 150.00, "tva": 10, "confiance": 0.93}
     ],
     "presence": {"Artisan 1": true, "Artisan 2": true, "Artisan 3": false},
     "alerte_unite_heterogene": false, "alerte_ecart_prix": false}
  ],
  "lignes_orphelines": [
    {"artisan_ref": "Artisan 3", "designation_origine": "Traitement anti-humidité mur nord", "quantite": 1, "unite": "forfait", "pu_ht": 320.00, "montant_ht": 320.00, "tva": 10, "raison": "Aucun équivalent chez les autres artisans"}
  ],
  "synthese_par_artisan": [
    {"artisan_ref": "Artisan 1", "nb_postes_couverts": 3, "nb_postes_total": 3, "postes_manquants": []},
    {"artisan_ref": "Artisan 2", "nb_postes_couverts": 3, "nb_postes_total": 3, "postes_manquants": []},
    {"artisan_ref": "Artisan 3", "nb_postes_couverts": 2, "nb_postes_total": 3, "postes_manquants": ["PC03"]}
  ],
  "observations": [
    {"type": "poste_manquant", "gravite": "haute", "message": "L'Artisan 3 ne chiffre pas l'évacuation des gravats séparément. Son poste de démolition indique 'évacuation incluse' : le coût y est probablement compris, mais demandez-lui confirmation."},
    {"type": "unite_heterogene", "gravite": "moyenne", "message": "La démolition est chiffrée au m² par l'Artisan 1 et au forfait par les deux autres. Les prix ne sont donc pas directement comparables sur ce poste."}
  ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
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

  let projet_id: string;
  try {
    const body = await req.json();
    projet_id = body.projet_id;
  } catch {
    return new Response(JSON.stringify({ error: "Body JSON invalide" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!projet_id) {
    return new Response(JSON.stringify({ error: "projet_id requis" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Vérification appartenance projet (RLS filtre déjà, mais on vérifie l'existence)
  const { data: projet, error: projetErr } = await userClient
    .from("client_projets")
    .select("id, libelle")
    .eq("id", projet_id)
    .maybeSingle();

  if (projetErr || !projet) {
    return new Response(
      JSON.stringify({ error: "Projet introuvable ou accès non autorisé" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Liaisons devis du projet (soft-deleted exclus, ordre d'ajout au projet)
  const { data: liaisons, error: liaisonsErr } = await userClient
    .from("client_projet_devis")
    .select("devis_id")
    .eq("projet_id", projet_id)
    .is("devis_supprime_at", null)
    .order("added_at");

  if (liaisonsErr) {
    console.error("[compare-devis] liaisons error:", liaisonsErr.message);
    return new Response(JSON.stringify({ error: "Erreur lors du chargement du projet" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!liaisons || liaisons.length < 2) {
    return new Response(
      JSON.stringify({ error: "Le projet doit contenir au moins 2 devis actifs pour être comparé" }),
      {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const devisIds = liaisons.map((l: { devis_id: string }) => l.devis_id);

  // Chargement numero + artisan_id pour le mapping
  const { data: devisInfos } = await userClient
    .from("devis")
    .select("id, numero, artisan_id")
    .in("id", devisIds);

  type DevisInfo = { id: string; numero: string; artisan_id: string };
  const devisInfoById: Record<string, DevisInfo> = {};
  for (const d of (devisInfos ?? []) as DevisInfo[]) {
    devisInfoById[d.id] = d;
  }

  const artisanIds = [...new Set(
    (devisInfos ?? []).map((d: DevisInfo) => d.artisan_id)
  )];

  // Lecture profils artisans (autorisée par profiles_select_by_client)
  const { data: artisanProfiles } = await userClient
    .from("profiles")
    .select("user_id, nom, prenom, raison_sociale")
    .in("user_id", artisanIds);

  type ProfileRow = { user_id: string; nom: string; prenom: string; raison_sociale: string | null };
  const profilesByUserId: Record<string, ProfileRow> = {};
  for (const p of (artisanProfiles ?? []) as ProfileRow[]) {
    profilesByUserId[p.user_id] = p;
  }

  // Anonymisation : "Artisan 1", "Artisan 2"… (ordre added_at ASC)
  const mapping: Record<string, { devis_id: string; artisan_nom: string; numero_devis: string }> = {};
  devisIds.forEach((devis_id, idx) => {
    const info = devisInfoById[devis_id];
    const profile = info ? profilesByUserId[info.artisan_id] : undefined;
    const artisan_nom = profile
      ? (profile.raison_sociale ?? `${profile.prenom} ${profile.nom}`.trim())
      : "Artisan inconnu";
    mapping[`Artisan ${idx + 1}`] = {
      devis_id,
      artisan_nom,
      numero_devis: info?.numero ?? "",
    };
  });

  const reverseMapping: Record<string, string> = {};
  Object.entries(mapping).forEach(([alias, val]) => {
    reverseMapping[val.devis_id] = alias;
  });

  // Chargement des lignes via la vue (userClient → auth.uid() résolu)
  const { data: lignes, error: lignesErr } = await userClient
    .from("lignes_devis_client")
    .select("id, devis_id, designation, quantite, unite, prix_unitaire, tva, ordre, section_nom")
    .in("devis_id", devisIds)
    .order("devis_id")
    .order("ordre");

  if (lignesErr) {
    console.error("[compare-devis] lignes error:", lignesErr.message);
    return new Response(JSON.stringify({ error: "Erreur lors du chargement des lignes" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Regroupement des lignes par devis
  type Ligne = {
    devis_id: string;
    designation: string;
    quantite: number;
    unite: string;
    prix_unitaire: number;
    tva: number;
    ordre: number;
    section_nom: string | null;
  };

  const devisGroupes: Record<string, Ligne[]> = {};
  for (const l of (lignes ?? []) as Ligne[]) {
    if (!devisGroupes[l.devis_id]) devisGroupes[l.devis_id] = [];
    devisGroupes[l.devis_id].push(l);
  }

  // Construction du payload anonymisé pour Claude (alias uniquement — jamais les vrais noms)
  const devisAnonymises = devisIds.map((devis_id) => ({
    artisan_ref: reverseMapping[devis_id],
    lignes: (devisGroupes[devis_id] ?? []).map((l) => ({
      designation: l.designation,
      quantite: Number(l.quantite),
      unite: l.unite,
      pu_ht: Number(l.prix_unitaire),
      montant_ht: Math.round(Number(l.quantite) * Number(l.prix_unitaire) * 100) / 100,
      tva: Number(l.tva),
      ...(l.section_nom ? { section: l.section_nom } : {}),
    })),
  }));

  const userMessage = JSON.stringify({
    demande_id: projet_id,
    nb_devis: devisIds.length,
    devis: devisAnonymises,
  });

  // Appel Haiku non-streamé
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: ONE_SHOT_USER },
        { role: "assistant", content: ONE_SHOT_ASSISTANT },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    console.error("[compare-devis] Anthropic error:", anthropicRes.status, errText);
    return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anthropicData = await anthropicRes.json();
  const rawText = (anthropicData.content?.[0]?.text ?? "").trim();
  const cleanedText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  let comparison: unknown;
  try {
    comparison = JSON.parse(cleanedText);
  } catch {
    console.error("[compare-devis] JSON parse failed. Raw:", cleanedText.slice(0, 500));
    return new Response(
      JSON.stringify({ error: "La réponse de l'IA n'est pas un JSON valide. Réessayez." }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({ comparison, mapping }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
