import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Point d'abstraction unique pour la recherche catalogue partenaires.
// Aujourd'hui : lit les fixtures simulées (Castor, Merlin) dans `produits`.
// Demain : même signature d'entrée/sortie, bascule vers un appel API réel
// par fournisseur (cf. `fournisseurs_partenaires.source` à introduire alors).

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OffreCatalogue {
  produit_id: string;
  fournisseur_id: string;
  fournisseur_nom: string;
  prix_achat: number;
}

interface ArticleCatalogue {
  reference: string;
  designation: string;
  unite: string;
  offres: OffreCatalogue[];
  moins_cher_fournisseur_id: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { q } = await req.json().catch(() => ({ q: "" }));

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabaseAdmin
      .from("produits")
      .select("id, reference, designation, unite, prix_achat, fournisseur_id, catalogue_fournisseurs(nom)")
      .is("artisan_id", null)
      .eq("actif", true)
      .eq("statut_import", "valide")
      .order("designation");

    if (typeof q === "string" && q.trim().length > 0) {
      query = query.ilike("designation", `%${q.trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const groupes = new Map<string, ArticleCatalogue>();
    for (const row of data ?? []) {
      const key = row.reference ?? row.id;
      if (!groupes.has(key)) {
        groupes.set(key, { reference: key, designation: row.designation, unite: row.unite, offres: [], moins_cher_fournisseur_id: null });
      }
      groupes.get(key)!.offres.push({
        produit_id: row.id,
        fournisseur_id: row.fournisseur_id,
        fournisseur_nom: (row as any).catalogue_fournisseurs?.nom ?? "Fournisseur",
        prix_achat: row.prix_achat,
      });
    }

    const articles = Array.from(groupes.values()).map(a => {
      if (a.offres.length < 2) return a;
      const moinsCher = a.offres.reduce((min, o) => (o.prix_achat < min.prix_achat ? o : min));
      return { ...a, moins_cher_fournisseur_id: moinsCher.fournisseur_id };
    });

    return new Response(JSON.stringify({ articles }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "Erreur interne" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
