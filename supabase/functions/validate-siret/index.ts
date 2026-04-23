import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const apiKey = Deno.env.get("INSEE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "INSEE_API_KEY non configurée sur le serveur" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inseeRes = await fetch(
      `https://api.insee.fr/api-sirene/3.11/siret/${siretClean}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      }
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
