import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { prochaineMission, type BriefData } from "../_shared/prochaineMission.ts";

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

const CHAMPS_AUTORISES = new Set([
  "description",
  "localisation",
  "lots",
  "pieces_jointes",
  "archi",
  "catalogue",
]);

const ALFRED_CLIENT_PROMPT = `Tu es Alfred, l'assistant de cadrage de TrustBuild-IA. Tu accompagnes un client dans la définition de son projet de travaux pour le mettre en relation avec les bons artisans.

TON RÔLE STRICT :
- Poser UNE question à la fois, celle imposée par l'étape courante fournie dans le contexte
- Extraire les informations du message du client et les structurer
- Vouvoyer le client, ton ton est chaleureux, professionnel et rassurant
- Ne jamais évoquer les marges, coûts artisan, commissions ou données internes de la plateforme
- Ne jamais proposer de créer des devis, factures ou documents
- Ne jamais anticiper une étape ultérieure

RÉPONSE OBLIGATOIRE — JSON pur, aucun texte autour, aucun bloc Markdown :
{
  "reponse_alfred": "<ce que tu dis au client>",
  "extraction": [
    { "champ": "<nom du champ>", "valeur": <valeur structurée> }
  ] | null
}

RÈGLES D'EXTRACTION :
- Si le client fournit les infos de l'étape courante → extrais et confirme dans reponse_alfred
- Si vague ou incomplet → reformule la question, "extraction": null
- S1 (champ_attendu=description) : extrais la description textuelle ET les lots vers la nomenclature fermée fournie. Slugs exacts uniquement. Besoin sans correspondance → demande précision, ne jamais inventer un slug. Retourne deux entrées dans le tableau d'extraction : une pour "description" (string), une pour "lots" (array).
- S2 (champ_attendu=localisation) : localisation en string (adresse, ville, code postal)
- S3 (champ_attendu=pieces_jointes) : plans disponibles → {renseigne:true,plan_fourni:true,a_discuter_artisan:false} ; à discuter → {renseigne:true,plan_fourni:false,a_discuter_artisan:true} ; pas de plans → {renseigne:true,plan_fourni:false,a_discuter_artisan:false}
- S4 (champ_attendu=archi_interieur) : client accepte → {propose:true,accepte:true} ; refuse → {propose:true,accepte:false} ; hésitant → reformule
- S5 (champ_attendu=catalogue_produits) : veut consulter → {propose:true,consulte:true} ; non → {propose:true,consulte:false}`;

type SupabaseClient = ReturnType<typeof createClient>;

type ProjetRow = {
  id: string;
  libelle: string;
  statut: string;
  description: string | null;
  localisation: string | null;
  brief_data: BriefData;
  created_at: string;
  updated_at: string;
};

async function chargerProjet(
  userClient: SupabaseClient,
  projet_id: string
): Promise<{ projet: ProjetRow | null; error: string | null }> {
  const { data, error } = await userClient
    .from("client_projets")
    .select("id, libelle, statut, description, localisation, brief_data, created_at, updated_at")
    .eq("id", projet_id)
    .maybeSingle();
  if (error) return { projet: null, error: error.message };
  return { projet: data as ProjetRow | null, error: null };
}

