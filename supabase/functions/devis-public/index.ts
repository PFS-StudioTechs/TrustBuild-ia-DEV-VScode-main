import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function notifyArtisan(
  db: ReturnType<typeof createClient>,
  artisanId: string,
  subject: string,
  bodyText: string,
) {
  try {
    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!sendgridApiKey) {
      console.warn("[notifyArtisan] SENDGRID_API_KEY absent");
      return;
    }

    const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") ?? "noreply@trustbuild.ia";
    const fromName = Deno.env.get("SENDGRID_FROM_NAME") ?? "TrustBuild-IA";

    const { data: profile } = await db
      .from("profiles")
      .select("prenom, nom")
      .eq("user_id", artisanId)
      .single();

    const artisanName = `${(profile as any)?.prenom ?? ""} ${(profile as any)?.nom ?? ""}`.trim() || "Artisan";

    const { data: toEmail, error: emailErr } = await db.rpc("get_user_email", { p_user_id: artisanId });
    if (emailErr) {
      console.error("[notifyArtisan] get_user_email erreur:", emailErr.message);
      return;
    }
    if (!toEmail) {
      console.error("[notifyArtisan] email introuvable pour artisan_id:", artisanId);
      return;
    }

    console.log("[notifyArtisan] Envoi →", toEmail, "|", subject);

    const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail, name: artisanName }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [{ type: "text/plain", value: bodyText }],
      }),
    });

    if (!sgRes.ok) {
      const err = await sgRes.text();
      console.error("[notifyArtisan] SendGrid erreur", sgRes.status, err);
    } else {
      console.log("[notifyArtisan] Email envoyé à", toEmail);
    }
  } catch (e) {
    console.error("[notifyArtisan] Exception:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  // ── GET : récupère le devis par token public ──────────────────────────────
  if (req.method === "GET") {
    if (!token) return json({ error: "Token manquant" }, 400);

    const { data: devis, error } = await db
      .from("devis")
      .select("id, numero, statut, montant_ht, tva, date_validite, created_at, artisan_id, client_id, chantier_id")
      .eq("token_public", token)
      .single();

    if (error || !devis) return json({ error: "Devis introuvable" }, 404);

    const { data: profile } = await db
      .from("profiles")
      .select("nom, prenom, siret, email, adresse, code_postal, ville, telephone")
      .eq("user_id", (devis as any).artisan_id)
      .single();

    let client = null;
    const clientId = (devis as any).client_id;
    if (clientId) {
      const { data: cl } = await db
        .from("clients")
        .select("nom, prenom, adresse, email, telephone")
        .eq("id", clientId)
        .single();
      client = cl;
    }

    let chantier = null;
    if ((devis as any).chantier_id) {
      const { data: ch } = await db
        .from("chantiers")
        .select("nom, adresse_chantier, client_id")
        .eq("id", (devis as any).chantier_id)
        .maybeSingle();
      chantier = ch;
      if (!client && ch?.client_id) {
        const { data: cl } = await db
          .from("clients")
          .select("nom, prenom, adresse, email, telephone")
          .eq("id", ch.client_id)
          .single();
        client = cl;
      }
    }

    const { data: lignes } = await db
      .from("lignes_devis")
      .select("id, designation, quantite, unite, prix_unitaire, tva, section_nom, ordre")
      .eq("devis_id", (devis as any).id)
      .order("ordre");

    const { data: annotations } = await db
      .from("devis_annotations")
      .select("id, type, ligne_id, contenu")
      .eq("devis_id", (devis as any).id);

    return json({
      devis,
      artisan: profile ?? {},
      client,
      chantier,
      lignes: lignes ?? [],
      annotations: annotations ?? [],
    });
  }

  // ── POST : actions client (annotate / refuse / sign) ─────────────────────
  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Corps JSON invalide" }, 400);
    }

    const effectiveToken = (body.token as string | undefined) ?? token;
    if (!effectiveToken) return json({ error: "Token manquant" }, 400);

    const { data: devis } = await db
      .from("devis")
      .select("id, statut, artisan_id, numero, client_id")
      .eq("token_public", effectiveToken)
      .single();

    if (!devis) return json({ error: "Devis introuvable" }, 404);

    const devisId = (devis as any).id;
    const artisanId = (devis as any).artisan_id;
    const devisNumero = (devis as any).numero;
    const action = body.action as string;

    let clientNom = "Votre client";
    const clientId = (devis as any).client_id;
    if (clientId) {
      const { data: cl } = await db
        .from("clients")
        .select("nom, prenom")
        .eq("id", clientId)
        .single();
      if (cl) {
        clientNom = `${(cl as any).prenom ?? ""} ${(cl as any).nom ?? ""}`.trim() || "Votre client";
      }
    }

    if (action === "annotate") {
      const annotations = (body.annotations as unknown[]) ?? [];
      await db.from("devis_annotations").delete().eq("devis_id", devisId);
      if (annotations.length > 0) {
        await db.from("devis_annotations").insert(
          annotations.map((a: any) => ({ ...a, devis_id: devisId }))
        );
      }
      await notifyArtisan(
        db,
        artisanId,
        `Devis ${devisNumero} — ${clientNom} a laissé des annotations`,
        `Bonjour,\n\n${clientNom} vient d'annoter le devis ${devisNumero} (${annotations.length} annotation(s)).\n\nConnectez-vous à TrustBuild-IA pour consulter les détails.\n\nCordialement,\nL'équipe TrustBuild-IA`,
      );
      return json({ ok: true });
    }

    if (action === "refuse") {
      await db.from("devis").update({ statut: "refuse" }).eq("id", devisId);
      const comment = body.comment as string | undefined;
      if (comment?.trim()) {
        await db.from("devis_annotations").insert({
          devis_id: devisId,
          type: "refus_comment",
          contenu: comment.trim(),
        });
      }
      const motif = comment?.trim() ? `\n\nMotif : ${comment.trim()}` : "";
      await notifyArtisan(
        db,
        artisanId,
        `Devis ${devisNumero} — ${clientNom} a refusé le devis`,
        `Bonjour,\n\n${clientNom} vient de refuser le devis ${devisNumero}.${motif}\n\nConnectez-vous à TrustBuild-IA pour consulter les détails.\n\nCordialement,\nL'équipe TrustBuild-IA`,
      );
      return json({ ok: true });
    }

    if (action === "sign") {
      const signatureData = body.signature_data as string | undefined;
      if (!signatureData) return json({ error: "Signature manquante" }, 400);
      await db.from("devis_signatures").delete().eq("devis_id", devisId);
      await db.from("devis_signatures").insert({
        devis_id: devisId,
        signature_data: signatureData,
        bon_pour_accord: (body.bon_pour_accord as string) || "Bon pour accord",
        ip_address: req.headers.get("x-forwarded-for") ?? null,
      });
      await db.from("devis").update({ statut: "signe" }).eq("id", devisId);
      await notifyArtisan(
        db,
        artisanId,
        `Devis ${devisNumero} — ${clientNom} a signé le devis ✓`,
        `Bonjour,\n\n${clientNom} vient de signer le devis ${devisNumero} — bon pour accord.\n\nConnectez-vous à TrustBuild-IA pour télécharger le devis signé.\n\nCordialement,\nL'équipe TrustBuild-IA`,
      );
      return json({ ok: true });
    }

    return json({ error: "Action inconnue" }, 400);
  }

  return json({ error: "Méthode non supportée" }, 405);
});
