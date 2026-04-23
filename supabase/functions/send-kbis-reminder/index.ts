/**
 * send-kbis-reminder
 *
 * À appeler quotidiennement (cron ou trigger manuel).
 * Cherche les utilisateurs dont :
 *   - kbis_url IS NULL  (KBIS non déposé)
 *   - kbis_deadline est dans moins de 30 jours (rappel 5 mois)
 *   - kbis_deadline n'est PAS encore dépassée
 *
 * Envoie un email via Resend (RESEND_API_KEY requis dans les secrets Supabase).
 *
 * Variables d'environnement requises :
 *   RESEND_API_KEY     — clé API Resend (resend.com, gratuit jusqu'à 3000 emails/mois)
 *   RESEND_FROM_EMAIL  — adresse expéditeur (ex : "Trust Build-IA <noreply@trustbuild.fr>")
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "Trust Build-IA <noreply@trustbuild.ia>";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!resendApiKey) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY non configuré" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Utilisateurs dont la deadline est dans < 30 jours, pas encore dépassée, KBIS absent
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("user_id, nom, prenom, kbis_deadline")
    .is("kbis_url", null)
    .lte("kbis_deadline", in30Days.toISOString())
    .gte("kbis_deadline", now.toISOString());

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results: { user_id: string; status: string }[] = [];

  for (const profile of profiles ?? []) {
    // Récupérer l'email depuis auth.users via l'admin API
    const { data: userData } = await admin.auth.admin.getUserById(profile.user_id);
    const email = userData?.user?.email;
    if (!email) continue;

    const deadline = new Date(profile.kbis_deadline);
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const prenom = profile.prenom || "utilisateur";

    const emailBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a2e;">Bonjour ${prenom},</h2>
        <p>Votre compte <strong>Trust Build-IA</strong> a été créé il y a bientôt 5 mois.</p>
        <p>Il vous reste <strong>${daysLeft} jour${daysLeft > 1 ? "s" : ""}</strong> pour déposer votre <strong>extrait KBIS</strong> avant que votre accès soit restreint.</p>
        <p style="margin: 24px 0;">
          <a href="${supabaseUrl.replace(".supabase.co", ".vercel.app")}/upload-kbis"
             style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Déposer mon KBIS →
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">Si votre entreprise est en cours de création, contactez notre support pour obtenir un délai supplémentaire.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">Trust Build-IA — Votre assistant IA pour les artisans du bâtiment</p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: `⚠️ Rappel : déposez votre KBIS dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`,
        html: emailBody,
      }),
    });

    results.push({ user_id: profile.user_id, status: res.ok ? "sent" : `error_${res.status}` });
  }

  return new Response(
    JSON.stringify({ sent: results.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
