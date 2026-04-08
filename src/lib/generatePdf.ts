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
