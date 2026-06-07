import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

export function fmtMoney(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export interface DevisPdfParams {
  numero: string;
  created_at: string;
  date_validite?: string | null;
  montant_ht: number;
  tva: number;
  docLabel?: string;
  couleur_primaire?: string | null;
  mentions?: string[] | null;
  artisan: { nom: string; prenom: string; raison_sociale?: string | null; siret?: string | null; tva_intracommunautaire?: string | null; adresse?: string | null; telephone?: string | null; email?: string | null };
  client: { nom: string; prenom?: string | null; adresse?: string | null } | null;
  chantier?: { nom?: string | null; adresse_chantier?: string | null } | null;
  lignes: Array<{ designation: string; quantite: number; unite: string; prix_unitaire: number; section_nom?: string | null }>;
}

export type DevisOutcome =
  | { type: "signed"; signatureData: string; bonPourAccord: string }
  | { type: "refused"; reason?: string }
  | { type: "unsigned" };

export async function buildDevisPdf(params: DevisPdfParams, outcome: DevisOutcome): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontNormal = await doc.embedFont(StandardFonts.Helvetica);

  function hexToRgb(hex: string | null | undefined) {
    const m = (hex ?? "").replace("#", "").match(/.{2}/g);
    if (!m || m.length < 3) return rgb(0.145, 0.302, 0.859);
    return rgb(parseInt(m[0], 16) / 255, parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255);
  }
  const BLUE = hexToRgb(params.couleur_primaire);
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

  drawText(params.docLabel ?? "DEVIS", LEFT, y, 22, true, BLUE);
  drawTextRight(`N° ${params.numero}`, RIGHT, y, 13, true);
  y -= 18;
  drawTextRight(`Date : ${fmtDate(params.created_at)}`, RIGHT, y, 9);
  if (params.date_validite) {
    drawText(`Validité : ${fmtDate(params.date_validite)}`, LEFT, y, 9);
  }
  y -= 10;
  drawHLine(y, BLUE, 1.5);
  y -= 16;

  const artisanName = params.artisan.raison_sociale || `${params.artisan.prenom} ${params.artisan.nom}`.trim();
  drawText(artisanName, LEFT, y, 10, true);
  y -= 13;
  if (params.artisan.adresse) { drawText(params.artisan.adresse, LEFT, y, 9); y -= 12; }
  if (params.artisan.siret) { drawText(`SIRET : ${params.artisan.siret}`, LEFT, y, 9); y -= 12; }
  if (params.artisan.tva_intracommunautaire) { drawText(`TVA : ${params.artisan.tva_intracommunautaire}`, LEFT, y, 9); y -= 12; }
  if (params.artisan.telephone) { drawText(`Tél. : ${params.artisan.telephone}`, LEFT, y, 9); y -= 12; }
  if (params.artisan.email) { drawText(params.artisan.email, LEFT, y, 9); y -= 12; }
  y -= 6;
  drawHLine(y);
  y -= 14;

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

  const defaultMentions = [
    "Assurance Décennale souscrite - attestation disponible sur demande.",
    "Règlement à réception de facture. Tout retard entraîne des pénalités de 3x le taux d'intérêt légal.",
    "En cas de retard de paiement, une indemnité forfaitaire de 40 EUR sera appliquée.",
  ];
  const mentionsList = params.mentions?.length ? params.mentions : defaultMentions;
  checkPageBreak(10 + mentionsList.length * 10);
  drawHLine(y, GRAY, 0.3);
  y -= 10;
  for (const m of mentionsList) {
    const line = `* ${m}`;
    drawText(line.length > 100 ? line.substring(0, 99) + "..." : line, LEFT, y, 7, false, rgb(0.5, 0.5, 0.5));
    y -= 10;
  }
  y -= 4;

  if (outcome.type !== "unsigned") {
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
  }

  return doc.save();
}

