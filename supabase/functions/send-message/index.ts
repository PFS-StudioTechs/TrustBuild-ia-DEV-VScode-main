import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
  const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") ?? "noreply@trustbuild.ia";
  const fromName = Deno.env.get("SENDGRID_FROM_NAME") ?? "TrustBuild-IA";

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { to_email, to_name, subject, body } = await req.json();
  if (!to_email || !subject || !body) {
    return new Response(JSON.stringify({ error: "Champs manquants (to_email, subject, body)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Fetch artisan profile for sender identity
  const { data: profile } = await serviceClient.from("profiles").select("prenom, nom, email").eq("user_id", user.id).single();
  const senderName = profile ? `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || fromName : fromName;
  const replyTo = profile?.email ?? user.email ?? fromEmail;

  let sendStatus = "sent";
  if (sendgridApiKey) {
    const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { "Authorization": `Bearer ${sendgridApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to_email, name: to_name ?? to_email }] }],
        from: { email: fromEmail, name: `${senderName} via ${fromName}` },
        reply_to: { email: replyTo, name: senderName },
        subject,
        content: [{ type: "text/plain", value: body }],
      }),
    });
    if (!sgRes.ok) sendStatus = "error";
  } else {
    sendStatus = "no_sendgrid";
  }

  // Store message in DB regardless of send status
  await serviceClient.from("messages").insert({
    artisan_id: user.id,
    to_email,
    to_name: to_name ?? null,
    subject,
    body,
    status: sendStatus,
  });

  return new Response(JSON.stringify({ ok: true, status: sendStatus }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
