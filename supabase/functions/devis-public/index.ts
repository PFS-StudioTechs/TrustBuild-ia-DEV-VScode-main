import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fmtMoney(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface DevisPdfParams {
  numero: string;
  created_at: string;
  date_validite?: string | null;
  montant_ht: number;
  tva: number;
  artisan: { nom: string; prenom: string; siret?: string | null; adresse?: string | null; telephone?: string | null; email?: string | null };
  client: { nom: string; prenom?: string | null; adresse?: string | null } | null;
  chantier?: { nom?: string | null; adresse_chantier?: string | null } | null;
  lignes: Array<{ designation: string; quantite: number; unite: string; prix_unitaire: number; section_nom?: string | null }>;
}

type DevisOutcome =
  | { type: "signed"; signatureData: string; bonPourAccord: string }
  | { type: "refused"; reason?: string };

// ── Génération PDF unifié ─────────────────────────────────────────────────────

async function buildDevisPdf(params: DevisPdfParams, outcome: DevisOutcome): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontNormal = await doc.embedFont(StandardFonts.Helvetica);

  const BLUE = rgb(0.145, 0.302, 0.859);
  const RED = rgb(0.8, 0.1, 0.1);
  const GRAY = rgb(0.8, 0.8, 0.8);
  const WHITE = rgb(1, 1, 1);
  const BLACK = rgb(0.15, 0.15, 0.15);
  const LIGHT_GRAY = rgb(0.94, 0.94, 0.94);

  const PAGE_W = 595;
  const PAGE_H = 842;
  const LEFT = 40;
  const RIGHT = PAGE_W - 40;
  const COL_W = RIGHT - LEFT;
  const BOTTOM_MARGIN = 80;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 45;

  function newPage() {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - 45;
  }

  function checkPageBreak(needed = 20) {
    if (y < BOTTOM_MARGIN + needed) newPage();
  }

  function drawText(text: string, x: number, yPos: number, size: number, bold = false, color = BLACK) {
    page.drawText(text, { x, y: yPos, size, font: bold ? fontBold : fontNormal, color });
  }

  function drawTextRight(text: string, rightEdge: number, yPos: number, size: number, bold = false, color = BLACK) {
    const w = (bold ? fontBold : fontNormal).widthOfTextAtSize(text, size);
    page.drawText(text, { x: rightEdge - w, y: yPos, size, font: bold ? fontBold : fontNormal, color });
  }

  function drawHLine(yPos: number, color = GRAY, thickness = 0.5) {
    page.drawLine({ start: { x: LEFT, y: yPos }, end: { x: RIGHT, y: yPos }, thickness, color });
  }

  // ── EN-TÊTE ──
  drawText("DEVIS", LEFT, y, 22, true, BLUE);
  drawTextRight(`N° ${params.numero}`, RIGHT, y, 13, true);
  y -= 18;
  drawTextRight(`Date : ${fmtDate(params.created_at)}`, RIGHT, y, 9);
  if (params.date_validite) {
    drawText(`Validité : ${fmtDate(params.date_validite)}`, LEFT, y, 9);
  }
  y -= 10;
  drawHLine(y, BLUE, 1.5);
  y -= 16;

  // ── ARTISAN ──
  const artisanName = `${params.artisan.prenom} ${params.artisan.nom}`.trim();
  drawText(artisanName, LEFT, y, 10, true);
  y -= 13;
  if (params.artisan.adresse) { drawText(params.artisan.adresse, LEFT, y, 9); y -= 12; }
  if (params.artisan.siret) { drawText(`SIRET : ${params.artisan.siret}`, LEFT, y, 9); y -= 12; }
  if (params.artisan.telephone) { drawText(`Tél. : ${params.artisan.telephone}`, LEFT, y, 9); y -= 12; }
  if (params.artisan.email) { drawText(params.artisan.email, LEFT, y, 9); y -= 12; }
  y -= 6;
  drawHLine(y);
  y -= 14;

  // ── CLIENT + CHANTIER ──
  if (params.client) {
    const clientName = `${params.client.prenom ?? ""} ${params.client.nom}`.trim();
    drawText("CLIENT :", LEFT, y, 9, true);
    y -= 12;
    drawText(clientName, LEFT, y, 9);
    y -= 12;
    if (params.client.adresse) { drawText(params.client.adresse, LEFT, y, 9); y -= 12; }
    y -= 4;
  }
  if (params.chantier?.nom) {
    drawText(`Chantier : ${params.chantier.nom}`, LEFT, y, 9);
    y -= 12;
    if (params.chantier.adresse_chantier) { drawText(params.chantier.adresse_chantier, LEFT, y, 9); y -= 12; }
    y -= 4;
  }
  drawHLine(y);
  y -= 14;

  // ── TABLEAU PRESTATIONS ──
  const COL_QTY = LEFT + COL_W * 0.62;
  const COL_PU = LEFT + COL_W * 0.75;
  const ROW_H = 14;

  page.drawRectangle({ x: LEFT, y: y - 4, width: COL_W, height: ROW_H, color: BLUE });
  drawText("Désignation", LEFT + 4, y, 8, true, WHITE);
  drawText("Qté / Unité", COL_QTY, y, 8, true, WHITE);
  drawText("P.U. HT", COL_PU, y, 8, true, WHITE);
  drawTextRight("Total HT", RIGHT, y, 8, true, WHITE);
  y -= ROW_H + 4;

  let currentSection: string | null = null;
  let rowIdx = 0;

  for (const ligne of params.lignes) {
    checkPageBreak(ROW_H + 4);

    if (ligne.section_nom && ligne.section_nom !== currentSection) {
      currentSection = ligne.section_nom;
      checkPageBreak(ROW_H + 4);
      page.drawRectangle({ x: LEFT, y: y - 3, width: COL_W, height: ROW_H, color: LIGHT_GRAY });
      drawText(ligne.section_nom.toUpperCase(), LEFT + 6, y, 8, true, BLUE);
      y -= ROW_H + 2;
      rowIdx = 0;
    }

    checkPageBreak(ROW_H + 2);
    if (rowIdx % 2 === 1) {
      page.drawRectangle({ x: LEFT, y: y - 3, width: COL_W, height: ROW_H, color: rgb(0.97, 0.97, 0.97) });
    }

    const label = ligne.designation.length > 48 ? ligne.designation.substring(0, 47) + "…" : ligne.designation;
    const total = ligne.quantite * ligne.prix_unitaire;

    drawText(label, LEFT + 4, y, 8);
    drawText(`${ligne.quantite} ${ligne.unite}`, COL_QTY, y, 8);
    drawText(fmtMoney(ligne.prix_unitaire), COL_PU, y, 8);
    drawTextRight(fmtMoney(total), RIGHT, y, 8);

    y -= ROW_H;
    drawHLine(y, rgb(0.9, 0.9, 0.9), 0.3);
    y -= 2;
    rowIdx++;
  }

  // ── TOTAUX ──
  checkPageBreak(60);
  y -= 8;
  drawHLine(y);
  y -= 14;

  const TVA_AMOUNT = params.montant_ht * params.tva / 100;
  const TTC = params.montant_ht * (1 + params.tva / 100);
  const TOTALS_LEFT = LEFT + COL_W * 0.55;

  drawText("Montant HT :", TOTALS_LEFT, y, 9);
  drawTextRight(fmtMoney(params.montant_ht), RIGHT, y, 9);
  y -= 13;
  drawText(`TVA (${params.tva} %) :`, TOTALS_LEFT, y, 9);
  drawTextRight(fmtMoney(TVA_AMOUNT), RIGHT, y, 9);
  y -= 4;
  page.drawRectangle({ x: TOTALS_LEFT - 4, y: y - 5, width: RIGHT - TOTALS_LEFT + 4, height: 18, color: BLUE });
  drawText("Total TTC :", TOTALS_LEFT, y, 9, true, WHITE);
  drawTextRight(fmtMoney(TTC), RIGHT, y, 9, true, WHITE);
  y -= 28;

  // ── SECTION RÉSULTAT (signature ou refus) ──
  checkPageBreak(120);
  y -= 10;

  if (outcome.type === "signed") {
    drawHLine(y, BLUE, 1.5);
    y -= 18;
    drawText("SIGNATURE CLIENT — BON POUR ACCORD", LEFT, y, 11, true, BLUE);
    y -= 16;
    drawText(outcome.bonPourAccord, LEFT, y, 10);
    y -= 22;

    try {
      const isJpeg = outcome.signatureData.startsWith("data:image/jpeg");
      const b64 = outcome.signatureData.replace(/^data:image\/(png|jpeg);base64,/, "");
      const sigBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const sigImage = isJpeg ? await doc.embedJpg(sigBytes) : await doc.embedPng(sigBytes);
      const maxW = 200;
      const maxH = 80;
      const scale = Math.min(maxW / sigImage.width, maxH / sigImage.height, 1);
      const sigW = sigImage.width * scale;
      const sigH = sigImage.height * scale;
      checkPageBreak(sigH + 10);
      page.drawImage(sigImage, { x: LEFT, y: y - sigH, width: sigW, height: sigH });
      y -= sigH + 10;
    } catch {
      drawText("[Image de signature non disponible]", LEFT, y, 8, false, GRAY);
      y -= 14;
    }

    drawText(`Signé le ${fmtDate(new Date().toISOString())}`, LEFT, y, 8, false, rgb(0.5, 0.5, 0.5));

  } else if (outcome.type === "refused") {
    drawHLine(y, RED, 1.5);
    y -= 18;
    drawText("DEVIS REFUSÉ", LEFT, y, 13, true, RED);
    y -= 16;
    drawText(`Date de refus : ${fmtDate(new Date().toISOString())}`, LEFT, y, 9);
    y -= 14;
    if (outcome.reason?.trim()) {
      drawText("Motif :", LEFT, y, 9, true);
      y -= 13;
      const motifLines = outcome.reason.trim().length > 80
        ? [outcome.reason.trim().substring(0, 80), outcome.reason.trim().substring(80)]
        : [outcome.reason.trim()];
      for (const line of motifLines) {
        drawText(line, LEFT + 6, y, 9);
        y -= 13;
      }
    } else {
      drawText("Aucun motif précisé.", LEFT, y, 9, false, rgb(0.5, 0.5, 0.5));
    }
  }

  return doc.save();
}

