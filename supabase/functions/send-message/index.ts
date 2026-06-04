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
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  const fromEmail = Deno.env.get("BREVO_FROM_EMAIL") ?? "noreply@trustbuild.ia";
  const fromName = Deno.env.get("BREVO_FROM_NAME") ?? "TrustBuild-IA";

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { to_email, to_name, subject, body, html_body, document_type, document_id, to_phone, doc_url } = await req.json();

  function normalizePhone(phone: string): string | null {
    const clean = phone.replace(/[\s\-.() ]/g, "");
    if (/^\+\d{8,15}$/.test(clean)) return clean;
    if (/^00\d{9,13}$/.test(clean)) return "+" + clean.slice(2);
    if (/^0\d{9}$/.test(clean)) return "+33" + clean.slice(1);
    if (/^33\d{9}$/.test(clean)) return "+" + clean;
    return null;
  }
  if (!to_email || !subject || !body) {
    return new Response(JSON.stringify({ error: "Champs manquants (to_email, subject, body)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: profile } = await serviceClient.from("profiles").select("prenom, nom, email").eq("user_id", user.id).single();
  const senderName = profile ? `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || fromName : fromName;
  const replyTo = profile?.email ?? user.email ?? fromEmail;

  // Generate PDF for devis and attach it (existing flow — generate-facturx-pdf)
  let pdfBase64: string | null = null;
  let pdfFilename: string | null = null;
  let pdfDocNumero: string | null = null;
  const PDF_TYPES = ["devis", "avenant", "ts"];
  if (document_id && PDF_TYPES.includes(document_type)) {
    try {
      const pdfRes = await fetch(`${supabaseUrl}/functions/v1/generate-facturx-pdf`, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
          "apikey": supabaseAnonKey,
        },
        body: JSON.stringify({ type: document_type, document_id }),
      });
      if (pdfRes.ok) {
        const pdfData = await pdfRes.json();
        if (pdfData.pdf_base64) {
          pdfBase64 = pdfData.pdf_base64;
          pdfDocNumero = pdfData.numero ?? document_id;
          const prefix = document_type === "avenant" ? "Avenant" : document_type === "ts" ? "TS" : "Devis";
          pdfFilename = `${prefix}_${pdfDocNumero}.pdf`;
        }
      }
    } catch (e) {
      console.warn("PDF generation failed:", e);
    }
  }

  if (pdfBase64 && document_id && PDF_TYPES.includes(document_type)) {
    try {
      const tableName = document_type === "ts"
        ? "travaux_supplementaires"
        : document_type === "avenant"
        ? "avenants"
        : "devis";
      const storagePath = `${user.id}/${document_type}-${pdfDocNumero ?? document_id}.pdf`;
      const pdfBytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
      const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });

      const { error: uploadErr } = await serviceClient.storage
        .from("documents-originaux")
        .upload(storagePath, pdfBlob, { contentType: "application/pdf", upsert: true });

      if (uploadErr) {
        console.error("[send-message] Erreur upload PDF original:", uploadErr.message);
      } else {
        await serviceClient.from(tableName)
          .update({ original_pdf_path: storagePath, original_pdf_generated_at: new Date().toISOString() })
          .eq("id", document_id);
        console.log("[send-message] PDF original stocké:", storagePath);
      }
    } catch (e) {
      console.error("[send-message] Erreur stockage PDF original:", e);
    }
  }

  let sendStatus = "sent";
  if (brevoApiKey) {
    const payload: Record<string, unknown> = {
      to: [{ email: to_email, name: to_name ?? to_email }],
      sender: { email: fromEmail, name: `${senderName} via ${fromName}` },
      replyTo: { email: replyTo, name: senderName },
      subject,
      ...(html_body ? { htmlContent: html_body, textContent: body } : { textContent: body }),
      ...(document_id && document_type ? { tags: [`${document_type}:${document_id}`] } : {}),
    };

    if (pdfBase64 && pdfFilename) {
      payload.attachment = [{
        content: pdfBase64,
        name: pdfFilename,
      }];
    }

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoApiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!brevoRes.ok) {
      const errText = await brevoRes.text();
      console.error("Brevo error:", brevoRes.status, errText);
      sendStatus = "error";
      log(serviceClient, { user_id: user.id, action: "email.send_failed", entity_type: document_type ?? undefined, entity_id: document_id ?? undefined, status: "error", details: { to: to_email, subject, brevo_status: brevoRes.status, brevo_error: errText } });
    } else {
      log(serviceClient, { user_id: user.id, action: "email.sent", entity_type: document_type ?? undefined, entity_id: document_id ?? undefined, status: "success", details: { to: to_email, subject, has_pdf: !!pdfBase64 } });
    }
  } else {
    sendStatus = "no_brevo";
    log(serviceClient, { user_id: user.id, action: "email.no_brevo", entity_type: document_type ?? undefined, entity_id: document_id ?? undefined, status: "info", details: { to: to_email, subject } });
  }

  if (to_phone && brevoApiKey && sendStatus === "sent") {
    const phone = normalizePhone(to_phone);
    if (phone) {
      const docLabel = document_type === "facture" ? "une facture"
        : document_type === "avenant" ? "un avenant"
        : document_type === "ts" ? "des travaux supplémentaires"
        : "un devis";
      const smsContent = doc_url
        ? `TrustBuild : Vous avez reçu ${docLabel} de ${senderName}. Consultez-le : ${doc_url}`
        : `TrustBuild : Vous avez reçu ${docLabel} de ${senderName}.`;
      try {
        const smsRes = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
          method: "POST",
          headers: { "api-key": brevoApiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ sender: "TrustBuild", recipient: phone, content: smsContent, type: "transactional" }),
        });
        if (!smsRes.ok) console.warn("SMS Brevo error:", smsRes.status, await smsRes.text());
      } catch (e) {
        console.warn("SMS send failed:", e);
      }
    }
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
