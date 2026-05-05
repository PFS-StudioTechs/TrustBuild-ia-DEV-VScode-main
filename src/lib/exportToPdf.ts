import jsPDF from "jspdf";

// Remove emoji and unsupported Unicode glyphs (Helvetica can't render them)
function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
    .replace(/‍/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function clean(text: string): string {
  return stripEmoji(stripInlineMarkdown(text));
}

export interface PdfExportOptions {
  title: string;
  question?: string | null;
  content: string;
  headerColor?: [number, number, number];
  filename: string;
}

export function exportMarkdownToPdf(opts: PdfExportOptions): void {
  const { title, question, content, headerColor = [59, 130, 246], filename } = opts;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const MARGIN = 20;
  const MAX_W = pageW - MARGIN * 2;
  let y = 20;

  const checkPage = (needed = 10) => {
    if (y + needed > 277) {
      doc.addPage();
      y = 22;
    }
  };

  const addText = (
    text: string,
    size: number,
    style: "normal" | "bold" = "normal",
    colorR: number = 40,
    colorG?: number,
    colorB?: number,
    indent = 0,
  ) => {
    if (!text.trim()) return;
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    if (colorG !== undefined && colorB !== undefined) {
      doc.setTextColor(colorR, colorG, colorB);
    } else {
      doc.setTextColor(colorR);
    }
    const lines = doc.splitTextToSize(text, MAX_W - indent);
    lines.forEach((line: string) => {
      checkPage(size * 0.5 + 2);
      doc.text(line, MARGIN + indent, y);
      y += size * 0.45;
    });
    y += 1.5;
  };

  const addHRule = (gray = 210) => {
    checkPage(5);
    doc.setDrawColor(gray);
    doc.line(MARGIN, y, pageW - MARGIN, y);
    y += 5;
  };

  // ── Header banner ──────────────────────────────────────────────────────────
  doc.setFillColor(...headerColor);
  doc.rect(0, 0, pageW, 14, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255);
  doc.text("TrustBuild-IA", MARGIN, 9);
  doc.setFont("helvetica", "normal");
  doc.text(
    new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }),
    pageW - MARGIN,
    9,
    { align: "right" },
  );

  y = 24;

  // ── Title ──────────────────────────────────────────────────────────────────
  addText(clean(title), 15, "bold", 20, 20, 20);
  addHRule(200);

  // ── Question block ─────────────────────────────────────────────────────────
  if (question?.trim()) {
    addText("Question", 8, "bold", 130, 130, 130);
    addText(clean(question), 10, "normal", 60, 60, 60);
    addHRule(220);
  }

  addText("Réponse", 8, "bold", 130, 130, 130);
  y += 3;

  // ── Markdown content renderer ──────────────────────────────────────────────
  const mdLines = content.split("\n");

  for (const rawLine of mdLines) {
    // Blank line → paragraph break
    if (!rawLine.trim()) {
      y += 3;
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(rawLine)) {
      y += 2;
      addHRule(230);
      continue;
    }

    // Headings (# through ####)
    const h4 = rawLine.match(/^####\s+(.*)/);
    const h3 = rawLine.match(/^###\s+(.*)/);
    const h2 = rawLine.match(/^##\s+(.*)/);
    const h1 = rawLine.match(/^#\s+(.*)/);

    if (h4) {
      y += 2;
      addText(clean(h4[1]), 10, "bold", 60, 60, 100);
      continue;
    }
    if (h3) {
      y += 3;
      addText(clean(h3[1]), 11, "bold", 50, 50, 90);
      continue;
    }
    if (h2) {
      y += 4;
      addText(clean(h2[1]), 13, "bold", 30, 30, 60);
      addHRule(220);
      continue;
    }
    if (h1) {
      y += 4;
      addText(clean(h1[1]), 14, "bold", 20, 20, 50);
      addHRule(200);
      continue;
    }

    // Table separator row → skip
    if (/^\|[\s\-:|]+\|$/.test(rawLine)) continue;

    // Table content row → format as columnar text
    if (/^\|.*\|$/.test(rawLine)) {
      const cells = rawLine
        .split("|")
        .filter(Boolean)
        .map((c) => c.trim())
        .join("   |   ");
      addText(clean(cells), 9, "normal", 50, 50, 50, 4);
      continue;
    }

    // Numbered list (1. 2. etc.)
    const numbered = rawLine.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (numbered) {
      const indent = numbered[1].length > 0 ? 10 : 5;
      addText(`${numbered[2]}.  ${clean(numbered[3])}`, 10, "normal", 40, 40, 40, indent);
      continue;
    }

    // Bullet list (- * •)
    const bullet = rawLine.match(/^(\s*)[-*•]\s+(.*)/);
    if (bullet) {
      const indent = bullet[1].length > 0 ? 10 : 5;
      addText(`•  ${clean(bullet[2])}`, 10, "normal", 40, 40, 40, indent);
      continue;
    }

    // Regular paragraph
    addText(clean(rawLine), 10, "normal", 40, 40, 40);
  }

  // ── Footer pagination ──────────────────────────────────────────────────────
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160);
    doc.text(`Page ${p} / ${pageCount}`, pageW - MARGIN, 287, { align: "right" });
  }

  doc.save(filename);
}
