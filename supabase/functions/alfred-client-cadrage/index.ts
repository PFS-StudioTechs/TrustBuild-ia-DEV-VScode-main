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
    const { data: projet, error: fetchErr } = await userClient
      .from("client_projets")
      .select("id, libelle, statut, description, localisation, brief_data, created_at, updated_at")
      .eq("id", projet_id)
      .maybeSingle();

    if (fetchErr) return json({ error: fetchErr.message }, 500);
    if (!projet) return json({ error: "Projet introuvable ou accès refusé" }, 404);

    const mission = prochaineMission({
      description: projet.description,
      localisation: projet.localisation,
      brief_data: (projet.brief_data ?? {}) as BriefData,
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

    // Charger le projet actuel (RLS garantit l'appartenance)
    const { data: projet, error: fetchErr } = await userClient
      .from("client_projets")
      .select("id, libelle, statut, description, localisation, brief_data, created_at, updated_at")
      .eq("id", projet_id)
      .maybeSingle();

    if (fetchErr) return json({ error: fetchErr.message }, 500);
    if (!projet) return json({ error: "Projet introuvable ou accès refusé" }, 404);

    const currentBriefData = (projet.brief_data ?? {}) as BriefData;

    // Colonnes directes
    if (champ === "description" || champ === "localisation") {
      if (typeof valeur !== "string") {
        return json({ error: `${champ} doit être une string` }, 400);
      }
      const { error: updateErr } = await userClient
        .from("client_projets")
        .update({ [champ]: valeur })
        .eq("id", projet_id);
      if (updateErr) return json({ error: updateErr.message }, 500);

      const updated = { ...projet, [champ]: valeur };
      const mission = prochaineMission({
        description: updated.description,
        localisation: updated.localisation,
        brief_data: currentBriefData,
      });
      return json({ brief: updated, mission });
    }

    // Champs JSONB — merge sûr
    const newBriefData: BriefData = structuredClone(currentBriefData);

    if (champ === "lots") {
      if (!Array.isArray(valeur)) {
        return json({ error: "lots doit être un array" }, 400);
      }
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
          return json({ error: `Corps de métier inconnus : ${inconnus.join(", ")}` }, 400);
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

    if (updateErr) return json({ error: updateErr.message }, 500);

    const updated = { ...projet, brief_data: newBriefData };
    const mission = prochaineMission({
      description: updated.description,
      localisation: updated.localisation,
      brief_data: newBriefData,
    });

    return json({ brief: updated, mission });
  }

  return json({ error: `Action inconnue : ${action}` }, 400);
});