export async function fetchDevisFullData(
  db: ReturnType<typeof createClient>,
  devisRow: Record<string, unknown>,
  directClientId: string | null,
) {
  const artisanId = devisRow.artisan_id as string;

  const [{ data: artisanProfile }, { data: artisanEmail }, { data: settings }, { data: tpl }] = await Promise.all([
    db.from("profiles").select("nom, prenom, siret, adresse, telephone, raison_sociale, tva_intracommunautaire").eq("user_id", artisanId).single(),
    db.rpc("get_user_email", { p_user_id: artisanId }),
    (db as any).from("artisan_settings").select("preferences").eq("user_id", artisanId).maybeSingle(),
    (db as any).from("document_templates").select("couleur_primaire").eq("artisan_id", artisanId).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const prefs = ((settings as any)?.preferences ?? {}) as Record<string, string>;
  const adresse = prefs.adresse ?? (artisanProfile as any)?.adresse ?? null;

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

  if (!clientData && devisRow.client_id) {
    const { data: cl } = await db.from("clients").select("nom, prenom, adresse").eq("id", devisRow.client_id as string).single();
    clientData = cl as any;
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
      raison_sociale: (artisanProfile as any)?.raison_sociale ?? null,
      siret: (artisanProfile as any)?.siret ?? null,
      tva_intracommunautaire: (artisanProfile as any)?.tva_intracommunautaire ?? null,
      adresse,
      telephone: (artisanProfile as any)?.telephone ?? null,
      email: artisanEmail ?? null,
    },
    couleur_primaire: (tpl as any)?.couleur_primaire ?? null,
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

export async function fetchAvenantFullData(
  db: ReturnType<typeof createClient>,
  avenantRow: Record<string, unknown>,
) {
  const artisanId = avenantRow.artisan_id as string;
  const [{ data: artisanProfile }, { data: artisanEmail }, { data: settings }, { data: tpl }] = await Promise.all([
    db.from("profiles").select("nom, prenom, siret, adresse, telephone, raison_sociale, tva_intracommunautaire").eq("user_id", artisanId).single(),
    db.rpc("get_user_email", { p_user_id: artisanId }),
    (db as any).from("artisan_settings").select("preferences").eq("user_id", artisanId).maybeSingle(),
    (db as any).from("document_templates").select("couleur_primaire").eq("artisan_id", artisanId).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const prefs = ((settings as any)?.preferences ?? {}) as Record<string, string>;
  const adresse = prefs.adresse ?? (artisanProfile as any)?.adresse ?? null;

  let clientData: { nom: string; prenom?: string | null; adresse?: string | null } | null = null;
  let chantierData: { nom?: string | null; adresse_chantier?: string | null } | null = null;

  if (avenantRow.devis_id) {
    const { data: dv } = await db.from("devis").select("client_id, chantier_id").eq("id", avenantRow.devis_id as string).maybeSingle();
    if (dv) {
      if ((dv as any).client_id) {
        const { data: cl } = await db.from("clients").select("nom, prenom, adresse").eq("id", (dv as any).client_id).single();
        clientData = cl as any;
      }
      if ((dv as any).chantier_id) {
        const { data: ch } = await db.from("chantiers").select("nom, adresse_chantier, client_id").eq("id", (dv as any).chantier_id).maybeSingle();
        chantierData = ch as any;
        if (!clientData && (ch as any)?.client_id) {
          const { data: cl } = await db.from("clients").select("nom, prenom, adresse").eq("id", (ch as any).client_id).single();
          clientData = cl as any;
        }
      }
    }
  }

  const { data: lignesData } = await (db as any).from("lignes_avenant")
    .select("designation, quantite, unite, prix_unitaire, section_nom").eq("avenant_id", avenantRow.id as string).order("ordre");

  return {
    artisan: {
      nom: (artisanProfile as any)?.nom ?? "",
      prenom: (artisanProfile as any)?.prenom ?? "",
      raison_sociale: (artisanProfile as any)?.raison_sociale ?? null,
      siret: (artisanProfile as any)?.siret ?? null,
      tva_intracommunautaire: (artisanProfile as any)?.tva_intracommunautaire ?? null,
      adresse,
      telephone: (artisanProfile as any)?.telephone ?? null,
      email: artisanEmail ?? null,
    },
    couleur_primaire: (tpl as any)?.couleur_primaire ?? null,
    client: clientData,
    chantier: chantierData,
    lignes: (lignesData ?? []).length > 0
      ? (lignesData ?? []).map((l: any) => ({ designation: l.designation ?? "", quantite: Number(l.quantite) || 0, unite: l.unite ?? "u", prix_unitaire: Number(l.prix_unitaire) || 0, section_nom: l.section_nom ?? null }))
      : avenantRow.description ? [{ designation: avenantRow.description as string, quantite: 1, unite: "forfait", prix_unitaire: Number(avenantRow.montant_ht) || 0, section_nom: null }] : [],
  };
}

export async function fetchTsFullData(
  db: ReturnType<typeof createClient>,
  tsRow: Record<string, unknown>,
) {
  const artisanId = tsRow.artisan_id as string;
  const [{ data: artisanProfile }, { data: artisanEmail }, { data: settings }, { data: tpl }] = await Promise.all([
    db.from("profiles").select("nom, prenom, siret, adresse, telephone, raison_sociale, tva_intracommunautaire").eq("user_id", artisanId).single(),
    db.rpc("get_user_email", { p_user_id: artisanId }),
    (db as any).from("artisan_settings").select("preferences").eq("user_id", artisanId).maybeSingle(),
    (db as any).from("document_templates").select("couleur_primaire").eq("artisan_id", artisanId).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const prefs = ((settings as any)?.preferences ?? {}) as Record<string, string>;
  const adresse = prefs.adresse ?? (artisanProfile as any)?.adresse ?? null;

  let clientData: { nom: string; prenom?: string | null; adresse?: string | null } | null = null;
  let chantierData: { nom?: string | null; adresse_chantier?: string | null } | null = null;

  if (tsRow.client_id) {
    const { data: cl } = await db.from("clients").select("nom, prenom, adresse").eq("id", tsRow.client_id as string).single();
    clientData = cl as any;
  }
  if (tsRow.chantier_id) {
    const { data: ch } = await db.from("chantiers").select("nom, adresse_chantier, client_id").eq("id", tsRow.chantier_id as string).maybeSingle();
    chantierData = ch as any;
    if (!clientData && (ch as any)?.client_id) {
      const { data: cl } = await db.from("clients").select("nom, prenom, adresse").eq("id", (ch as any).client_id).single();
      clientData = cl as any;
    }
  }
  if (!clientData && tsRow.devis_id) {
    const { data: dv } = await db.from("devis").select("client_id, chantier_id").eq("id", tsRow.devis_id as string).maybeSingle();
    if (dv && (dv as any).client_id) {
      const { data: cl } = await db.from("clients").select("nom, prenom, adresse").eq("id", (dv as any).client_id).single();
      clientData = cl as any;
    }
  }

  const { data: lignesData } = await (db as any).from("lignes_ts")
    .select("designation, quantite, unite, prix_unitaire, section_nom").eq("ts_id", tsRow.id as string).order("ordre");

  return {
    artisan: {
      nom: (artisanProfile as any)?.nom ?? "",
      prenom: (artisanProfile as any)?.prenom ?? "",
      raison_sociale: (artisanProfile as any)?.raison_sociale ?? null,
      siret: (artisanProfile as any)?.siret ?? null,
      tva_intracommunautaire: (artisanProfile as any)?.tva_intracommunautaire ?? null,
      adresse,
      telephone: (artisanProfile as any)?.telephone ?? null,
      email: artisanEmail ?? null,
    },
    couleur_primaire: (tpl as any)?.couleur_primaire ?? null,
    client: clientData,
    chantier: chantierData,
    lignes: (lignesData ?? []).length > 0
      ? (lignesData ?? []).map((l: any) => ({ designation: l.designation ?? "", quantite: Number(l.quantite) || 0, unite: l.unite ?? "u", prix_unitaire: Number(l.prix_unitaire) || 0, section_nom: l.section_nom ?? null }))
      : tsRow.description ? [{ designation: tsRow.description as string, quantite: 1, unite: "forfait", prix_unitaire: Number(tsRow.montant_ht) || 0, section_nom: null }] : [],
  };
}