async function persistReponse(
  userClient: SupabaseClient,
  projet_id: string,
  champ: string,
  valeur: unknown,
  currentProjet: ProjetRow
): Promise<{ projet: ProjetRow | null; error: string | null }> {
  if (!CHAMPS_AUTORISES.has(champ)) {
    return { projet: null, error: `Champ non autorisé : ${champ}` };
  }

  const currentBriefData = (currentProjet.brief_data ?? {}) as BriefData;

  if (champ === "description" || champ === "localisation") {
    if (typeof valeur !== "string") {
      return { projet: null, error: `${champ} doit être une string` };
    }
    const { error: updateErr } = await userClient
      .from("client_projets")
      .update({ [champ]: valeur })
      .eq("id", projet_id);
    if (updateErr) return { projet: null, error: updateErr.message };
    return { projet: { ...currentProjet, [champ]: valeur }, error: null };
  }

  const newBriefData: BriefData = structuredClone(currentBriefData);

  if (champ === "lots") {
    if (!Array.isArray(valeur)) return { projet: null, error: "lots doit être un array" };
    const lots = valeur as Array<{ corps_metier: string; detail: string }>;
    const corpsMetierIds = lots.map((l) => l.corps_metier);
    if (corpsMetierIds.length > 0) {
      const { data: known } = await userClient
        .from("corps_metier")
        .select("id")
        .in("id", corpsMetierIds)
        .eq("actif", true);
      const knownIds = new Set((known ?? []).map((r: { id: string }) => r.id));
      const inconnus = corpsMetierIds.filter((id) => !knownIds.has(id));
      if (inconnus.length > 0) {
        return { projet: null, error: `Corps de métier inconnus : ${inconnus.join(", ")}` };
      }
    }
    newBriefData.lots = lots;
  }

  if (champ === "pieces_jointes") {
    newBriefData.pieces_jointes = valeur as BriefData["pieces_jointes"];
  }

  if (champ === "archi") {
    newBriefData.options = {
      ...newBriefData.options,
      archi_interieur: valeur as BriefData["options"]["archi_interieur"],
    };
  }

  if (champ === "catalogue") {
    newBriefData.options = {
      ...newBriefData.options,
      catalogue_produits: valeur as BriefData["options"]["catalogue_produits"],
    };
  }

  const { error: updateErr } = await userClient
    .from("client_projets")
    .update({ brief_data: newBriefData })
    .eq("id", projet_id);
  if (updateErr) return { projet: null, error: updateErr.message };

  return { projet: { ...currentProjet, brief_data: newBriefData }, error: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Non autorisé" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Non autorisé" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON invalide" }, 400);
  }

  const { action, projet_id } = body as { action?: string; projet_id?: string };

  if (!action || !projet_id) {
    return json({ error: "Champs requis : action, projet_id" }, 400);
  }

  // ── GET_ETAT ─────────────────────────────────────────────────────────────
  if (action === "get_etat") {
    const { projet, error: fetchErr } = await chargerProjet(userClient, projet_id);
    if (fetchErr) return json({ error: fetchErr }, 500);
    if (!projet) return json({ error: "Projet introuvable ou accès refusé" }, 404);

    const mission = prochaineMission({
      description: projet.description,
      localisation: projet.localisation,
      brief_data: projet.brief_data,
    });

    return json({ brief: projet, mission });
  }

  // ── ECRIRE_REPONSE ───────────────────────────────────────────────────────
  if (action === "ecrire_reponse") {
    const { champ, valeur } = body as { champ?: string; valeur?: unknown };
    if (!champ || valeur === undefined) {
      return json({ error: "Champs requis : champ, valeur" }, 400);
    }
    if (!CHAMPS_AUTORISES.has(champ)) {
      return json({ error: `Champ non autorisé : ${champ}` }, 400);
    }

    const { projet, error: fetchErr } = await chargerProjet(userClient, projet_id);
    if (fetchErr) return json({ error: fetchErr }, 500);
    if (!projet) return json({ error: "Projet introuvable ou accès refusé" }, 404);

    const { projet: updated, error: persistErr } = await persistReponse(
      userClient, projet_id, champ, valeur, projet
    );
    if (persistErr) return json({ error: persistErr }, 400);

    const mission = prochaineMission({
      description: updated!.description,
      localisation: updated!.localisation,
      brief_data: updated!.brief_data,
    });

    return json({ brief: updated, mission });
  }

  // ── DIALOGUER ────────────────────────────────────────────────────────────
  if (action === "dialoguer") {
    const { message_client, historique } = body as {
      message_client?: string;
      historique?: Array<{ role: string; content: string }>;
    };
    if (!message_client?.trim()) {
      return json({ error: "Champ requis : message_client" }, 400);
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY non configuré" }, 500);

    const { projet, error: fetchErr } = await chargerProjet(userClient, projet_id);
    if (fetchErr) return json({ error: fetchErr }, 500);
    if (!projet) return json({ error: "Projet introuvable ou accès refusé" }, 404);

    const mission = prochaineMission({
      description: projet.description,
      localisation: projet.localisation,
      brief_data: projet.brief_data,
    });

    let corpsMetierList: Array<{ id: string; libelle: string }> = [];
    if (mission.etape === "S1_cadrage") {
      const { data: cm } = await userClient
        .from("corps_metier")
        .select("id, libelle")
        .eq("actif", true)
        .order("ordre");
      corpsMetierList = (cm ?? []) as Array<{ id: string; libelle: string }>;
    }

    const contexte: Record<string, unknown> = {
      etape_courante: mission.etape,
      champ_attendu: mission.champ_attendu,
      bloquant: mission.bloquant,
      brief_actuel: {
        description: projet.description,
        localisation: projet.localisation,
        brief_data: projet.brief_data,
      },
    };
    if (corpsMetierList.length > 0) {
      contexte.nomenclature_corps_metier = corpsMetierList;
    }

    const userMessage = `CONTEXTE ÉTAPE :\n${JSON.stringify(contexte, null, 2)}\n\nMESSAGE CLIENT :\n${message_client}`;

    const histMessages = (historique ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        temperature: 0.3,
        system: ALFRED_CLIENT_PROMPT,
        messages: [...histMessages, { role: "user", content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("[alfred-client-cadrage] Anthropic error:", anthropicRes.status, errText);
      return json({ error: "Erreur du service IA" }, 500);
    }

    const anthropicData = await anthropicRes.json();
    const rawText = (anthropicData.content?.[0]?.text ?? "").trim();
    const cleanedText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    type LlmExtraction = { champ: string; valeur: unknown };
    type LlmResult = {
      reponse_alfred: string;
      extraction: LlmExtraction[] | LlmExtraction | null;
    };

    let llmResult: LlmResult;
    try {
      llmResult = JSON.parse(cleanedText);
    } catch {
      console.error("[alfred-client-cadrage] JSON parse failed:", cleanedText.slice(0, 500));
      return json({ error: "Réponse IA invalide. Réessayez." }, 500);
    }

    if (!llmResult.reponse_alfred) {
      return json({ error: "Réponse IA incomplète" }, 500);
    }

    let projetCourant: ProjetRow = projet;

    if (llmResult.extraction) {
      const extractions: LlmExtraction[] = Array.isArray(llmResult.extraction)
        ? llmResult.extraction
        : [llmResult.extraction];

      for (const ext of extractions) {
        if (!ext.champ || ext.valeur === undefined) continue;
        const { projet: updated, error: persistErr } = await persistReponse(
          userClient, projet_id, ext.champ, ext.valeur, projetCourant
        );
        if (persistErr) {
          console.warn("[alfred-client-cadrage] persist skip:", ext.champ, persistErr);
          continue;
        }
        projetCourant = updated!;
      }
    }

    const missionFinale = prochaineMission({
      description: projetCourant.description,
      localisation: projetCourant.localisation,
      brief_data: projetCourant.brief_data,
    });

    return json({
      reponse_alfred: llmResult.reponse_alfred,
      brief: projetCourant,
      mission: missionFinale,
    });
  }

  return json({ error: `Action inconnue : ${action}` }, 400);
});
