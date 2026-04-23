import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Obtient un Bearer token INSEE via OAuth2 client_credentials.
 * INSEE fournit une consumer key + consumer secret après souscription sur api.insee.fr.
 * Le token est demandé à chaque appel (durée de vie 7 jours, mais les Edge Functions
 * sont stateless donc on ne peut pas le mettre en cache entre invocations).
 */
async function getInseeToken(consumerKey: string, consumerSecret: string): Promise<string> {
  const credentials = btoa(`${consumerKey}:${consumerSecret}`);
  const res = await fetch("https://api.insee.fr/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Authentification INSEE échouée (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { siret } = await req.json();
    const siretClean = String(siret ?? "").replace(/\s/g, "");

    if (!/^\d{14}$/.test(siretClean)) {
      return new Response(
        JSON.stringify({ error: "SIRET invalide — 14 chiffres requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Priorité 1 : consumer key + secret (OAuth2 — recommandé)
    // Priorité 2 : bearer token direct (INSEE_API_KEY)
    const consumerKey = Deno.env.get("INSEE_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("INSEE_CONSUMER_SECRET");
    const directToken = Deno.env.get("INSEE_API_KEY");

    let bearerToken: string;
    if (consumerKey && consumerSecret) {
      bearerToken = await getInseeToken(consumerKey, consumerSecret);
    } else if (directToken) {
      bearerToken = directToken;
    } else {
      return new Response(
        JSON.stringify({
          error:
            "INSEE_CONSUMER_KEY + INSEE_CONSUMER_SECRET (ou INSEE_API_KEY) non configurés. " +
            "Souscrivez sur api.insee.fr puis ajoutez les variables dans Supabase → Settings → Edge Functions.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pour le plan OAuth2 : Authorization: Bearer {token}
    // Pour le plan "api key" public INSEE : header X-INSEE-Api-Key-Integration
    const inseeHeaders: Record<string, string> = { Accept: "application/json" };
    if (consumerKey && consumerSecret) {
      inseeHeaders["Authorization"] = `Bearer ${bearerToken}`;
    } else {
      inseeHeaders["X-INSEE-Api-Key-Integration"] = bearerToken;
    }

    const inseeRes = await fetch(
      `https://api.insee.fr/api-sirene/3.11/siret/${siretClean}`,
      { headers: inseeHeaders }
    );

    if (inseeRes.status === 404) {
      return new Response(
        JSON.stringify({ error: "SIRET introuvable dans la base INSEE" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!inseeRes.ok) {
      return new Response(
        JSON.stringify({ error: `Erreur INSEE (${inseeRes.status})` }),
        { status: inseeRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await inseeRes.json();
    const etab = data.etablissement;
    const addr = etab.adresseEtablissement;
    const ul = etab.uniteLegale;
    const periodes: any[] = etab.periodesEtablissement ?? [];
    const periode = periodes[0] ?? {};

    const actif = periode.etatAdministratifEtablissement === "A";

    const numeroVoie = addr.numeroVoieEtablissement ?? "";
    const typeVoie = addr.typeVoieEtablissement ?? "";
    const libelleVoie = addr.libelleVoieEtablissement ?? "";
    const adresse = [numeroVoie, typeVoie, libelleVoie].filter(Boolean).join(" ");

    const raisonSociale =
      ul.denominationUniteLegale ||
      [ul.prenomUsuelUniteLegale, ul.nomUniteLegale].filter(Boolean).join(" ");

    const nomCommercial =
      periode.denominationUsuelle1Etablissement ||
      ul.denominationUniteLegale ||
      raisonSociale;

    return new Response(
      JSON.stringify({
        siret: etab.siret,
        siren: etab.siren,
        raisonSociale,
        nomCommercial,
        adresse,
        codePostal: addr.codePostalEtablissement ?? "",
        ville: addr.libelleCommuneEtablissement ?? "",
        pays: "France",
        activite: ul.activitePrincipaleUniteLegale ?? "",
        formeJuridique: ul.categorieJuridiqueUniteLegale ?? "",
        actif,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message ?? "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
