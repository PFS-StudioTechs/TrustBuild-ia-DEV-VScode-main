import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildDevisPdf, fetchDevisFullData, fetchAvenantFullData, fetchTsFullData } from "../_shared/pdf-builder.ts";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-XSS-Protection": "0",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, ...securityHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ipCallMap = new Map<string, number[]>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - 60_000;
  const calls = (ipCallMap.get(ip) ?? []).filter(t => t > cutoff);
  if (calls.length >= 10) return false;
  calls.push(now);
  ipCallMap.set(ip, calls);
  return true;
}

// ── Sauvegarde message entrant (action client) ────────────────────────────────

async function saveInboundMessage(
  db: ReturnType<typeof createClient>,
  opts: {
    artisanId: string;
    fromClientName: string;
    subject: string;
    body: string;
    documentId: string;
    documentType: string;
    annotationsData?: unknown[] | null;
  },
) {
  try {
    await db.from("messages").insert({
      artisan_id: opts.artisanId,
      to_email: "",
      to_name: opts.fromClientName,
      subject: opts.subject,
      body: opts.body,
      status: "received",
      direction: "inbound",
      from_client_name: opts.fromClientName,
      annotations_data: opts.annotationsData ?? null,
      document_type: opts.documentType,
      document_id: opts.documentId,
      read: false,
    });
  } catch (e) {
    console.error("[saveInboundMessage] Erreur:", e);
  }
}

// ── Notification email artisan ────────────────────────────────────────────────

