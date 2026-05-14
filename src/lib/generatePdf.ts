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

function addHeader(doc: jsPDF, title: string, numero: string) {
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(title, 20, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`N° ${numero}`, 20, 40);
  doc.setDrawColor(200);
  doc.line(20, 45, 190, 45);
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

  let y = 55;
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
    doc.text(label, 20, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), 80, y);
    y += 8;
  }

  y += 10;
  doc.setDrawColor(200);
  doc.line(20, y, 190, y);
  y += 10;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Montant HT", 20, y);
  doc.text(formatMoney(data.montant_ht), 140, y, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.text(`TVA (${data.tva}%)`, 20, y);
  doc.text(formatMoney(data.montant_ht * data.tva / 100), 140, y, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Total TTC", 20, y);
  doc.text(formatMoney(data.montant_ht * (1 + data.tva / 100)), 140, y, { align: "right" });

  doc.save(`${data.numero}.pdf`);
}

export function generateFacturePdf(data: PdfFactureData) {
  const doc = new jsPDF();
  addHeader(doc, "FACTURE", data.numero);

  let y = 55;
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
    doc.text(label, 20, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), 80, y);
    y += 8;
  }

  y += 10;
  doc.setDrawColor(200);
  doc.line(20, y, 190, y);
  y += 10;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Montant HT", 20, y);
  doc.text(formatMoney(data.montant_ht), 140, y, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.text(`TVA (${data.tva}%)`, 20, y);
  doc.text(formatMoney(data.montant_ht * data.tva / 100), 140, y, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Total TTC", 20, y);
  doc.text(formatMoney(data.montant_ht * (1 + data.tva / 100)), 140, y, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.text("Solde restant", 20, y);
  doc.text(formatMoney(data.solde_restant), 140, y, { align: "right" });

  doc.save(`${data.numero}.pdf`);
}

// ─── Versions bytes (pour pièces jointes email) ─────────────

function addLignesTable(doc: jsPDF, lignes: LignePdf[], startY: number): number {
  let y = startY;
  const PAGE_H = 280;
  const LINE_H = 6;

  doc.setFontSize(9);
  let currentSection: string | null = null;

  for (const l of lignes) {
    if (l.section_nom && l.section_nom !== currentSection) {
      currentSection = l.section_nom;
      if (y > PAGE_H - 20) { doc.addPage(); y = 20; }
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(20, y - 4, 170, LINE_H + 1, "F");
      doc.text(currentSection, 22, y + 1);
      doc.setFont("helvetica", "normal");
      y += LINE_H + 2;
    }

    if (y > PAGE_H - 10) { doc.addPage(); y = 20; }

    const designation = doc.splitTextToSize(l.designation, 95);
    const lineTotal = l.quantite * l.prix_unitaire;

    doc.setFont("helvetica", "normal");
    doc.text(designation, 22, y);
    doc.text(String(l.quantite), 120, y, { align: "right" });
    doc.text(l.unite, 128, y);
    doc.text(formatMoney(l.prix_unitaire), 160, y, { align: "right" });
    doc.text(formatMoney(lineTotal), 190, y, { align: "right" });

    y += designation.length > 1 ? designation.length * 5 : LINE_H;
    doc.setDrawColor(230);
    doc.line(20, y, 190, y);
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
  let y = 55;

  doc.setFontSize(11);
  for (const [label, value] of meta) {
    doc.setFont("helvetica", "bold");
    doc.text(label, 20, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 80, y);
    y += 8;
  }

  if (lignes && lignes.length > 0) {
    y += 6;
    doc.setDrawColor(200);
    doc.line(20, y, 190, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(220, 220, 220);
    doc.rect(20, y - 4, 170, 7, "F");
    doc.text("Désignation", 22, y);
    doc.text("Qté", 120, y, { align: "right" });
    doc.text("Unité", 128, y);
    doc.text("P.U. HT", 160, y, { align: "right" });
    doc.text("Total HT", 190, y, { align: "right" });
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
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setDrawColor(200);
  doc.line(20, y, 190, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Montant HT", 20, y);
  doc.text(formatMoney(data.montant_ht), 190, y, { align: "right" });
  y += 7;
  doc.text(`TVA (${data.tva}%)`, 20, y);
  doc.text(formatMoney(data.montant_ht * data.tva / 100), 190, y, { align: "right" });
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Total TTC", 20, y);
  doc.text(formatMoney(data.montant_ht * (1 + data.tva / 100)), 190, y, { align: "right" });

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
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setDrawColor(200);
  doc.line(20, y, 190, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Montant HT", 20, y);
  doc.text(formatMoney(data.montant_ht), 190, y, { align: "right" });
  y += 7;
  doc.text(`TVA (${data.tva}%)`, 20, y);
  doc.text(formatMoney(data.montant_ht * data.tva / 100), 190, y, { align: "right" });
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Total TTC", 20, y);
  doc.text(formatMoney(data.montant_ht * (1 + data.tva / 100)), 190, y, { align: "right" });
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.text("Solde restant", 20, y);
  doc.text(formatMoney(data.solde_restant), 190, y, { align: "right" });

  return new Uint8Array(doc.output("arraybuffer"));
}
