import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
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

  const { to_email, to_name, subject, body, document_type, document_id } = await req.json();
  if (!to_email || !subject || !body) {
    return new Response(JSON.stringify({ error: "Champs manquants (to_email, subject, body)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: profile } = await serviceClient.from("profiles").select("prenom, nom, email").eq("user_id", user.id).single();
  const senderName = profile ? `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || fromName : fromName;
  const replyTo = profile?.email ?? user.email ?? fromEmail;

  // Generate PDF for devis and attach it
  let pdfBase64: string | null = null;
  let pdfFilename: string | null = null;
  if (document_type === "devis" && document_id) {
    try {
      const pdfRes = await fetch(`${supabaseUrl}/functions/v1/generate-facturx-pdf`, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
          "apikey": supabaseAnonKey,
        },
        body: JSON.stringify({ type: "devis", document_id }),
      });
      if (pdfRes.ok) {
        const pdfData = await pdfRes.json();
        if (pdfData.pdf_base64) {
          pdfBase64 = pdfData.pdf_base64;
          pdfFilename = `Devis_${pdfData.numero ?? document_id}.pdf`;
        }
      }
    } catch (e) {
      console.warn("PDF generation failed:", e);
    }
  }

  let sendStatus = "sent";
  if (sendgridApiKey) {
    const payload: Record<string, unknown> = {
      personalizations: [{ to: [{ email: to_email, name: to_name ?? to_email }] }],
      from: { email: fromEmail, name: `${senderName} via ${fromName}` },
      reply_to: { email: replyTo, name: senderName },
      subject,
      content: [{ type: "text/plain", value: body }],
    };

    if (pdfBase64 && pdfFilename) {
      payload.attachments = [{
        content: pdfBase64,
        filename: pdfFilename,
        type: "application/pdf",
        disposition: "attachment",
      }];
    }

    const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { "Authorization": `Bearer ${sendgridApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!sgRes.ok) {
      const errText = await sgRes.text();
      console.error("SendGrid error:", sgRes.status, errText);
      sendStatus = "error";
      log(serviceClient, { user_id: user.id, action: "email.send_failed", entity_type: document_type ?? undefined, entity_id: document_id ?? undefined, status: "error", details: { to: to_email, subject, sg_status: sgRes.status, sg_error: errText } });
    } else {
      log(serviceClient, { user_id: user.id, action: "email.sent", entity_type: document_type ?? undefined, entity_id: document_id ?? undefined, status: "success", details: { to: to_email, subject, has_pdf: !!pdfBase64 } });
    }
  } else {
    sendStatus = "no_sendgrid";
    log(serviceClient, { user_id: user.id, action: "email.no_sendgrid", entity_type: document_type ?? undefined, entity_id: document_id ?? undefined, status: "info", details: { to: to_email, subject } });
  }

  await serviceClient.from("messages").insert({
    artisan_id: user.id,
    to_email,
    to_name: to_name ?? null,
    subject,
    body,
    status: sendStatus,
    document_type: document_type ?? null,
    document_id: document_id ?? null,
  });

  return new Response(JSON.stringify({ ok: true, status: sendStatus }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