async function notifyArtisan(
  db: ReturnType<typeof createClient>,
  artisanId: string,
  subject: string,
  bodyText: string,
  attachment?: { content: string; filename: string },
) {
  try {
    console.log("[notifyArtisan] Début — artisanId:", artisanId, "| subject:", subject);
    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!sendgridApiKey) {
      console.warn("[notifyArtisan] SENDGRID_API_KEY absent");
      return;
    }

    const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") ?? "noreply@trustbuild.ia";
    const fromName = Deno.env.get("SENDGRID_FROM_NAME") ?? "TrustBuild-IA";

    const { data: profile } = await db.from("profiles").select("prenom, nom").eq("user_id", artisanId).single();
    const artisanName = `${(profile as any)?.prenom ?? ""} ${(profile as any)?.nom ?? ""}`.trim() || "Artisan";

    const { data: toEmail, error: emailErr } = await db.rpc("get_user_email", { p_user_id: artisanId });
    if (emailErr || !toEmail) {
      console.error("[notifyArtisan] email introuvable:", emailErr?.message);
      return;
    }

    const sgBody: Record<string, unknown> = {
      personalizations: [{ to: [{ email: toEmail, name: artisanName }] }],
      from: { email: fromEmail, name: fromName },
      subject,
      content: [{ type: "text/plain", value: bodyText }],
    };

    if (attachment) {
      sgBody.attachments = [{
        content: attachment.content,
        type: "application/pdf",
        filename: attachment.filename,
        disposition: "attachment",
      }];
    }

    const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { "Authorization": `Bearer ${sendgridApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(sgBody),
    });

    if (!sgRes.ok) {
      console.error("[notifyArtisan] SendGrid erreur", sgRes.status, await sgRes.text());
    } else {
      console.log("[notifyArtisan] Email envoyé à", toEmail);
    }
  } catch (e) {
    console.error("[notifyArtisan] Exception:", e);
  }
}

// ── Serveur ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  // ── GET : récupère le document par token public (devis, avenant ou TS) ──────
  if (req.method === "GET") {
    if (!token || !UUID_RE.test(token)) return json({ error: "Token invalide" }, 400);

    let docType = "devis";
    let doc: Record<string, unknown> | null = null;

    const { data: devisRow } = await db
      .from("devis")
      .select("id, numero, statut, montant_ht, tva, date_validite, created_at, artisan_id, client_id, chantier_id, token_expires_at")
      .eq("token_public", token)
      .maybeSingle();
    if (devisRow) { doc = devisRow as any; docType = "devis"; }

    if (!doc) {
      const { data: avenantRow } = await (db as any)
        .from("avenants")
        .select("id, numero, statut, montant_ht, date, created_at, artisan_id, devis_id, token_expires_at")
        .eq("token_public", token)
        .maybeSingle();
      if (avenantRow) { doc = avenantRow; docType = "avenant"; }
    }

    if (!doc) {
      const { data: tsRow } = await (db as any)
        .from("travaux_supplementaires")
        .select("id, numero, statut, montant_ht, tva, date, date_validite, created_at, artisan_id, client_id, chantier_id, devis_id, token_expires_at")
        .eq("token_public", token)
        .maybeSingle();
      if (tsRow) { doc = tsRow; docType = "ts"; }
    }

    if (!doc) return json({ error: "Document introuvable" }, 404);

    if (doc.token_expires_at && new Date(doc.token_expires_at as string) < new Date()) {
      return json({ error: "Lien expiré", expired: true }, 410);
    }

    const { data: profile } = await db
      .from("profiles")
      .select("nom, prenom, siret, email, adresse, code_postal, ville, telephone")
      .eq("user_id", doc.artisan_id as string)
      .single();

    let client = null;
    let chantier = null;

    if (docType === "devis") {
      if (doc.client_id) {
        const { data: cl } = await db.from("clients").select("nom, prenom, adresse, email, telephone").eq("id", doc.client_id as string).single();
        client = cl;
      }
      if (doc.chantier_id) {
        const { data: ch } = await db.from("chantiers").select("nom, adresse_chantier, client_id").eq("id", doc.chantier_id as string).maybeSingle();
        chantier = ch;
        if (!client && (ch as any)?.client_id) {
          const { data: cl } = await db.from("clients").select("nom, prenom, adresse, email, telephone").eq("id", (ch as any).client_id).single();
          client = cl;
        }
      }
    } else if (docType === "avenant") {
      if (doc.devis_id) {
        const { data: dv } = await db.from("devis").select("client_id, chantier_id").eq("id", doc.devis_id as string).maybeSingle();
        if (dv) {
          if ((dv as any).client_id) {
            const { data: cl } = await db.from("clients").select("nom, prenom, adresse, email, telephone").eq("id", (dv as any).client_id).single();
            client = cl;
          }
          if ((dv as any).chantier_id) {
            const { data: ch } = await db.from("chantiers").select("nom, adresse_chantier, client_id").eq("id", (dv as any).chantier_id).maybeSingle();
            chantier = ch;
            if (!client && (ch as any)?.client_id) {
              const { data: cl } = await db.from("clients").select("nom, prenom, adresse, email, telephone").eq("id", (ch as any).client_id).single();
              client = cl;
            }
          }
        }
      }
    } else {
      if (doc.client_id) {
        const { data: cl } = await db.from("clients").select("nom, prenom, adresse, email, telephone").eq("id", doc.client_id as string).single();
        client = cl;
      }
      if (doc.chantier_id) {
        const { data: ch } = await db.from("chantiers").select("nom, adresse_chantier, client_id").eq("id", doc.chantier_id as string).maybeSingle();
        chantier = ch;
        if (!client && (ch as any)?.client_id) {
          const { data: cl } = await db.from("clients").select("nom, prenom, adresse, email, telephone").eq("id", (ch as any).client_id).single();
          client = cl;
        }
      }
      if (!client && doc.devis_id) {
        const { data: dv } = await db.from("devis").select("client_id").eq("id", doc.devis_id as string).maybeSingle();
        if ((dv as any)?.client_id) {
          const { data: cl } = await db.from("clients").select("nom, prenom, adresse, email, telephone").eq("id", (dv as any).client_id).single();
          client = cl;
        }
      }
    }

    let lignes: unknown[] = [];
    if (docType === "devis") {
      const { data: l } = await db.from("lignes_devis").select("id, designation, quantite, unite, prix_unitaire, tva, section_nom, ordre").eq("devis_id", doc.id as string).order("ordre");
      lignes = l ?? [];
    } else if (docType === "avenant") {
      const { data: l } = await (db as any).from("lignes_avenant").select("id, designation, quantite, unite, prix_unitaire, tva, section_nom, ordre").eq("avenant_id", doc.id as string).order("ordre");
      lignes = l ?? [];
      (doc as any).tva = (lignes as any[])[0]?.tva ?? 20;
    } else {
      const { data: l } = await (db as any).from("lignes_ts").select("id, designation, quantite, unite, prix_unitaire, tva, section_nom, ordre").eq("ts_id", doc.id as string).order("ordre");
      lignes = l ?? [];
    }

    const { data: annotations } = await db
      .from("devis_annotations")
      .select("id, type, ligne_id, contenu")
      .eq("doc_type", docType)
      .eq("doc_id", doc.id as string);

    return json({
      doc,
      doc_type: docType,
      ...(docType === "devis" ? { devis: doc } : {}),
      artisan: profile ?? {}, client, chantier, lignes, annotations: annotations ?? [],
    });
  }

  // ── POST : actions client (annotate / refuse / sign) ─────────────────────
  if (req.method === "POST") {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!checkRateLimit(clientIp)) {
      return json({ error: "Trop de requêtes, réessayez dans une minute" }, 429);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Corps JSON invalide" }, 400);
    }

    const effectiveToken = (body.token as string | undefined) ?? token;
    if (!effectiveToken || !UUID_RE.test(effectiveToken)) return json({ error: "Token invalide" }, 400);

    let postDocType = "devis";
    let doc: Record<string, unknown> | null = null;

    const { data: postDevisRow } = await db
      .from("devis")
      .select("id, statut, artisan_id, numero, client_id, chantier_id, montant_ht, tva, created_at, date_validite, token_expires_at")
      .eq("token_public", effectiveToken)
      .maybeSingle();
    if (postDevisRow) { doc = postDevisRow as any; postDocType = "devis"; }

    if (!doc) {
      const { data: avenantRow } = await (db as any)
        .from("avenants")
        .select("id, statut, artisan_id, numero, devis_id, montant_ht, date, created_at, token_expires_at")
        .eq("token_public", effectiveToken)
        .maybeSingle();
      if (avenantRow) { doc = avenantRow; postDocType = "avenant"; }
    }

    if (!doc) {
      const { data: tsRow } = await (db as any)
        .from("travaux_supplementaires")
        .select("id, statut, artisan_id, numero, client_id, chantier_id, devis_id, montant_ht, tva, date, date_validite, created_at, token_expires_at")
        .eq("token_public", effectiveToken)
        .maybeSingle();
      if (tsRow) { doc = tsRow; postDocType = "ts"; }
    }

    if (!doc) return json({ error: "Document introuvable" }, 404);

    if (doc.token_expires_at && new Date(doc.token_expires_at as string) < new Date()) {
      return json({ error: "Lien expiré", expired: true }, 410);
    }

    const docId = doc.id as string;
    const artisanId = doc.artisan_id as string;
    const docNumero = doc.numero as string;
    const clientId = (doc.client_id as string | undefined) ?? null;
    const action = body.action as string;

    const devis = postDocType === "devis" ? doc : null;
    const devisId = postDocType === "devis" ? docId : "";
    const devisNumero = postDocType === "devis" ? docNumero : "";

    let resolvedClientId: string | null = clientId;
    if (!resolvedClientId && postDocType === "avenant" && doc.devis_id) {
      const { data: dv } = await db.from("devis").select("client_id").eq("id", doc.devis_id as string).maybeSingle();
      resolvedClientId = (dv as any)?.client_id ?? null;
    }

    let clientNom = "Votre client";
    if (resolvedClientId) {
      const { data: cl } = await db.from("clients").select("nom, prenom").eq("id", resolvedClientId).single();
      if (cl) clientNom = `${(cl as any).prenom ?? ""} ${(cl as any).nom ?? ""}`.trim() || "Votre client";
    }

    // ── ANNOTER ──────────────────────────────────────────────────────────────
    if (action === "annotate") {
      const annotations = (body.annotations as unknown[]) ?? [];

      if (annotations.length > 50) return json({ error: "Trop d'annotations (max 50)" }, 400);
      for (const a of annotations as Record<string, unknown>[]) {
        if (typeof a.contenu === "string" && a.contenu.length > 2000)
          return json({ error: "Annotation trop longue (max 2000 caractères)" }, 400);
        if (typeof a.ligne_id === "string" && !UUID_RE.test(a.ligne_id))
          return json({ error: "Format ligne_id invalide" }, 400);
      }

      await db.from("devis_annotations").delete().eq("doc_type", postDocType).eq("doc_id", docId);
      if (annotations.length > 0) {
        await db.from("devis_annotations").insert(annotations.map((a: any) => ({ ...a, doc_type: postDocType, doc_id: docId })));
      }

      const annotationsSummary = annotations
        .map((a: any) => `• ${a.contenu ?? ""}`)
        .filter(Boolean)
        .join("\n");

      await saveInboundMessage(db, {
        artisanId,
        fromClientName: clientNom,
        subject: `${docNumero} — ${clientNom} a laissé des annotations`,
        body: `${annotations.length} annotation(s) sur le document ${docNumero}.\n\n${annotationsSummary}`,
        documentId: docId,
        documentType: postDocType,
        annotationsData: annotations,
      });

      await notifyArtisan(
        db,
        artisanId,
        `${docNumero} — ${clientNom} a laissé des annotations`,
        `Bonjour,\n\n${clientNom} vient d'annoter le document ${docNumero} (${annotations.length} annotation(s)).\n\nConnectez-vous à TrustBuild-IA pour consulter les détails.\n\nCordialement,\nL'équipe TrustBuild-IA`,
      );
      await db.from("app_logs").insert({ user_id: artisanId, action: `${postDocType}.client_annotate`, entity_type: postDocType, entity_id: docId, status: "success", details: { ip: clientIp, client_nom: clientNom, count: annotations.length } });
      return json({ ok: true });
    }

    // ── REFUSER ───────────────────────────────────────────────────────────────
    if (action === "refuse") {
      const comment = body.comment as string | undefined;

      if (typeof comment === "string" && comment.length > 2000)
        return json({ error: "Motif trop long (max 2000 caractères)" }, 400);

      if (postDocType === "devis") {
        await db.from("devis").update({ statut: "refuse" }).eq("id", docId);
      } else if (postDocType === "avenant") {
        await (db as any).from("avenants").update({ statut: "refuse" }).eq("id", docId);
      } else {
        await (db as any).from("travaux_supplementaires").update({ statut: "refuse" }).eq("id", docId);
      }

      if (comment?.trim()) {
        await db.from("devis_annotations").insert({
          doc_type: postDocType,
          doc_id: docId,
          type: "refus_comment",
          contenu: comment.trim(),
        });
      }

      const motif = comment?.trim() ? `\n\nMotif : ${comment.trim()}` : "";
      const docLabelRefus = postDocType === "devis" ? "devis" : postDocType === "avenant" ? "l'avenant" : "les travaux supplémentaires";

      await saveInboundMessage(db, {
        artisanId,
        fromClientName: clientNom,
        subject: `${docNumero} — ${clientNom} a refusé`,
        body: comment?.trim() ? `Motif : ${comment.trim()}` : "Aucun motif précisé.",
        documentId: docId,
        documentType: postDocType,
      });

      let pdfAttachment: { content: string; filename: string } | undefined;
      try {
        const docLabel = postDocType === "devis" ? "DEVIS" : postDocType === "avenant" ? "AVENANT" : "TRAVAUX SUPPLÉMENTAIRES";
        let fullData;
        if (postDocType === "devis") {
          fullData = await fetchDevisFullData(db, doc, resolvedClientId);
        } else if (postDocType === "avenant") {
          fullData = await fetchAvenantFullData(db, doc);
        } else {
          fullData = await fetchTsFullData(db, doc);
        }
        const pdfBytes = await buildDevisPdf(
          {
            numero: docNumero,
            created_at: doc.created_at as string,
            date_validite: (doc.date_validite ?? doc.date) as string | null,
            montant_ht: Number(doc.montant_ht),
            tva: Number(doc.tva),
            docLabel,
            ...fullData,
          },
          { type: "refused", reason: comment },
        );
        pdfAttachment = {
          content: btoa(Array.from(pdfBytes, (b) => String.fromCharCode(b)).join("")),
          filename: `${postDocType}-${docNumero}-refuse.pdf`,
        };
        console.log("[refuse] PDF refusé généré, taille:", pdfBytes.byteLength, "bytes");
      } catch (e) {
        console.error("[refuse] Erreur génération PDF:", e);
      }

      await notifyArtisan(
        db,
        artisanId,
        `${docNumero} — ${clientNom} a refusé`,
        `Bonjour,\n\n${clientNom} vient de refuser ${docLabelRefus} ${docNumero}.${motif}\n\nLe document est joint à ce message en pièce jointe PDF.\n\nCordialement,\nL'équipe TrustBuild-IA`,
        pdfAttachment,
      );
      await db.from("app_logs").insert({ user_id: artisanId, action: `${postDocType}.client_refuse`, entity_type: postDocType, entity_id: docId, status: "success", details: { ip: clientIp, client_nom: clientNom } });
      return json({ ok: true });
    }

    // ── SIGNER ────────────────────────────────────────────────────────────────
    if (action === "sign") {
      const signatureData = body.signature_data as string | undefined;
      if (!signatureData) return json({ error: "Signature manquante" }, 400);
      if (signatureData.length > 2_000_000) return json({ error: "Signature trop volumineuse (max 1.5 Mo)" }, 400);

      const bonPourAccord = (body.bon_pour_accord as string) || "Bon pour accord";

      await db.from("devis_signatures").delete().eq("doc_type", postDocType).eq("doc_id", docId);
      await db.from("devis_signatures").insert({
        doc_type: postDocType,
        doc_id: docId,
        signature_data: signatureData,
        bon_pour_accord: bonPourAccord,
        ip_address: req.headers.get("x-forwarded-for") ?? null,
      });

      if (postDocType === "devis") {
        await db.from("devis").update({ statut: "signe" }).eq("id", docId);
      } else if (postDocType === "avenant") {
        await (db as any).from("avenants").update({ statut: "signe" }).eq("id", docId);
      } else {
        await (db as any).from("travaux_supplementaires").update({ statut: "signe" }).eq("id", docId);
      }

      let pdfAttachment: { content: string; filename: string } | undefined;

      try {
        const originalTable = postDocType === "ts"
          ? "travaux_supplementaires"
          : postDocType === "avenant"
          ? "avenants"
          : "devis";
        const { data: originalDoc } = await db
          .from(originalTable)
          .select("original_pdf_path")
          .eq("id", docId)
          .single();
        const originalPdfPath = (originalDoc as any)?.original_pdf_path as string | null;

        if (originalPdfPath) {
          const { data: pdfData, error: downloadErr } = await db.storage
            .from("documents-originaux")
            .download(originalPdfPath);

          if (!downloadErr && pdfData) {
            const originalBytes = new Uint8Array(await (pdfData as Blob).arrayBuffer());
            const pdfDoc = await PDFDocument.load(originalBytes);
            const page = pdfDoc.addPage([595.28, 841.89]);
            const { width, height } = page.getSize();
            const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

            const blue = rgb(0.11, 0.35, 0.63);
            const grey = rgb(0.5, 0.5, 0.5);
            const black = rgb(0, 0, 0);

            let y = height - 60;

            page.drawText("SIGNATURE CLIENT — BON POUR ACCORD", {
              x: 50,
              y,
              size: 16,
              font,
              color: blue,
            });
            y -= 20;

            page.drawLine({
              start: { x: 50, y },
              end: { x: width - 50, y },
              thickness: 1,
              color: blue,
            });
            y -= 30;

            page.drawText(bonPourAccord, {
              x: 50,
              y,
              size: 12,
              font,
              color: black,
            });
            y -= 40;

            const pngBase64 = (signatureData as string).replace(/^data:image\/png;base64,/, "");
            const pngBytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
            const pngImage = await pdfDoc.embedPng(pngBytes);
            const maxW = 200;
            const maxH = 100;
            const scale = Math.min(maxW / pngImage.width, maxH / pngImage.height, 1);
            const imgW = pngImage.width * scale;
            const imgH = pngImage.height * scale;
            page.drawImage(pngImage, { x: 50, y: y - imgH, width: imgW, height: imgH });
            y -= imgH + 20;

            const signDate = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
            page.drawText(`Signé le ${signDate}`, {
              x: 50,
              y,
              size: 11,
              font: fontRegular,
              color: black,
            });

            page.drawText(`IP : ${clientIp} — ${new Date().toISOString()}`, {
              x: 50,
              y: 30,
              size: 7.5,
              font: fontRegular,
              color: grey,
            });

            const signedBytes = await pdfDoc.save();
            const b64 = btoa(Array.from(signedBytes, (b) => String.fromCharCode(b)).join(""));
            pdfAttachment = { content: b64, filename: `${postDocType}-${docNumero}-signe.pdf` };
            console.log("[sign] PDF signé via overlay pdf-lib, taille:", signedBytes.byteLength, "bytes");
          } else {
            console.warn(`[sign] Échec téléchargement PDF original (${originalPdfPath}):`, downloadErr?.message);
          }
        } else {
          console.warn(`[sign] PDF original non disponible pour ${postDocType} ${docId} — fallback generate-facturx-pdf`);
        }
      } catch (e) {
        console.error("[sign] Erreur overlay pdf-lib:", e);
      }

      // LEGACY FALLBACK — documents antérieurs à la phase 2
      // À supprimer après migration complète
      if (!pdfAttachment) {
        try {
          const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
          const pdfRes = await fetch(`${supabaseUrl}/functions/v1/generate-facturx-pdf`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
              "apikey": anonKey,
            },
            body: JSON.stringify({
              type: postDocType,
              document_id: docId,
              artisan_id: artisanId,
              signature_data: signatureData,
              bon_pour_accord: bonPourAccord,
            }),
          });
          if (pdfRes.ok) {
            const { pdf_base64 } = await pdfRes.json();
            pdfAttachment = { content: pdf_base64, filename: `${postDocType}-${docNumero}-signe.pdf` };
            console.log("[sign] PDF signé généré via generate-facturx-pdf");
          } else {
            console.error("[sign] generate-facturx-pdf erreur:", pdfRes.status, await pdfRes.text());
          }
        } catch (e) {
          console.error("[sign] Erreur generate-facturx-pdf:", e);
        }
      }

      // LEGACY FALLBACK — documents antérieurs à la phase 2
      // À supprimer après migration complète
      if (!pdfAttachment) {
        try {
          const docLabel = postDocType === "devis" ? "DEVIS" : postDocType === "avenant" ? "AVENANT" : "TRAVAUX SUPPLÉMENTAIRES";
          let fullData;
          if (postDocType === "devis") {
            fullData = await fetchDevisFullData(db, doc, resolvedClientId);
          } else if (postDocType === "avenant") {
            fullData = await fetchAvenantFullData(db, doc);
          } else {
            fullData = await fetchTsFullData(db, doc);
          }
          const pdfBytes = await buildDevisPdf(
            {
              numero: docNumero,
              created_at: doc.created_at as string,
              date_validite: (doc.date_validite ?? doc.date) as string | null,
              montant_ht: Number(doc.montant_ht),
              tva: Number(doc.tva) || 20,
              docLabel,
              ...fullData,
            },
            { type: "signed", signatureData, bonPourAccord },
          );
          const b64 = btoa(Array.from(pdfBytes, (b) => String.fromCharCode(b)).join(""));
          pdfAttachment = { content: b64, filename: `${postDocType}-${docNumero}-signe.pdf` };
          console.log("[sign] PDF signé généré via fallback local, taille:", pdfBytes.byteLength, "bytes");
        } catch (e) {
          console.error("[sign] Erreur fallback PDF local:", e);
        }
      }

      if (pdfAttachment) {
        try {
          const pdfPath = `${artisanId}/${postDocType}-${docNumero}-signe.pdf`;
          const pdfBytes = Uint8Array.from(atob(pdfAttachment.content), (c) => c.charCodeAt(0));
          const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
          const { error: uploadErr } = await db.storage
            .from("documents-signes")
            .upload(pdfPath, pdfBlob, { contentType: "application/pdf", upsert: true });
          if (uploadErr) {
            console.error("[sign] Storage upload erreur:", uploadErr.message);
          } else {
            await db.from("devis_signatures")
              .update({ pdf_signed_path: pdfPath })
              .eq("doc_type", postDocType)
              .eq("doc_id", docId);
            console.log("[sign] PDF signé uploadé dans Storage:", pdfPath);
          }
        } catch (e) {
          console.error("[sign] Erreur upload Storage:", e);
        }
      }

      const pdfNote = pdfAttachment
        ? "Le document signé est joint à ce message en pièce jointe PDF."
        : "Connectez-vous à TrustBuild-IA pour télécharger le document signé.";
      await notifyArtisan(
        db,
        artisanId,
        `${docNumero} — ${clientNom} a signé ✓`,
        `Bonjour,\n\n${clientNom} vient de signer le document ${docNumero} — bon pour accord.\n\n${pdfNote}\n\nCordialement,\nL'équipe TrustBuild-IA`,
        pdfAttachment,
      );
      await db.from("app_logs").insert({ user_id: artisanId, action: `${postDocType}.client_sign`, entity_type: postDocType, entity_id: docId, status: "success", details: { ip: clientIp, client_nom: clientNom } });
      await saveInboundMessage(db, {
        artisanId,
        fromClientName: clientNom,
        subject: `${docNumero} — ${clientNom} a signé ✓`,
        body: pdfAttachment
          ? `${clientNom} vient de signer le document ${docNumero} — bon pour accord.\n\nLe document signé est joint en pièce jointe PDF.`
          : `${clientNom} vient de signer le document ${docNumero} — bon pour accord.`,
        documentId: docId,
        documentType: postDocType,
      });
      return json({ ok: true });
    }

    return json({ error: "Action inconnue" }, 400);
  }

  return json({ error: "Méthode non supportée" }, 405);

  } catch (e) {
    console.error("[devis-public] Erreur non gérée:", e);
    return new Response(JSON.stringify({ error: "Erreur serveur interne" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
