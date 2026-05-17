import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildEmailHtml(personalMessage: string, documentHtml: string): string {
  const styleBlocks = [...documentHtml.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)]
    .map(m => m[0]).join("\n");

  const bodyMatch = documentHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let docContent = bodyMatch ? bodyMatch[1] : documentHtml;

  // Remove print-only elements
  docContent = docContent.replace(/<div[^>]+class="no-print"[^>]*>[\s\S]*?<\/div>/g, "");

  const msgHtml = personalMessage
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
${styleBlocks}
</head>
<body>
<div style="max-width:794px;margin:0 auto;padding:20px 0;">
  <div style="padding:16px 20px;background:#f0f7ff;border-left:4px solid #2563eb;border-radius:4px;margin-bottom:24px;font-size:10pt;line-height:1.7;">
    ${msgHtml}
  </div>
  <hr style="border:none;border-top:2px solid #e5e7eb;margin:0 0 20px 0;">
  ${docContent}
</div>
</body>
</html>`;
}

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

  // Fetch artisan profile for sender identity
  const { data: profile } = await serviceClient.from("profiles").select("prenom, nom, email").eq("user_id", user.id).single();
  const senderName = profile ? `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || fromName : fromName;
  const replyTo = profile?.email ?? user.email ?? fromEmail;

  // Fetch document HTML if document context provided
  let htmlEmail: string | null = null;
  if (document_type && document_id && (document_type === "devis" || document_type === "facture")) {
    try {
      const docRes = await fetch(`${supabaseUrl}/functions/v1/generate-pdf-html`, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
          "apikey": supabaseAnonKey,
        },
        body: JSON.stringify(
          document_type === "devis"
            ? { type: "devis", devis_id: document_id }
            : { type: "facture", facture_id: document_id }
        ),
      });
      if (docRes.ok) {
        const docData = await docRes.json();
        if (docData.html) htmlEmail = buildEmailHtml(body, docData.html);
      }
    } catch (e) {
      console.warn("generate-pdf-html failed:", e);
    }
  }

  let sendStatus = "sent";
  if (sendgridApiKey) {
    const content: Array<{ type: string; value: string }> = [
      { type: "text/plain", value: body },
    ];
    if (htmlEmail) content.push({ type: "text/html", value: htmlEmail });

    const payload: Record<string, unknown> = {
      personalizations: [{ to: [{ email: to_email, name: to_name ?? to_email }] }],
      from: { email: fromEmail, name: `${senderName} via ${fromName}` },
      reply_to: { email: replyTo, name: senderName },
      subject,
      content,
    };

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
      log(serviceClient, { user_id: user.id, action: "email.sent", entity_type: document_type ?? undefined, entity_id: document_id ?? undefined, status: "success", details: { to: to_email, subject } });
    }
  } else {
    sendStatus = "no_sendgrid";
    log(serviceClient, { user_id: user.id, action: "email.no_sendgrid", entity_type: document_type ?? undefined, entity_id: document_id ?? undefined, status: "info", details: { to: to_email, subject } });
  }

  // Store message in DB regardless of send status
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
