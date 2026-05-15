import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, AFRelationship } from "https://esm.sh/pdf-lib@1.17.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function numFx(n: number): string {
  return n.toFixed(2);
}

function dateToYYYYMMDD(d: string): string {
  const dt = new Date(d);
  return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtMoney(n: number): string {
  return n.toFixed(2).replace(".", ",") + " EUR";
}

function buildFacturxXml(p: {
  numero: string;
  date: string;
  sellerName: string;
  buyerName: string;
  montantHt: number;
  tva: number;
  totalTtc: number;
  duePayable: number;
}): string {
  const tvaAmt = p.montantHt * p.tva / 100;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:BusinessProcessSpecifiedDocumentContextParameter>
      <ram:ID>A1</ram:ID>
    </ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:minimum</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${xmlEscape(p.numero)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${dateToYYYYMMDD(p.date)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${xmlEscape(p.sellerName)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${xmlEscape(p.buyerName)}</ram:Name>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${numFx(tvaAmt)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${numFx(p.montantHt)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${numFx(p.tva)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:TaxBasisTotalAmount>${numFx(p.montantHt)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${numFx(tvaAmt)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${numFx(p.totalTtc)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${numFx(p.duePayable)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const db = createClient(supabaseUrl, serviceKey);
    const { facture_id } = await req.json();

    if (!facture_id) {
      return new Response(JSON.stringify({ error: "facture_id requis" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: facture, error: fErr } = await db.from("factures")
      .select("*")
      .eq("id", facture_id)
      .eq("artisan_id", user.id)
      .single();
    if (fErr || !facture) {
      return new Response(JSON.stringify({ error: "Facture introuvable" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const [profileRes, settingsRes] = await Promise.all([
      db.from("profiles").select("nom, prenom, siret").eq("user_id", user.id).single(),
      db.from("artisan_settings").select("preferences").eq("user_id", user.id).single(),
    ]);
    const profile = profileRes.data;
    const prefs = (settingsRes.data?.preferences ?? {}) as Record<string, string>;
    const sellerName = profile
      ? `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || "Artisan"
      : "Artisan";
    const artisanSiret = profile?.siret ?? null;
    const artisanAdresse = prefs.adresse ?? null;
    const artisanTel = prefs.telephone ?? null;

    let buyerName = "Client";
    const devisId = (facture as any).devis_id;
    if (devisId) {
      const { data: devis } = await db.from("devis")
        .select("chantier_id, client_id")
        .eq("id", devisId)
        .single();
      if (devis) {
        let clientId = (devis as any).client_id ?? null;
        if (!clientId && (devis as any).chantier_id) {
          const { data: ch } = await db.from("chantiers")
            .select("client_id")
            .eq("id", (devis as any).chantier_id)
            .single();
          clientId = ch?.client_id ?? null;
        }
        if (clientId) {
          const { data: client } = await db.from("clients")
            .select("nom")
            .eq("id", clientId)
            .single();
          if (client?.nom) buyerName = client.nom;
        }
      }
    }

    const montantHt = Number(facture.montant_ht);
    const tva = Number(facture.tva);
    const totalTtc = montantHt * (1 + tva / 100);
    const duePayable = Number(facture.solde_restant);
    const tvaAmt = montantHt * tva / 100;

    const xml = buildFacturxXml({
      numero: facture.numero,
      date: facture.created_at,
      sellerName,
      buyerName,
      montantHt,
      tva,
      totalTtc,
      duePayable,
    });

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(facture.numero);
    pdfDoc.setCreator("TrustBuild-IA");
    pdfDoc.setProducer("TrustBuild-IA / pdf-lib");

    const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    const M = 45;
    const blue = rgb(0.09, 0.39, 0.73);
    const gray = rgb(0.5, 0.5, 0.5);
    const dark = rgb(0.15, 0.15, 0.15);
    const lineColor = rgb(0.85, 0.85, 0.85);

    // Title block
    page.drawText("FACTURE", { x: M, y: height - M, size: 26, font: fontBold, color: blue });
    page.drawText(`N° ${facture.numero}`, { x: M, y: height - M - 32, size: 12, font: fontBold, color: dark });
    page.drawText(`Date : ${fmtDate(facture.created_at)}`, { x: M, y: height - M - 50, size: 10, font: fontNormal, color: gray });
    if (facture.date_echeance) {
      page.drawText(`Échéance : ${fmtDate(facture.date_echeance)}`, { x: M, y: height - M - 65, size: 10, font: fontNormal, color: gray });
    }

    // Artisan block (right-aligned)
    const artisanLines: Array<[string, boolean]> = [[sellerName, true]];
    if (artisanAdresse) artisanLines.push([artisanAdresse, false]);
    if (artisanSiret) artisanLines.push([`SIRET : ${artisanSiret}`, false]);
    if (artisanTel) artisanLines.push([`Tél. : ${artisanTel}`, false]);

    let ay = height - M;
    for (const [line, bold] of artisanLines) {
      const font = bold ? fontBold : fontNormal;
      const w = font.widthOfTextAtSize(line, 10);
      page.drawText(line, { x: width - M - w, y: ay, size: 10, font, color: dark });
      ay -= 15;
    }

    // Divider 1
    const div1Y = height - M - 90;
    page.drawLine({ start: { x: M, y: div1Y }, end: { x: width - M, y: div1Y }, thickness: 1, color: lineColor });

    // Client block
    let cy = div1Y - 18;
    page.drawText("CLIENT :", { x: M, y: cy, size: 8, font: fontBold, color: gray });
    cy -= 16;
    page.drawText(buyerName, { x: M, y: cy, size: 12, font: fontBold, color: dark });

    // Divider 2
    const div2Y = cy - 22;
    page.drawLine({ start: { x: M, y: div2Y }, end: { x: width - M, y: div2Y }, thickness: 1, color: lineColor });

    // Amounts
    const tableX = width / 2 + 20;
    let ty = div2Y - 30;

    const rows: Array<[string, string]> = [
      ["Montant HT", fmtMoney(montantHt)],
      [`TVA (${tva} %)`, fmtMoney(tvaAmt)],
    ];
    for (const [label, value] of rows) {
      page.drawText(label, { x: tableX, y: ty, size: 10, font: fontNormal, color: gray });
      const vw = fontNormal.widthOfTextAtSize(value, 10);
      page.drawText(value, { x: width - M - vw, y: ty, size: 10, font: fontNormal, color: dark });
      ty -= 18;
    }

    // Total TTC row
    const ttcValue = fmtMoney(totalTtc);
    const ttcValueW = fontBold.widthOfTextAtSize(ttcValue, 11);
    page.drawRectangle({ x: tableX - 8, y: ty - 6, width: width - M - tableX + 8, height: 26, color: blue });
    page.drawText("NET À PAYER TTC", { x: tableX, y: ty + 3, size: 10, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText(ttcValue, { x: width - M - ttcValueW, y: ty + 3, size: 11, font: fontBold, color: rgb(1, 1, 1) });
    ty -= 28;

    if (duePayable < totalTtc - 0.01) {
      page.drawText("Solde restant", { x: tableX, y: ty, size: 10, font: fontNormal, color: gray });
      const srw = fontNormal.widthOfTextAtSize(fmtMoney(duePayable), 10);
      page.drawText(fmtMoney(duePayable), { x: width - M - srw, y: ty, size: 10, font: fontNormal, color: dark });
    }

    // Footer
    const footerText = sellerName
      + (artisanSiret ? ` — SIRET ${artisanSiret}` : "")
      + " — Généré par TrustBuild-IA";
    const ftw = fontNormal.widthOfTextAtSize(footerText, 7.5);
    page.drawLine({ start: { x: M, y: M + 8 }, end: { x: width - M, y: M + 8 }, thickness: 0.5, color: lineColor });
    page.drawText(footerText, { x: (width - ftw) / 2, y: M - 5, size: 7.5, font: fontNormal, color: gray });

    // Embed FacturX XML (AFRelationship=Alternative per FacturX spec)
    const xmlBytes = new TextEncoder().encode(xml);
    await pdfDoc.attach(xmlBytes, "factur-x.xml", {
      mimeType: "application/xml",
      description: "Factur-X MINIMUM",
      creationDate: new Date(facture.created_at),
      modificationDate: new Date(),
      afRelationship: AFRelationship.Alternative,
    });

    const pdfBytes = await pdfDoc.save();

    // Chunked base64 encoding (safe for large arrays)
    let binary = "";
    const CHUNK = 4096;
    for (let i = 0; i < pdfBytes.length; i += CHUNK) {
      binary += String.fromCharCode(...pdfBytes.subarray(i, i + CHUNK));
    }
    const base64 = btoa(binary);

    return new Response(
      JSON.stringify({ pdf_base64: base64, numero: facture.numero }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-facturx-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
