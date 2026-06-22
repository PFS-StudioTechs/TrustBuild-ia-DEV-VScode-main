import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  const fromEmail = Deno.env.get("BREVO_FROM_EMAIL") ?? "noreply@trustbuild.ia";
  const fromName = Deno.env.get("BREVO_FROM_NAME") ?? "TrustBuild-IA";

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

  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { prenom, nom, telephone, adresse, code_postal, ville, pays, new_email } = await req.json();

  const { data: currentProfile } = await serviceClient
    .from("profiles")
    .select("prenom, nom, telephone, adresse, code_postal, ville, pays")
    .eq("user_id", user.id)
    .single();

  if (!currentProfile) {
    return new Response(JSON.stringify({ error: "Profil introuvable" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: clientRows } = await serviceClient
    .from("clients")
    .select("id, artisan_id, email")
    .eq("auth_user_id", user.id);
  const clientRow = clientRows?.[0] ?? null;

  const changedFields: string[] = [];
  const newTel = telephone ?? null;
  const newAdresse = adresse ?? null;
  const newCp = code_postal ?? null;
  const newVille = ville ?? null;

  if (newTel !== (currentProfile.telephone ?? null)) changedFields.push("téléphone");
  if (
    newAdresse !== (currentProfile.adresse ?? null) ||
    newCp !== (currentProfile.code_postal ?? null) ||
    newVille !== (currentProfile.ville ?? null)
  ) changedFields.push("adresse");
  if (new_email && new_email !== (clientRow?.email ?? user.email ?? "")) {
    changedFields.push("email");
  }

  const { error: profileErr } = await serviceClient
    .from("profiles")
    .update({
      prenom: prenom ?? currentProfile.prenom,
      nom: nom ?? currentProfile.nom,
      telephone: newTel,
      adresse: newAdresse,
      code_postal: newCp,
      ville: newVille,
      pays: pays ?? currentProfile.pays ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (profileErr) {
    return new Response(JSON.stringify({ error: profileErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (clientRow) {
    await serviceClient
      .from("clients")
      .update({
        nom: nom ?? undefined,
        prenom: prenom ?? undefined,
        telephone: newTel,
        adresse: newAdresse,
        ...(new_email ? { email: new_email } : {}),
      })
      .eq("id", clientRow.id);

    if (changedFields.length > 0 && clientRow.artisan_id) {
      const clientFullName = `${prenom ?? ""} ${nom ?? ""}`.trim() || "Client";
      const changedStr = changedFields.join(", ");
      const subject = `Mise à jour de profil — ${clientFullName}`;
      const body = `${clientFullName} a modifié son profil client.\n\nChamp(s) mis à jour : ${changedStr}.\n\nVeuillez mettre à jour votre fiche client si nécessaire.`;

      const { data: artisanProfile } = await serviceClient
        .from("profiles")
        .select("email, prenom, nom")
        .eq("user_id", clientRow.artisan_id)
        .single();

      let msgStatus = "no_brevo";

      if (brevoApiKey && artisanProfile?.email) {
        const artisanName = `${artisanProfile.prenom ?? ""} ${artisanProfile.nom ?? ""}`.trim();
        try {
          const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": brevoApiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              to: [{ email: artisanProfile.email, name: artisanName }],
              sender: { email: fromEmail, name: fromName },
              replyTo: { email: user.email ?? fromEmail, name: clientFullName },
              subject,
              textContent: body,
            }),
          });
          msgStatus = brevoRes.ok ? "sent" : "error";
        } catch {
          msgStatus = "error";
        }
      }

      await serviceClient.from("messages").insert({
        artisan_id: clientRow.artisan_id,
        to_email: artisanProfile?.email ?? fromEmail,
        from_client_name: clientFullName,
        subject,
        body,
        direction: "inbound",
        status: msgStatus,
        read: false,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, changed_fields: changedFields }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
