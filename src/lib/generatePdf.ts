import jsPDF from "jspdf";

interface PdfDevisData {
  numero: string;
  montant_ht: number;
  tva: number;
  statut: string;
  date_validite?: string | null;
  created_at: string;
  clientNom?: string;
  chantierNom?: string;
}

interface PdfFactureData {
  numero: string;
  montant_ht: number;
  tva: number;
  statut: string;
  date_echeance: string;
  solde_restant: number;
  created_at: string;
  clientNom?: string;
  chantierNom?: string;
}

export interface LignePdf {
  designation: string;
  quantite: number;
  unite: string;
  prix_unitaire: number;
  tva: number;
  section_nom?: string | null;
}

const ML = 10;
const MR = 200;
const PAGE_BOT = 287;

function addHeader(doc: jsPDF, title: string, numero: string) {
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(title, ML, 20);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`N° ${numero}`, ML, 30);
  doc.setDrawColor(200);
  doc.line(ML, 35, MR, 35);
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

function formatMoney(n: number): string {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function generateDevisPdf(data: PdfDevisData) {
  const doc = new jsPDF();
  addHeader(doc, "DEVIS", data.numero);

  let y = 45;
  const lines = [
    ["Date de création", formatDate(data.created_at)],
    ["Validité", formatDate(data.date_validite)],
    ["Statut", data.statut],
    ...(data.clientNom ? [["Client", data.clientNom]] : []),
    ...(data.chantierNom ? [["Chantier", data.chantierNom]] : []),
  ];

  doc.setFontSize(11);
  for (const [label, value] of lines) {
    doc.setFont("helvetica", "bold");
    doc.text(label, ML, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), 80, y);
    y += 8;
  }

  y += 10;
  doc.setDrawColor(200);
  doc.line(ML, y, MR, y);
  y += 10;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Montant HT", ML, y);
  doc.text(formatMoney(data.montant_ht), MR, y, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.text(`TVA (${data.tva}%)`, ML, y);
  doc.text(formatMoney(data.montant_ht * data.tva / 100), MR, y, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Total TTC", ML, y);
  doc.text(formatMoney(data.montant_ht * (1 + data.tva / 100)), MR, y, { align: "right" });

  doc.save(`${data.numero}.pdf`);
}

export function generateFacturePdf(data: PdfFactureData) {
  const doc = new jsPDF();
  addHeader(doc, "FACTURE", data.numero);

  let y = 45;
  const lines = [
    ["Date de création", formatDate(data.created_at)],
    ["Échéance", formatDate(data.date_echeance)],
    ["Statut", data.statut],
    ...(data.clientNom ? [["Client", data.clientNom]] : []),
    ...(data.chantierNom ? [["Chantier", data.chantierNom]] : []),
  ];

  doc.setFontSize(11);
  for (const [label, value] of lines) {
    doc.setFont("helvetica", "bold");
    doc.text(label, ML, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), 80, y);
    y += 8;
  }

  y += 10;
  doc.setDrawColor(200);
  doc.line(ML, y, MR, y);
  y += 10;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Montant HT", ML, y);
  doc.text(formatMoney(data.montant_ht), MR, y, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.text(`TVA (${data.tva}%)`, ML, y);
  doc.text(formatMoney(data.montant_ht * data.tva / 100), MR, y, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Total TTC", ML, y);
  doc.text(formatMoney(data.montant_ht * (1 + data.tva / 100)), MR, y, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.text("Solde restant", ML, y);
  doc.text(formatMoney(data.solde_restant), MR, y, { align: "right" });

  doc.save(`${data.numero}.pdf`);
}

// ─── Versions bytes (pour pièces jointes email) ─────────────

function addLignesTable(doc: jsPDF, lignes: LignePdf[], startY: number): number {
  let y = startY;
  const LINE_H = 6;

  doc.setFontSize(9);
  let currentSection: string | null = null;

  for (const l of lignes) {
    if (l.section_nom && l.section_nom !== currentSection) {
      currentSection = l.section_nom;
      if (y > PAGE_BOT - 20) { doc.addPage(); y = ML; }
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(ML, y - 4, MR - ML, LINE_H + 1, "F");
      doc.text(currentSection, ML + 2, y + 1);
      doc.setFont("helvetica", "normal");
      y += LINE_H + 2;
    }

    if (y > PAGE_BOT - 10) { doc.addPage(); y = ML; }

    const designation = doc.splitTextToSize(l.designation, 100);
    const lineTotal = l.quantite * l.prix_unitaire;

    doc.setFont("helvetica", "normal");
    doc.text(designation, ML + 2, y);
    doc.text(String(l.quantite), 110, y, { align: "right" });
    doc.text(l.unite, 118, y);
    doc.text(formatMoney(l.prix_unitaire), 155, y, { align: "right" });
    doc.text(formatMoney(lineTotal), MR, y, { align: "right" });

    y += designation.length > 1 ? designation.length * 5 : LINE_H;
    doc.setDrawColor(230);
    doc.line(ML, y, MR, y);
    y += 1;
  }

  return y;
}

function buildDocMeta(
  doc: jsPDF,
  title: string,
  numero: string,
  meta: Array<[string, string]>,
  lignes?: LignePdf[]
): number {
  addHeader(doc, title, numero);
  let y = 45;

  doc.setFontSize(11);
  for (const [label, value] of meta) {
    doc.setFont("helvetica", "bold");
    doc.text(label, ML, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 80, y);
    y += 8;
  }

  if (lignes && lignes.length > 0) {
    y += 6;
    doc.setDrawColor(200);
    doc.line(ML, y, MR, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(220, 220, 220);
    doc.rect(ML, y - 4, MR - ML, 7, "F");
    doc.text("Désignation", ML + 2, y);
    doc.text("Qté", 110, y, { align: "right" });
    doc.text("Unité", 118, y);
    doc.text("P.U. HT", 155, y, { align: "right" });
    doc.text("Total HT", MR, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 7;

    y = addLignesTable(doc, lignes, y);
  }

  return y;
}

export function generateDevisPdfBytes(data: PdfDevisData & { lignes?: LignePdf[] }): Uint8Array {
  const doc = new jsPDF();
  const meta: Array<[string, string]> = [
    ["Date", formatDate(data.created_at)],
    ["Validité", formatDate(data.date_validite)],
    ...(data.clientNom ? [["Client", data.clientNom] as [string, string]] : []),
    ...(data.chantierNom ? [["Chantier", data.chantierNom] as [string, string]] : []),
  ];

  let y = buildDocMeta(doc, "DEVIS", data.numero, meta, data.lignes);

  y += 8;
  if (y > 277) { doc.addPage(); y = ML; }
  doc.setDrawColor(200);
  doc.line(ML, y, MR, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Montant HT", ML, y);
  doc.text(formatMoney(data.montant_ht), MR, y, { align: "right" });
  y += 7;
  doc.text(`TVA (${data.tva}%)`, ML, y);
  doc.text(formatMoney(data.montant_ht * data.tva / 100), MR, y, { align: "right" });
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Total TTC", ML, y);
  doc.text(formatMoney(data.montant_ht * (1 + data.tva / 100)), MR, y, { align: "right" });

  return new Uint8Array(doc.output("arraybuffer"));
}

export function generateFacturePdfBytes(data: PdfFactureData & { lignes?: LignePdf[] }): Uint8Array {
  const doc = new jsPDF();
  const meta: Array<[string, string]> = [
    ["Date", formatDate(data.created_at)],
    ["Échéance", formatDate(data.date_echeance)],
    ...(data.clientNom ? [["Client", data.clientNom] as [string, string]] : []),
    ...(data.chantierNom ? [["Chantier", data.chantierNom] as [string, string]] : []),
  ];

  let y = buildDocMeta(doc, "FACTURE", data.numero, meta, data.lignes);

  y += 8;
  if (y > 277) { doc.addPage(); y = ML; }
  doc.setDrawColor(200);
  doc.line(ML, y, MR, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Montant HT", ML, y);
  doc.text(formatMoney(data.montant_ht), MR, y, { align: "right" });
  y += 7;
  doc.text(`TVA (${data.tva}%)`, ML, y);
  doc.text(formatMoney(data.montant_ht * data.tva / 100), MR, y, { align: "right" });
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Total TTC", ML, y);
  doc.text(formatMoney(data.montant_ht * (1 + data.tva / 100)), MR, y, { align: "right" });
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.text("Solde restant", ML, y);
  doc.text(formatMoney(data.solde_restant), MR, y, { align: "right" });

  return new Uint8Array(doc.output("arraybuffer"));
}