// ── Récupération données complètes du devis ───────────────────────────────────

async function fetchDevisFullData(
  db: ReturnType<typeof createClient>,
  devisRow: Record<string, unknown>,
  directClientId: string | null,
) {
  const artisanId = devisRow.artisan_id as string;

  const [{ data: artisanProfile }, { data: artisanEmail }] = await Promise.all([
    db.from("profiles").select("nom, prenom, siret, adresse, telephone").eq("user_id", artisanId).single(),
    db.rpc("get_user_email", { p_user_id: artisanId }),
  ]);

  let clientData: { nom: string; prenom?: string | null; adresse?: string | null } | null = null;
  let chantierData: { nom?: string | null; adresse_chantier?: string | null } | null = null;

  if (directClientId) {
    const { data: cl } = await db.from("clients").select("nom, prenom, adresse").eq("id", directClientId).single();
    clientData = cl as any;
  }

  if (devisRow.chantier_id) {
    const { data: ch } = await db.from("chantiers").select("nom, adresse_chantier, client_id").eq("id", devisRow.chantier_id as string).maybeSingle();
    chantierData = ch as any;
    if (!clientData && (ch as any)?.client_id) {
      const { data: cl } = await db.from("clients").select("nom, prenom, adresse").eq("id", (ch as any).client_id).single();
      clientData = cl as any;
    }
  }

  const { data: lignesData } = await db
    .from("lignes_devis")
    .select("designation, quantite, unite, prix_unitaire, section_nom")
    .eq("devis_id", devisRow.id as string)
    .order("ordre");

  return {
    artisan: {
      nom: (artisanProfile as any)?.nom ?? "",
      prenom: (artisanProfile as any)?.prenom ?? "",
      siret: (artisanProfile as any)?.siret ?? null,
      adresse: (artisanProfile as any)?.adresse ?? null,
      telephone: (artisanProfile as any)?.telephone ?? null,
      email: artisanEmail ?? null,
    },
    client: clientData,
    chantier: chantierData,
    lignes: (lignesData ?? []).map((l: any) => ({
      designation: l.designation ?? "",
      quantite: Number(l.quantite) || 0,
      unite: l.unite ?? "u",
      prix_unitaire: Number(l.prix_unitaire) || 0,
      section_nom: l.section_nom ?? null,
    })),
  };
}

