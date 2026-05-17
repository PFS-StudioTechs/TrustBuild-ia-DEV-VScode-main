import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "../_shared/logger.ts";
import {
  AFRelationship,
  PDFDocument,
  PDFName,
  StandardFonts,
  rgb,
} from "https://esm.sh/pdf-lib@1.17.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  designation: string;
  quantite: number;
  unite: string;
  prix_unitaire: number;
  tva: number;
}

interface SellerInfo {
  name: string;
  siret: string;
  tvaIntra: string;
  adresse: string;
  codePostal: string;
  ville: string;
  tel: string;
  iban: string;
  bic: string;
}

interface BuyerInfo {
  name: string;
  adresse: string;
  siret: string;
}

interface DocParams {
  typeCode: "380" | "381" | "386";
  typeLabel: string;
  numero: string;
  dateDoc: string;
  dateEcheance: string | null;
  seller: SellerInfo;
  buyer: BuyerInfo;
  lines: LineItem[];
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  duePayable: number;
  devisNumero: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function xe(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function n2(n: number): string {
  return n.toFixed(2);
}

function toYMD(d: string | null | undefined): string {
  if (!d) return new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const dt = new Date(d);
  return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtEur(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

function tvaCat(rate: number): string {
  return rate > 0 ? "S" : "E";
}

function toUnitCode(unite: string | null | undefined): string {
  if (!unite) return "C62";
  const map: Record<string, string> = {
    "u": "C62", "forfait": "C62", "pce": "C62", "pièce": "C62", "ensemble": "C62",
    "h": "HUR", "heure": "HUR", "heures": "HUR",
    "j": "DAY", "jour": "DAY", "jours": "DAY",
    "m": "MTR", "ml": "MTR",
    "m²": "MTK", "m2": "MTK",
    "m³": "MTQ", "m3": "MTQ",
    "kg": "KGM",
    "l": "LTR",
    "%": "P1",
  };
  return map[unite.toLowerCase()] ?? "C62";
}

// ─── Buyer resolver ───────────────────────────────────────────────────────────

async function fetchBuyer(
  db: ReturnType<typeof createClient>,
  devisId: string | null
): Promise<BuyerInfo> {
  if (!devisId) return { name: "Client", adresse: "", siret: "" };

  const { data: devis } = await db
    .from("devis")
    .select("chantier_id, client_id")
    .eq("id", devisId)
    .single();
  if (!devis) return { name: "Client", adresse: "", siret: "" };

  // deno-lint-ignore no-explicit-any
  let clientId = (devis as any).client_id ?? null;
  // deno-lint-ignore no-explicit-any
  if (!clientId && (devis as any).chantier_id) {
    const { data: ch } = await db
      .from("chantiers")
      .select("client_id")
      // deno-lint-ignore no-explicit-any
      .eq("id", (devis as any).chantier_id)
      .single();
    clientId = ch?.client_id ?? null;
  }
  if (!clientId) return { name: "Client", adresse: "", siret: "" };

  const { data: client } = await db
    .from("clients")
    .select("nom, prenom, adresse, siret")
    .eq("id", clientId)
    .single();
  if (!client) return { name: "Client", adresse: "", siret: "" };

  const name = [client.prenom, client.nom].filter(Boolean).join(" ") || "Client";
  return { name, adresse: client.adresse ?? "", siret: client.siret ?? "" };
}

// ─── XMP Metadata (PDF/A-3b) ─────────────────────────────────────────────────

function buildXmp(p: { numero: string; dateDoc: string; sellerName: string; typeLabel: string }): string {
  const now = new Date().toISOString();
  const created = new Date(p.dateDoc).toISOString();
  const title = `${p.typeLabel} ${xe(p.numero)}`;
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${xe(p.sellerName)}</rdf:li></rdf:Seq></dc:creator>
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:description>
      <pdf:Producer>TrustBuild-IA / pdf-lib</pdf:Producer>
      <xmp:CreateDate>${created}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
      <xmp:CreatorTool>Trust Build-IA</xmp:CreatorTool>
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

// ─── XML Factur-X EN 16931 ───────────────────────────────────────────────────

function buildXml(p: DocParams): string {
  // BlocsLignes
  const linesXml = p.lines.map((l, i) => {
    const lineHt = l.quantite * l.prix_unitaire;
    const unitCode = toUnitCode(l.unite);
    const exemptLine = l.tva === 0
      ? "\n          <ram:ExemptionReasonCode>VATEX-FR-CGI</ram:ExemptionReasonCode>"
      : "";
    return `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${i + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${xe(l.designation)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${n2(l.prix_unitaire)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${unitCode}">${n2(l.quantite)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${tvaCat(l.tva)}</ram:CategoryCode>
          <ram:RateApplicablePercent>${n2(l.tva)}</ram:RateApplicablePercent>${exemptLine}
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${n2(lineHt)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
  }).join("\n");

  // TVA groupée par taux
  const taxMap = new Map<number, { ht: number; tva: number }>();
  for (const l of p.lines) {
    const ht = l.quantite * l.prix_unitaire;
    const tvaAmt = ht * l.tva / 100;
    const g = taxMap.get(l.tva);
    if (g) { g.ht += ht; g.tva += tvaAmt; }
    else taxMap.set(l.tva, { ht, tva: tvaAmt });
  }
  const taxGroupsXml = Array.from(taxMap.entries()).map(([rate, g]) => {
    const exempt = rate === 0
      ? "\n      <ram:ExemptionReasonCode>VATEX-FR-CGI</ram:ExemptionReasonCode>"
      : "";
    return `    <ram:ApplicableTradeTax>
      <ram:CalculatedAmount>${n2(g.tva)}</ram:CalculatedAmount>
      <ram:TypeCode>VAT</ram:TypeCode>
      <ram:BasisAmount>${n2(g.ht)}</ram:BasisAmount>
      <ram:CategoryCode>${tvaCat(rate)}</ram:CategoryCode>
      <ram:RateApplicablePercent>${n2(rate)}</ram:RateApplicablePercent>${exempt}
    </ram:ApplicableTradeTax>`;
  }).join("\n");

  // Seller IDs
  const sellerSiretXml = p.seller.siret
    ? `\n        <ram:SpecifiedLegalOrganization>\n          <ram:ID schemeID="0002">${xe(p.seller.siret)}</ram:ID>\n        </ram:SpecifiedLegalOrganization>`
    : "";
  const sellerTaxXml = p.seller.tvaIntra
    ? `\n        <ram:SpecifiedTaxRegistration>\n          <ram:ID schemeID="VA">${xe(p.seller.tvaIntra)}</ram:ID>\n        </ram:SpecifiedTaxRegistration>`
    : "";

  // Buyer ID
  const buyerSiretXml = p.buyer.siret
    ? `\n        <ram:SpecifiedLegalOrganization>\n          <ram:ID schemeID="0002">${xe(p.buyer.siret)}</ram:ID>\n        </ram:SpecifiedLegalOrganization>`
    : "";

  // Référence devis pour acompte (TypeCode 386)
  const orderRefXml = p.devisNumero
    ? `      <ram:BuyerOrderReferencedDocument>
        <ram:IssuerAssignedID>${xe(p.devisNumero)}</ram:IssuerAssignedID>
      </ram:BuyerOrderReferencedDocument>`
    : "";

  // Moyen de paiement (IBAN/BIC)
  const paymentXml = p.seller.iban
    ? `    <ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:TypeCode>30</ram:TypeCode>
      <ram:PayeePartyCreditorFinancialAccount>
        <ram:IBANID>${xe(p.seller.iban)}</ram:IBANID>
      </ram:PayeePartyCreditorFinancialAccount>${p.seller.bic ? `
      <ram:PayeeSpecifiedCreditorFinancialInstitution>
        <ram:BICID>${xe(p.seller.bic)}</ram:BICID>
      </ram:PayeeSpecifiedCreditorFinancialInstitution>` : ""}
    </ram:SpecifiedTradeSettlementPaymentMeans>`
    : "";

  // Échéance
  const dueXml = p.dateEcheance
    ? `    <ram:SpecifiedTradePaymentTerms>
      <ram:DueDateDateTime>
        <udt:DateTimeString format="102">${toYMD(p.dateEcheance)}</udt:DateTimeString>
      </ram:DueDateDateTime>
    </ram:SpecifiedTradePaymentTerms>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${xe(p.numero)}</ram:ID>
    <ram:TypeCode>${p.typeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${toYMD(p.dateDoc)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${linesXml}
    <ram:ApplicableHeaderTradeAgreement>
${orderRefXml}
      <ram:SellerTradeParty>${sellerSiretXml}
        <ram:Name>${xe(p.seller.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${xe(p.seller.codePostal)}</ram:PostcodeCode>
          <ram:LineOne>${xe(p.seller.adresse)}</ram:LineOne>
          <ram:CityName>${xe(p.seller.ville)}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>${sellerTaxXml}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>${buyerSiretXml}
        <ram:Name>${xe(p.buyer.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:LineOne>${xe(p.buyer.adresse)}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${toYMD(p.dateDoc)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:PaymentReference>${xe(p.numero)}</ram:PaymentReference>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
${paymentXml}
${taxGroupsXml}
${dueXml}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${n2(p.totalHt)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${n2(p.totalHt)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${n2(p.totalTva)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${n2(p.totalTtc)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${n2(p.duePayable)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

// ─── PDF visuel ───────────────────────────────────────────────────────────────

async function buildPdf(p: DocParams): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(p.numero);
  pdfDoc.setCreator("TrustBuild-IA");
  pdfDoc.setProducer("TrustBuild-IA / pdf-lib");

  const fN = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const M = 45;
  const blue = rgb(0.09, 0.39, 0.73);
  const gray = rgb(0.5, 0.5, 0.5);
  const dark = rgb(0.15, 0.15, 0.15);
  const lightBlue = rgb(0.88, 0.93, 0.98);
  const lineCol = rgb(0.85, 0.85, 0.85);
  const white = rgb(1, 1, 1);

  let y = height - M;

  // Titre document
  page.drawText(p.typeLabel, { x: M, y, size: 24, font: fB, color: blue });

  // Bloc artisan (droite)
  const artLines: Array<{ text: string; bold: boolean; size: number }> = [
    { text: p.seller.name, bold: true, size: 10 },
  ];
  if (p.seller.adresse) artLines.push({ text: p.seller.adresse, bold: false, size: 9 });
  if (p.seller.codePostal || p.seller.ville) {
    artLines.push({ text: [p.seller.codePostal, p.seller.ville].filter(Boolean).join(" "), bold: false, size: 9 });
  }
  if (p.seller.siret) artLines.push({ text: `SIRET : ${p.seller.siret}`, bold: false, size: 9 });
  if (p.seller.tel) artLines.push({ text: `Tél. : ${p.seller.tel}`, bold: false, size: 9 });

  let ay = y;
  for (const al of artLines) {
    const f = al.bold ? fB : fN;
    const w = f.widthOfTextAtSize(al.text, al.size);
    page.drawText(al.text, { x: width - M - w, y: ay, size: al.size, font: f, color: dark });
    ay -= 13;
  }

  // Numéro + dates
  y -= 34;
  page.drawText(`N° ${p.numero}`, { x: M, y, size: 12, font: fB, color: dark });
  y -= 17;
  page.drawText(`Date : ${fmtDate(p.dateDoc)}`, { x: M, y, size: 10, font: fN, color: gray });
  if (p.dateEcheance) {
    const echeStr = `Échéance : ${fmtDate(p.dateEcheance)}`;
    page.drawText(echeStr, { x: M + 160, y, size: 10, font: fN, color: gray });
  }

  // Séparateur
  y -= 16;
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.5, color: lineCol });

  // Bloc client
  y -= 15;
  page.drawText("FACTURÉ À :", { x: M, y, size: 8, font: fB, color: gray });
  y -= 14;
  page.drawText(p.buyer.name, { x: M, y, size: 11, font: fB, color: dark });
  if (p.buyer.adresse) {
    y -= 13;
    page.drawText(p.buyer.adresse, { x: M, y, size: 9, font: fN, color: dark });
  }

  // Séparateur
  y -= 16;
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.5, color: lineCol });

  // En-tête tableau lignes
  y -= 14;
  const COL = { desig: M + 2, qty: 300, unit: 348, pu: 396, ht: 458, tva: 524 };
  page.drawRectangle({ x: M, y: y - 4, width: width - 2 * M, height: 18, color: lightBlue });
  page.drawText("Désignation", { x: COL.desig, y: y + 1, size: 8, font: fB, color: dark });
  page.drawText("Qté", { x: COL.qty, y: y + 1, size: 8, font: fB, color: dark });
  page.drawText("Unité", { x: COL.unit, y: y + 1, size: 8, font: fB, color: dark });
  page.drawText("PU HT", { x: COL.pu, y: y + 1, size: 8, font: fB, color: dark });
  page.drawText("Total HT", { x: COL.ht, y: y + 1, size: 8, font: fB, color: dark });
  page.drawText("TVA", { x: COL.tva, y: y + 1, size: 8, font: fB, color: dark });
  y -= 14;

  // Lignes
  const FOOTER_SAFE = M + 130;
  for (const l of p.lines) {
    if (y < FOOTER_SAFE) break;
    const lineHt = l.quantite * l.prix_unitaire;
    const maxW = COL.qty - COL.desig - 4;
    let desig = l.designation;
    while (desig.length > 3 && fN.widthOfTextAtSize(desig, 8) > maxW) desig = desig.slice(0, -1);
    if (desig !== l.designation) desig = desig.slice(0, -1) + "…";

    page.drawText(desig, { x: COL.desig, y, size: 8, font: fN, color: dark });
    page.drawText(n2(l.quantite), { x: COL.qty, y, size: 8, font: fN, color: dark });
    page.drawText(l.unite || "u", { x: COL.unit, y, size: 8, font: fN, color: dark });
    page.drawText(n2(l.prix_unitaire), { x: COL.pu, y, size: 8, font: fN, color: dark });
    page.drawText(n2(lineHt), { x: COL.ht, y, size: 8, font: fN, color: dark });
    page.drawText(`${l.tva}%`, { x: COL.tva, y, size: 8, font: fN, color: dark });
    y -= 12;
    page.drawLine({ start: { x: M, y: y + 1 }, end: { x: width - M, y: y + 1 }, thickness: 0.3, color: lineCol });
  }

  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.5, color: lineCol });

  // Récapitulatif (droite)
  const SX = width / 2 + 20;
  y -= 14;
  const htStr = fmtEur(p.totalHt);
  page.drawText("Montant HT", { x: SX, y, size: 10, font: fN, color: gray });
  page.drawText(htStr, { x: width - M - fN.widthOfTextAtSize(htStr, 10), y, size: 10, font: fN, color: dark });

  y -= 16;
  const tvaStr = fmtEur(p.totalTva);
  page.drawText("TVA", { x: SX, y, size: 10, font: fN, color: gray });
  page.drawText(tvaStr, { x: width - M - fN.widthOfTextAtSize(tvaStr, 10), y, size: 10, font: fN, color: dark });

  y -= 18;
  const ttcStr = fmtEur(p.totalTtc);
  page.drawRectangle({ x: SX - 8, y: y - 6, width: width - M - SX + 8, height: 26, color: blue });
  page.drawText("NET À PAYER TTC", { x: SX, y: y + 3, size: 10, font: fB, color: white });
  page.drawText(ttcStr, { x: width - M - fB.widthOfTextAtSize(ttcStr, 11), y: y + 3, size: 11, font: fB, color: white });
  y -= 28;

  if (p.duePayable < p.totalTtc - 0.005) {
    const soldStr = fmtEur(p.duePayable);
    page.drawText("Solde restant dû", { x: SX, y, size: 10, font: fN, color: gray });
    page.drawText(soldStr, { x: width - M - fN.widthOfTextAtSize(soldStr, 10), y, size: 10, font: fN, color: dark });
    y -= 16;
  }

  // Coordonnées bancaires
  if (p.seller.iban) {
    y -= 10;
    page.drawText("Règlement par virement :", { x: M, y, size: 9, font: fB, color: dark });
    y -= 13;
    page.drawText(`IBAN : ${p.seller.iban}`, { x: M, y, size: 9, font: fN, color: dark });
    if (p.seller.bic) {
      y -= 12;
      page.drawText(`BIC : ${p.seller.bic}`, { x: M, y, size: 9, font: fN, color: dark });
    }
  }

  // Pied de page
  const footerText = p.seller.name
    + (p.seller.siret ? ` — SIRET ${p.seller.siret}` : "")
    + " — Généré par TrustBuild-IA";
  const ftw = fN.widthOfTextAtSize(footerText, 7.5);
  page.drawLine({ start: { x: M, y: M + 8 }, end: { x: width - M, y: M + 8 }, thickness: 0.5, color: lineCol });
  page.drawText(footerText, { x: (width - ftw) / 2, y: M - 5, size: 7.5, font: fN, color: gray });

  return pdfDoc;
}

// ─── Finalisation PDF : XMP + pièce jointe XML + base64 ──────────────────────

async function finalize(
  pdfDoc: PDFDocument,
  xml: string,
  p: DocParams
): Promise<Response> {
  const xmlBytes = new TextEncoder().encode(xml);
  await pdfDoc.attach(xmlBytes, "factur-x.xml", {
    mimeType: "application/xml",
    description: "Factur-X EN 16931",
    creationDate: new Date(p.dateDoc),
    modificationDate: new Date(),
    afRelationship: AFRelationship.Alternative,
  });

  const xmpBytes = new TextEncoder().encode(
    buildXmp({ numero: p.numero, dateDoc: p.dateDoc, sellerName: p.seller.name, typeLabel: p.typeLabel })
  );
  const metaStream = pdfDoc.context.stream(xmpBytes, {
    Type: PDFName.of("Metadata"),
    Subtype: PDFName.of("XML"),
  });
  pdfDoc.catalog.set(PDFName.of("Metadata"), pdfDoc.context.register(metaStream));

  const pdfBytes = await pdfDoc.save();
  let binary = "";
  const CHUNK = 4096;
  for (let i = 0; i < pdfBytes.length; i += CHUNK) {
    binary += String.fromCharCode(...pdfBytes.subarray(i, i + CHUNK));
  }

  return new Response(
    JSON.stringify({ pdf_base64: btoa(binary), numero: p.numero }),
    { headers: { ...cors, "Content-Type": "application/json" } }
  );
}

// ─── Handler principal ────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let logUserId = "";
  let logDb: ReturnType<typeof createClient> | undefined;
  let logDocType = "";
  let logDocumentId = "";

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const db = createClient(supabaseUrl, serviceKey);
    logDb = db;
    logUserId = user.id;
    const body = await req.json();

    // Support legacy { facture_id } et nouveau { type, document_id }
    const docType: "facture" | "avoir" | "acompte" = body.type ?? "facture";
    const documentId: string = body.document_id ?? body.facture_id;
    logDocType = docType;
    logDocumentId = documentId;

    if (!documentId) {
      return new Response(JSON.stringify({ error: "document_id requis" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Profil artisan
    const [profileRes, settingsRes] = await Promise.all([
      db.from("profiles")
        .select("nom, prenom, siret, raison_sociale, adresse, code_postal, ville, tva_intracommunautaire")
        .eq("user_id", user.id)
        .single(),
      db.from("artisan_settings")
        .select("preferences, coordonnees_bancaires")
        .eq("user_id", user.id)
        .single(),
    ]);

    const profile = profileRes.data;
    const prefs = (settingsRes.data?.preferences ?? {}) as Record<string, string>;
    const coords = (settingsRes.data?.coordonnees_bancaires ?? {}) as Record<string, string>;

    const seller: SellerInfo = {
      name: profile?.raison_sociale
        || `${profile?.prenom ?? ""} ${profile?.nom ?? ""}`.trim()
        || "Artisan",
      siret: profile?.siret ?? "",
      tvaIntra: (profile as any)?.tva_intracommunautaire ?? "",
      adresse: profile?.adresse ?? prefs.adresse ?? "",
      codePostal: profile?.code_postal ?? "",
      ville: profile?.ville ?? "",
      tel: prefs.telephone ?? "",
      iban: coords.iban ?? "",
      bic: coords.bic ?? "",
    };

    // ── FACTURE (380) ─────────────────────────────────────────────────────────
    if (docType === "facture") {
      const { data: facture, error: fErr } = await db.from("factures")
        .select("id, numero, montant_ht, tva, created_at, date_echeance, solde_restant, devis_id")
        .eq("id", documentId)
        .eq("artisan_id", user.id)
        .single();
      if (fErr || !facture) {
        return new Response(JSON.stringify({ error: "Facture introuvable" }), {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: rawLines } = await db.from("lignes_facture")
        .select("designation, quantite, unite, prix_unitaire, tva")
        .eq("facture_id", documentId)
        .order("ordre");

      let lines: LineItem[] = (rawLines ?? []).map((l) => ({
        designation: l.designation ?? "",
        quantite: Number(l.quantite),
        unite: l.unite ?? "u",
        prix_unitaire: Number(l.prix_unitaire),
        tva: Number(l.tva),
      }));

      // Fallback si aucune ligne : ligne synthétique depuis montant global
      if (lines.length === 0) {
        lines = [{
          designation: `Facture ${facture.numero}`,
          quantite: 1,
          unite: "C62",
          prix_unitaire: Number(facture.montant_ht),
          tva: Number(facture.tva),
        }];
      }

      const buyer = await fetchBuyer(db, facture.devis_id);
      const totalHt = lines.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
      const totalTva = lines.reduce((s, l) => s + l.quantite * l.prix_unitaire * l.tva / 100, 0);
      const totalTtc = totalHt + totalTva;
      const duePayable = Number(facture.solde_restant) > 0
        ? Number(facture.solde_restant)
        : totalTtc;

      const docParams: DocParams = {
        typeCode: "380",
        typeLabel: "FACTURE",
        numero: facture.numero,
        dateDoc: facture.created_at,
        dateEcheance: facture.date_echeance,
        seller,
        buyer,
        lines,
        totalHt,
        totalTva,
        totalTtc,
        duePayable,
        devisNumero: null,
      };

      const xml = buildXml(docParams);
      const pdfDoc = await buildPdf(docParams);
      return finalize(pdfDoc, xml, docParams);
    }

    // ── AVOIR (381) ───────────────────────────────────────────────────────────
    if (docType === "avoir") {
      const { data: avoir, error: aErr } = await db.from("avoirs")
        .select("id, numero, description, montant_ht, tva, date, created_at, devis_id")
        .eq("id", documentId)
        .eq("artisan_id", user.id)
        .single();
      if (aErr || !avoir) {
        return new Response(JSON.stringify({ error: "Avoir introuvable" }), {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: rawLines } = await db.from("lignes_avoir")
        .select("designation, quantite, unite, prix_unitaire, tva")
        .eq("avoir_id", documentId)
        .order("ordre");

      let lines: LineItem[] = (rawLines ?? []).map((l) => ({
        designation: l.designation ?? "",
        quantite: Number(l.quantite),
        unite: l.unite ?? "u",
        prix_unitaire: Number(l.prix_unitaire),
        tva: Number(l.tva),
      }));

      if (lines.length === 0) {
        lines = [{
          designation: avoir.description || `Avoir ${avoir.numero}`,
          quantite: 1,
          unite: "C62",
          prix_unitaire: Number(avoir.montant_ht),
          tva: Number(avoir.tva),
        }];
      }

      const buyer = await fetchBuyer(db, avoir.devis_id);
      const totalHt = lines.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
      const totalTva = lines.reduce((s, l) => s + l.quantite * l.prix_unitaire * l.tva / 100, 0);
      const totalTtc = totalHt + totalTva;
      const dateDoc = avoir.date || avoir.created_at;

      const docParams: DocParams = {
        typeCode: "381",
        typeLabel: "AVOIR",
        numero: avoir.numero,
        dateDoc,
        dateEcheance: null,
        seller,
        buyer,
        lines,
        totalHt,
        totalTva,
        totalTtc,
        duePayable: totalTtc,
        devisNumero: null,
      };

      const xml = buildXml(docParams);
      const pdfDoc = await buildPdf(docParams);
      return finalize(pdfDoc, xml, docParams);
    }

    // ── ACOMPTE (386) ─────────────────────────────────────────────────────────
    if (docType === "acompte") {
      const { data: acompte, error: acErr } = await db.from("acomptes")
        .select("id, numero, montant, pourcentage, notes, date_echeance, created_at, devis_id, artisan_id")
        .eq("id", documentId)
        .eq("artisan_id", user.id)
        .single();
      if (acErr || !acompte) {
        return new Response(JSON.stringify({ error: "Acompte introuvable" }), {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const [buyer, devisRes] = await Promise.all([
        fetchBuyer(db, acompte.devis_id),
        db.from("devis").select("numero").eq("id", acompte.devis_id).single(),
      ]);

      const montantHt = Number(acompte.montant);
      const tvaPct = 20;
      const tvaAmt = montantHt * tvaPct / 100;
      const totalTtc = montantHt + tvaAmt;

      const pctLabel = acompte.pourcentage ? ` (${acompte.pourcentage}%)` : "";
      const lines: LineItem[] = [{
        designation: acompte.notes || `Acompte${pctLabel}`,
        quantite: 1,
        unite: "C62",
        prix_unitaire: montantHt,
        tva: tvaPct,
      }];

      const dateDoc = acompte.created_at;

      const docParams: DocParams = {
        typeCode: "386",
        typeLabel: "FACTURE D'ACOMPTE",
        numero: acompte.numero,
        dateDoc,
        dateEcheance: acompte.date_echeance,
        seller,
        buyer,
        lines,
        totalHt: montantHt,
        totalTva: tvaAmt,
        totalTtc,
        duePayable: totalTtc,
        devisNumero: devisRes.data?.numero ?? null,
      };

      const xml = buildXml(docParams);
      const pdfDoc = await buildPdf(docParams);
      log(db, { user_id: user.id, action: "facturx.generated", entity_type: docType, entity_id: documentId, status: "success", details: { docType } });
      return finalize(pdfDoc, xml, docParams);
    }

    return new Response(
      JSON.stringify({ error: `type invalide : ${docType}` }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-facturx-pdf error:", e);
    if (logDb && logUserId) {
      log(logDb, { user_id: logUserId, action: "facturx.error", entity_type: logDocType || undefined, entity_id: logDocumentId || undefined, status: "error", details: { error: e instanceof Error ? e.message : String(e) } });
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