// ── Sauvegarde message entrant (action client) ────────────────────────────────

async function saveInboundMessage(
  db: ReturnType<typeof createClient>,
  opts: {
    artisanId: string;
    fromClientName: string;
    subject: string;
    body: string;
    devisId: string;
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
      document_type: "devis",
      document_id: opts.devisId,
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

  // ── GET : récupère le devis par token public ──────────────────────────────
  if (req.method === "GET") {
    if (!token || !UUID_RE.test(token)) return json({ error: "Token invalide" }, 400);

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
      const { data: cl } = await db.from("clients").select("nom, prenom, adresse, email, telephone").eq("id", clientId).single();
      client = cl;
    }

    let chantier = null;
    if ((devis as any).chantier_id) {
      const { data: ch } = await db.from("chantiers").select("nom, adresse_chantier, client_id").eq("id", (devis as any).chantier_id).maybeSingle();
      chantier = ch;
      if (!client && ch?.client_id) {
        const { data: cl } = await db.from("clients").select("nom, prenom, adresse, email, telephone").eq("id", ch.client_id).single();
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

    return json({ devis, artisan: profile ?? {}, client, chantier, lignes: lignes ?? [], annotations: annotations ?? [] });
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
    if (!effectiveToken || !UUID_RE.test(effectiveToken)) return json({ error: "Token invalide" }, 400);

    const { data: devis } = await db
      .from("devis")
      .select("id, statut, artisan_id, numero, client_id, chantier_id, montant_ht, tva, created_at, date_validite")
      .eq("token_public", effectiveToken)
      .single();

    if (!devis) return json({ error: "Devis introuvable" }, 404);

    const devisId = (devis as any).id;
    const artisanId = (devis as any).artisan_id;
    const devisNumero = (devis as any).numero;
    const clientId = (devis as any).client_id;
    const action = body.action as string;

    let clientNom = "Votre client";
    if (clientId) {
      const { data: cl } = await db.from("clients").select("nom, prenom").eq("id", clientId).single();
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

      await db.from("devis_annotations").delete().eq("devis_id", devisId);
      if (annotations.length > 0) {
        await db.from("devis_annotations").insert(annotations.map((a: any) => ({ ...a, devis_id: devisId })));
      }

      const annotationsSummary = annotations
        .map((a: any) => `• ${a.contenu ?? ""}`)
        .filter(Boolean)
        .join("\n");

      await saveInboundMessage(db, {
        artisanId,
        fromClientName: clientNom,
        subject: `Devis ${devisNumero} — ${clientNom} a laissé des annotations`,
        body: `${annotations.length} annotation(s) sur le devis ${devisNumero}.\n\n${annotationsSummary}`,
        devisId,
        annotationsData: annotations,
      });

      await notifyArtisan(
        db,
        artisanId,
        `Devis ${devisNumero} — ${clientNom} a laissé des annotations`,
        `Bonjour,\n\n${clientNom} vient d'annoter le devis ${devisNumero} (${annotations.length} annotation(s)).\n\nConnectez-vous à TrustBuild-IA pour consulter les détails et modifier le devis.\n\nCordialement,\nL'équipe TrustBuild-IA`,
      );
      return json({ ok: true });
    }

    // ── REFUSER ───────────────────────────────────────────────────────────────
    if (action === "refuse") {
      const comment = body.comment as string | undefined;

      if (typeof comment === "string" && comment.length > 2000)
        return json({ error: "Motif trop long (max 2000 caractères)" }, 400);

      await db.from("devis").update({ statut: "refuse" }).eq("id", devisId);

      if (comment?.trim()) {
        await db.from("devis_annotations").insert({
          devis_id: devisId,
          type: "refus_comment",
          contenu: comment.trim(),
        });
      }

      const motif = comment?.trim() ? `\n\nMotif : ${comment.trim()}` : "";

      await saveInboundMessage(db, {
        artisanId,
        fromClientName: clientNom,
        subject: `Devis ${devisNumero} — ${clientNom} a refusé le devis`,
        body: comment?.trim() ? `Motif : ${comment.trim()}` : "Aucun motif précisé.",
        devisId,
      });

      let pdfAttachment: { content: string; filename: string } | undefined;
      try {
        const fullData = await fetchDevisFullData(db, devis as any, clientId);
        const pdfBytes = await buildDevisPdf(
          {
            numero: devisNumero,
            created_at: (devis as any).created_at,
            date_validite: (devis as any).date_validite,
            montant_ht: Number((devis as any).montant_ht),
            tva: Number((devis as any).tva),
            ...fullData,
          },
          { type: "refused", reason: comment },
        );
        pdfAttachment = {
          content: btoa(Array.from(pdfBytes, (b) => String.fromCharCode(b)).join("")),
          filename: `devis-${devisNumero}-refuse.pdf`,
        };
        console.log("[refuse] PDF refusé généré, taille:", pdfBytes.byteLength, "bytes");
      } catch (e) {
        console.error("[refuse] Erreur génération PDF:", e);
      }

      await notifyArtisan(
        db,
        artisanId,
        `Devis ${devisNumero} — ${clientNom} a refusé le devis`,
        `Bonjour,\n\n${clientNom} vient de refuser le devis ${devisNumero}.${motif}\n\nLe devis est joint à ce message en pièce jointe PDF.\n\nCordialement,\nL'équipe TrustBuild-IA`,
        pdfAttachment,
      );
      return json({ ok: true });
    }

    // ── SIGNER ────────────────────────────────────────────────────────────────
    if (action === "sign") {
      const signatureData = body.signature_data as string | undefined;
      if (!signatureData) return json({ error: "Signature manquante" }, 400);
      if (signatureData.length > 2_000_000) return json({ error: "Signature trop volumineuse (max 1.5 Mo)" }, 400);

      const bonPourAccord = (body.bon_pour_accord as string) || "Bon pour accord";

      await db.from("devis_signatures").delete().eq("devis_id", devisId);
      await db.from("devis_signatures").insert({
        devis_id: devisId,
        signature_data: signatureData,
        bon_pour_accord: bonPourAccord,
        ip_address: req.headers.get("x-forwarded-for") ?? null,
      });
      await db.from("devis").update({ statut: "signe" }).eq("id", devisId);

      let pdfAttachment: { content: string; filename: string } | undefined;
      try {
        const fullData = await fetchDevisFullData(db, devis as any, clientId);
        const pdfBytes = await buildDevisPdf(
          {
            numero: devisNumero,
            created_at: (devis as any).created_at,
            date_validite: (devis as any).date_validite,
            montant_ht: Number((devis as any).montant_ht),
            tva: Number((devis as any).tva),
            ...fullData,
          },
          { type: "signed", signatureData, bonPourAccord },
        );
        pdfAttachment = {
          content: btoa(Array.from(pdfBytes, (b) => String.fromCharCode(b)).join("")),
          filename: `devis-${devisNumero}-signe.pdf`,
        };
        console.log("[sign] PDF signé généré, taille:", pdfBytes.byteLength, "bytes");
      } catch (e) {
        console.error("[sign] Erreur génération PDF:", e);
      }

      await notifyArtisan(
        db,
        artisanId,
        `Devis ${devisNumero} — ${clientNom} a signé le devis ✓`,
        `Bonjour,\n\n${clientNom} vient de signer le devis ${devisNumero} — bon pour accord.\n\nLe devis signé est joint à ce message en pièce jointe PDF.\n\nCordialement,\nL'équipe TrustBuild-IA`,
        pdfAttachment,
      );
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
