import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Sectoral defaults ────────────────────────────────────────────────────────
const SECTOR_DEFAULTS: Record<string, { primary: string; secondary: string; accent: string; emoji: string; label: string }> = {
  plomberie:      { primary: "#1d4ed8", secondary: "#1e3a5f", accent: "#0ea5e9", emoji: "🔧", label: "Plomberie" },
  electricite:    { primary: "#ca8a04", secondary: "#78350f", accent: "#facc15", emoji: "⚡", label: "Électricité" },
  architecture:   { primary: "#374151", secondary: "#111827", accent: "#6366f1", emoji: "🏛️", label: "Architecture" },
  peinture:       { primary: "#7c3aed", secondary: "#4c1d95", accent: "#f472b6", emoji: "🎨", label: "Peinture & Revêtements" },
  menuiserie:     { primary: "#92400e", secondary: "#451a03", accent: "#f59e0b", emoji: "🪵", label: "Menuiserie" },
  general:        { primary: "#2563eb", secondary: "#1e40af", accent: "#f59e0b", emoji: "🏗️", label: "BTP Général" },
  jardinage:      { primary: "#16a34a", secondary: "#14532d", accent: "#86efac", emoji: "🌿", label: "Jardinier / Paysagiste" },
  pisciniste:     { primary: "#0891b2", secondary: "#164e63", accent: "#67e8f9", emoji: "🏊", label: "Pisciniste" },
  platrerie:      { primary: "#6b7280", secondary: "#374151", accent: "#d1d5db", emoji: "🪣", label: "Plâtrier" },
  charpente:      { primary: "#b45309", secondary: "#7c2d12", accent: "#fb923c", emoji: "🏠", label: "Charpentier / Couvreur" },
  maconnerie:     { primary: "#4b5563", secondary: "#1f2937", accent: "#9ca3af", emoji: "🧱", label: "Maçonnerie" },
};

// ─── HTML template builder ────────────────────────────────────────────────────
function buildHtml(params: {
  type: "devis" | "facture" | "avenant" | "avoir";
  numero: string;
  date: string;
  date_validite?: string | null;
  date_echeance?: string | null;
  parent_numero?: string | null;
  artisan: { nom: string; prenom: string; siret?: string | null; adresse?: string | null; telephone?: string | null; email?: string | null; logo_url?: string | null };
  client: { nom: string; adresse?: string | null; email?: string | null; telephone?: string | null };
  chantier?: { nom?: string | null; adresse?: string | null };
  lignes: Array<{ description: string; quantite: number; unite: string; prix_unitaire: number; tva_taux?: number; section?: string | null }>;
  montant_ht: number;
  tva: number;
  statut: string;
  couleur_primaire: string;
  couleur_secondaire: string;
  couleur_accent: string;
  logo_url?: string | null;
  secteur: string;
  entete_texte?: string | null;
  mentions?: string[];
  custom_css?: string | null;
}): string {
  const cp = params.couleur_primaire;
  const ca = params.couleur_accent;
  const isAvoir = params.type === "avoir";

  const docLabel: Record<string, string> = {
    devis: "Devis",
    facture: "Facture",
    avenant: "Avenant",
    avoir: "Avoir",
  };

  const montantTTC = params.montant_ht * (1 + params.tva / 100);
  const montantTVA = params.montant_ht * (params.tva / 100);

  const logoHtml = params.logo_url
    ? `<img src="${params.logo_url}" alt="Logo" style="max-height:65px;max-width:150px;object-fit:contain;display:block;margin-bottom:8px;" />`
    : "";

  const enteteHtml = params.entete_texte
    ? params.entete_texte.split("\n").map(l => `<span style="font-size:8pt;color:#777;">${l}</span><br>`).join("")
    : "";

  const statutColor: Record<string, string> = {
    brouillon: "#6b7280", envoye: "#2563eb", envoyee: "#2563eb", signe: "#16a34a",
    accepte: "#16a34a", refuse: "#dc2626", facture: "#7c3aed", annule: "#dc2626", annulee: "#dc2626",
    paye: "#16a34a", payee: "#16a34a", partiel: "#d97706", en_retard: "#dc2626",
    en_cours: "#2563eb", termine: "#16a34a", en_attente_paiement: "#d97706",
    impayee: "#dc2626", a_modifier: "#d97706",
  };
  const statutLabels: Record<string, string> = {
    brouillon: "Brouillon", envoye: "Envoyé", envoyee: "Envoyée", signe: "Signé",
    accepte: "Accepté", refuse: "Refusé", facture: "Facturé", annule: "Annulé", annulee: "Annulée",
    paye: "Payé", payee: "Payée", partiel: "Partiel", en_retard: "En retard",
    en_cours: "En cours", termine: "Terminé", en_attente_paiement: "En attente",
    impayee: "Impayée", a_modifier: "À modifier",
  };

  const hasSections = (params.lignes ?? []).some(l => l.section);
  let dataRowIndex = 0;
  const lignesHtml = (params.lignes ?? []).flatMap((l, i) => {
    const rows: string[] = [];
    const isNewSection = hasSections && l.section && (i === 0 || l.section !== params.lignes[i - 1].section);
    if (isNewSection) {
      rows.push(`<tr>
        <td colspan="4" style="padding:6px 10px 4px;background:${cp}18;border-top:2px solid ${cp}40;">
          <span style="font-size:8pt;font-weight:700;color:${cp};letter-spacing:0.04em;text-transform:uppercase;">${l.section}</span>
        </td>
      </tr>`);
    }
    const total = (l.quantite ?? 0) * (l.prix_unitaire ?? 0);
    const bg = dataRowIndex % 2 === 0 ? "#ffffff" : "#f9f9f9";
    dataRowIndex++;
    rows.push(`<tr style="background:${bg};">
      <td style="padding:8px 10px;${hasSections && l.section ? "padding-left:18px;" : ""}">${l.description || "—"}</td>
      <td style="padding:8px 10px;text-align:right;white-space:nowrap;">${l.quantite ?? 0} ${l.unite || "u"}</td>
      <td style="padding:8px 10px;text-align:right;white-space:nowrap;">${fmt(l.prix_unitaire ?? 0)}</td>
      <td style="padding:8px 10px;text-align:right;font-weight:600;white-space:nowrap;">${fmt(total)}</td>
    </tr>`);
    return rows;
  }).join("");

  const defaultMentions = [
    "Assurance Décennale souscrite — attestation disponible sur demande.",
    "Règlement à réception de facture. Tout retard entraîne des pénalités de 3× le taux d'intérêt légal.",
    "En cas de retard de paiement, une indemnité forfaitaire de 40 € sera appliquée.",
  ];
  const mentionsTexte = (params.mentions?.length ? params.mentions : defaultMentions)
    .map(m => `* ${m}`)
    .join("<br>");

  const sign = isAvoir ? "– " : "";
  const totalLabel = isAvoir ? "CRÉDIT TTC" : "NET À PAYER TTC";

  const parentLabel = params.type === "avenant"
    ? `Rattaché au devis N° ${params.parent_numero ?? "—"}`
    : params.type === "avoir"
    ? `Avoir sur facture N° ${params.parent_numero ?? "—"}`
    : "";

  const dateLines = [
    params.date_validite ? `<strong>Validité :</strong> ${params.date_validite}` : "",
    params.date_echeance ? `<strong>Échéance :</strong> ${params.date_echeance}` : "",
  ].filter(Boolean).join("<br>");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${docLabel[params.type]} ${params.numero}</title>
<style>
  ${params.custom_css ?? ""}
  @page { size: A4; margin: 15mm 15mm 20mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #333; line-height: 1.5; background: #fff; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  .page { max-width: 794px; margin: 0 auto; padding: 0; background: #fff; }
  table { border-collapse: collapse; }
  .clear { clear: both; }
</style>
</head>
<body>
<div class="page">

  <!-- ══ EN-TÊTE ══ -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid ${cp};margin-bottom:22px;">
    <div style="width:55%;">
      ${logoHtml}
      <strong style="font-size:12pt;">${params.artisan.prenom} ${params.artisan.nom}</strong>
      ${params.artisan.adresse ? `<br>${params.artisan.adresse}` : ""}
      ${params.artisan.siret ? `<br>SIRET : ${params.artisan.siret}` : ""}
      ${params.artisan.telephone ? `<br>Tél. : ${params.artisan.telephone}` : ""}
      ${params.artisan.email ? `<br>${params.artisan.email}` : ""}
      ${enteteHtml ? `<br>${enteteHtml}` : ""}
    </div>
    <div style="width:42%;text-align:right;">
      <div style="color:${cp};font-size:26pt;font-weight:700;text-transform:uppercase;line-height:1;">${docLabel[params.type]}</div>
      <div style="margin-top:8px;font-size:9.5pt;">N° : <strong>${params.numero}</strong></div>
      <div style="font-size:9pt;color:#555;">Date : ${params.date}</div>
      ${parentLabel ? `<div style="font-size:8.5pt;color:#777;margin-top:4px;">${parentLabel}</div>` : ""}
      <div style="margin-top:8px;">
        <span style="display:inline-block;background:${statutColor[params.statut] ?? ca};color:#fff;font-size:8pt;font-weight:700;padding:3px 10px;border-radius:12px;text-transform:uppercase;letter-spacing:.3px;">${statutLabels[params.statut] ?? params.statut}</span>
      </div>
    </div>
  </div>

  <!-- ══ CLIENT + DÉTAILS ══ -->
  <div style="margin-bottom:16px;">
    <div style="float:right;width:44%;padding:10px 14px;background:#f9f9f9;border:1px solid #e0e0e0;">
      <strong>CLIENT :</strong><br>
      ${params.client.nom}
      ${params.client.adresse ? `<br>${params.client.adresse}` : ""}
      ${params.client.telephone ? `<br>Tél. : ${params.client.telephone}` : ""}
      ${params.client.email ? `<br>${params.client.email}` : ""}
    </div>
    <div style="width:48%;font-size:9.5pt;line-height:1.9;">
      ${params.chantier?.nom ? `<strong>Chantier :</strong> ${params.chantier.nom}<br>` : ""}
      ${params.chantier?.adresse ? `<strong>Adresse :</strong> ${params.chantier.adresse}<br>` : ""}
      ${dateLines}
    </div>
    <div class="clear"></div>
  </div>

  <!-- ══ TABLEAU DES PRESTATIONS ══ -->
  <table style="width:100%;margin:16px 0 0 0;">
    <thead>
      <tr>
        <th style="background:${cp};color:#fff;text-align:left;padding:8px 10px;font-size:9pt;">Description des travaux</th>
        <th style="background:${cp};color:#fff;text-align:right;padding:8px 10px;font-size:9pt;width:16%;">Qté / Unité</th>
        <th style="background:${cp};color:#fff;text-align:right;padding:8px 10px;font-size:9pt;width:14%;">P.U. HT</th>
        <th style="background:${cp};color:#fff;text-align:right;padding:8px 10px;font-size:9pt;width:15%;">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${lignesHtml || `<tr><td colspan="4" style="padding:20px;text-align:center;color:#9ca3af;font-style:italic;">Aucune prestation renseignée</td></tr>`}
    </tbody>
  </table>

  <!-- ══ TOTAUX ══ -->
  <div style="margin-top:12px;">
    <table style="width:40%;float:right;">
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">Total HT</td>
        <td style="padding:6px 10px;text-align:right;border-bottom:1px solid #eee;">${sign}${fmt(params.montant_ht)}</td>
      </tr>
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">TVA (${params.tva} %)</td>
        <td style="padding:6px 10px;text-align:right;border-bottom:1px solid #eee;">${sign}${fmt(montantTVA)}</td>
      </tr>
      <tr style="background:${cp};">
        <td style="padding:10px;font-weight:700;font-size:11pt;color:#fff;">${totalLabel}</td>
        <td style="padding:10px;text-align:right;font-weight:700;font-size:11pt;color:#fff;">${sign}${fmt(montantTTC)}</td>
      </tr>
    </table>
    <div class="clear"></div>
  </div>

  <!-- ══ MENTIONS LÉGALES ══ -->
  <div style="margin-top:24px;font-size:8pt;font-style:italic;color:#666;line-height:1.7;border-top:1px solid #e0e0e0;padding-top:10px;">
    ${mentionsTexte}
  </div>

  <!-- ══ PIED DE PAGE (fixe à l'impression) ══ -->
  <div class="no-print" style="height:50px;"></div>
  <div style="font-size:7.5pt;text-align:center;color:#999;border-top:1px solid #ddd;padding-top:6px;margin-top:20px;">
    ${params.artisan.prenom} ${params.artisan.nom}${params.artisan.siret ? ` — SIRET ${params.artisan.siret}` : ""}${params.artisan.email ? ` — ${params.artisan.email}` : ""}${params.artisan.telephone ? ` — ${params.artisan.telephone}` : ""}
  </div>

  <!-- Bouton impression -->
  <div class="no-print" style="padding:24px 0;text-align:center;">
    <button onclick="window.print()" style="background:${cp};color:#fff;border:none;border-radius:8px;padding:12px 40px;font-size:12pt;font-weight:600;cursor:pointer;letter-spacing:.3px;">
      Imprimer / Enregistrer en PDF
    </button>
  </div>

</div>
</body>
</html>`;
}

function fmt(n: number): string {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: cors });

    const db = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const { type, devis_id, facture_id, avenant_id, avoir_id } = body;

    // ── Profil artisan ─────────────────────────────────────────────────────
    const { data: profile } = await db.from("profiles")
      .select("nom, prenom, siret, logo_url")
      .eq("user_id", user.id)
      .single();

    const { data: settings } = await db.from("artisan_settings")
      .select("preferences")
      .eq("user_id", user.id)
      .single();

    const prefs = (settings?.preferences ?? {}) as Record<string, string>;
    const artisan = {
      nom: profile?.nom ?? "",
      prenom: profile?.prenom ?? "",
      siret: profile?.siret ?? null,
      adresse: prefs.adresse ?? null,
      telephone: prefs.telephone ?? null,
      email: user.email ?? null,
      logo_url: profile?.logo_url ?? null,
    };

    // ── Template actif ─────────────────────────────────────────────────────
    const { data: tpl } = await db.from("document_templates")
      .select("*")
      .eq("artisan_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const secteur = tpl?.secteur ?? "general";
    const sectorDef = SECTOR_DEFAULTS[secteur] ?? SECTOR_DEFAULTS.general;
    const couleur_primaire   = tpl?.couleur_primaire   ?? sectorDef.primary;
    const couleur_secondaire = tpl?.couleur_secondaire ?? sectorDef.secondary;
    const couleur_accent     = tpl?.couleur_accent     ?? sectorDef.accent;
    const logo_url           = tpl?.logo_url ?? artisan.logo_url;
    const entete_texte       = tpl?.entete_texte ?? null;

    let mentions: string[] | undefined;
    if (tpl?.id) {
      const { data: elems } = await db.from("template_elements")
        .select("valeur")
        .eq("template_id", tpl.id)
        .eq("type", "mention");
      if (elems?.length) mentions = elems.map((e: any) => e.valeur).filter(Boolean) as string[];
    }

    let html = "";

    // ══════════════════════════════════════════════════════════════════════
    if (type === "devis" && devis_id) {
      const { data: devis } = await db.from("devis").select("*").eq("id", devis_id).single();
      if (!devis) return new Response(JSON.stringify({ error: "Devis introuvable" }), { status: 404, headers: cors });

      const { data: chantier } = await db.from("chantiers")
        .select("nom, adresse_chantier, client_id")
        .eq("id", devis.chantier_id)
        .maybeSingle();

      const clientId = chantier?.client_id ?? (devis as any).client_id;
      const { data: client } = clientId
        ? await db.from("clients").select("nom, adresse, email, telephone").eq("id", clientId).single()
        : { data: null };

      const { data: lignesData } = await db.from("lignes_devis")
        .select("*").eq("devis_id", devis_id).order("ordre");
      const lignes = (lignesData ?? []).map((l: any) => ({
        description: l.designation ?? "",
        quantite: Number(l.quantite) || 0,
        unite: l.unite ?? "u",
        prix_unitaire: Number(l.prix_unitaire) || 0,
        tva_taux: Number(l.tva) || 20,
        section: l.section_nom ?? null,
      }));

      html = buildHtml({
        type: "devis",
        numero: devis.numero,
        date: fmtDate(devis.created_at),
        date_validite: fmtDate(devis.date_validite),
        artisan, lignes, secteur, entete_texte, mentions,
        client: { nom: client?.nom ?? "Client", adresse: client?.adresse, email: client?.email, telephone: client?.telephone },
        chantier: chantier ? { nom: chantier.nom, adresse: chantier.adresse_chantier } : undefined,
        montant_ht: Number(devis.montant_ht), tva: Number(devis.tva), statut: devis.statut,
        couleur_primaire, couleur_secondaire, couleur_accent, logo_url,
        custom_css: tpl?.css_template,
      });

    // ══════════════════════════════════════════════════════════════════════
    } else if (type === "facture" && facture_id) {
      const { data: facture } = await db.from("factures").select("*").eq("id", facture_id).single();
      if (!facture) return new Response(JSON.stringify({ error: "Facture introuvable" }), { status: 404, headers: cors });

      let chantier = null, client = null;
      let resolvedClientId: string | null = (facture as any).client_id ?? null;

      const devisId = (facture as any).devis_id;
      if (devisId) {
        const { data: devis } = await db.from("devis").select("chantier_id, client_id").eq("id", devisId).single();
        if (devis) {
          if (!resolvedClientId) resolvedClientId = (devis as any).client_id ?? null;
          if ((devis as any).chantier_id) {
            const { data: ch } = await db.from("chantiers").select("nom, adresse_chantier, client_id").eq("id", (devis as any).chantier_id).single();
            chantier = ch;
            if (ch?.client_id && !resolvedClientId) resolvedClientId = ch.client_id;
          }
        }
      }
      if (resolvedClientId) {
        const { data: cl } = await db.from("clients").select("nom, adresse, email, telephone").eq("id", resolvedClientId).single();
        client = cl;
      }

      const { data: lignesFacture } = await db.from("lignes_facture")
        .select("*").eq("facture_id", facture_id).order("ordre");
      const lignes = (lignesFacture ?? []).map((l: any) => ({
        description: l.designation ?? "",
        quantite: Number(l.quantite) || 0,
        unite: l.unite ?? "u",
        prix_unitaire: Number(l.prix_unitaire) || 0,
        tva_taux: Number(l.tva) || 20,
        section: l.section_nom ?? null,
      }));

      html = buildHtml({
        type: "facture",
        numero: facture.numero,
        date: fmtDate(facture.created_at),
        date_echeance: fmtDate(facture.date_echeance),
        artisan, lignes, secteur, entete_texte, mentions,
        client: { nom: client?.nom ?? "Client", adresse: client?.adresse, email: client?.email, telephone: client?.telephone },
        chantier: chantier ? { nom: (chantier as any).nom, adresse: (chantier as any).adresse_chantier } : undefined,
        montant_ht: Number(facture.montant_ht), tva: Number(facture.tva), statut: facture.statut,
        couleur_primaire, couleur_secondaire, couleur_accent, logo_url,
        custom_css: tpl?.css_template,
      });

    // ══════════════════════════════════════════════════════════════════════
    } else if (type === "avenant" && avenant_id) {
      const { data: avenant } = await db.from("avenants").select("*").eq("id", avenant_id).single();
      if (!avenant) return new Response(JSON.stringify({ error: "Avenant introuvable" }), { status: 404, headers: cors });

      const { data: parentDevis } = avenant.devis_id
        ? await db.from("devis").select("chantier_id, client_id, numero").eq("id", avenant.devis_id).single()
        : { data: null };

      let chantier = null, client = null;
      let resolvedClientId: string | null = null;
      if (parentDevis) {
        if ((parentDevis as any).chantier_id) {
          const { data: ch } = await db.from("chantiers").select("nom, adresse_chantier, client_id").eq("id", (parentDevis as any).chantier_id).maybeSingle();
          chantier = ch;
          if (ch?.client_id) resolvedClientId = ch.client_id;
        }
        if (!resolvedClientId) resolvedClientId = (parentDevis as any).client_id ?? null;
        if (resolvedClientId) {
          const { data: cl } = await db.from("clients").select("nom, adresse, email, telephone").eq("id", resolvedClientId).single();
          client = cl;
        }
      }

      // Fetch lignes_avenant si elles existent, sinon ligne forfaitaire
      const { data: lignesAvenantData } = await (db as any).from("lignes_avenant")
        .select("*").eq("avenant_id", avenant_id).order("ordre");

      const lignes = lignesAvenantData && lignesAvenantData.length > 0
        ? lignesAvenantData.map((l: any) => ({
            description: l.designation ?? "",
            quantite: Number(l.quantite) || 0,
            unite: l.unite ?? "u",
            prix_unitaire: Number(l.prix_unitaire) || 0,
            tva_taux: Number(l.tva) || 20,
            section: l.section_nom ?? null,
          }))
        : avenant.description
          ? [{ description: avenant.description, quantite: 1, unite: "forfait", prix_unitaire: Number(avenant.montant_ht) }]
          : [];

      html = buildHtml({
        type: "avenant",
        numero: (avenant as any).numero || `Avt-${avenant_id.slice(-6).toUpperCase()}`,
        date: fmtDate((avenant as any).date ?? (avenant as any).created_at),
        parent_numero: (parentDevis as any)?.numero ?? null,
        artisan, lignes, secteur, entete_texte, mentions,
        client: { nom: client?.nom ?? "Client", adresse: client?.adresse, email: client?.email, telephone: client?.telephone },
        chantier: chantier ? { nom: (chantier as any).nom, adresse: (chantier as any).adresse_chantier } : undefined,
        montant_ht: Number(avenant.montant_ht), tva: Number(avenant.tva), statut: avenant.statut,
        couleur_primaire, couleur_secondaire, couleur_accent, logo_url,
        custom_css: tpl?.css_template,
      });

    // ══════════════════════════════════════════════════════════════════════
    } else if (type === "avoir" && avoir_id) {
      const { data: avoir } = await (db as any).from("avoirs").select("*").eq("id", avoir_id).single();
      if (!avoir) return new Response(JSON.stringify({ error: "Avoir introuvable" }), { status: 404, headers: cors });

      let client = null, chantier = null;
      let resolvedClientId: string | null = null;

      // Résolution client via facture liée
      if (avoir.facture_id) {
        const { data: facture } = await db.from("factures").select("client_id, devis_id").eq("id", avoir.facture_id).maybeSingle();
        if (facture) {
          resolvedClientId = (facture as any).client_id ?? null;
          if (!resolvedClientId && (facture as any).devis_id) {
            const { data: dv } = await db.from("devis").select("client_id, chantier_id").eq("id", (facture as any).devis_id).maybeSingle();
            resolvedClientId = (dv as any)?.client_id ?? null;
            if ((dv as any)?.chantier_id) {
              const { data: ch } = await db.from("chantiers").select("nom, adresse_chantier").eq("id", (dv as any).chantier_id).maybeSingle();
              chantier = ch;
            }
          }
        }
      }
      // Fallback via devis_id direct (avoirs créés sans facture liée)
      if (!resolvedClientId && avoir.devis_id) {
        const { data: dv } = await db.from("devis").select("client_id, chantier_id").eq("id", avoir.devis_id).maybeSingle();
        if (dv) {
          resolvedClientId = (dv as any)?.client_id ?? null;
          if ((dv as any)?.chantier_id) {
            const { data: ch } = await db.from("chantiers").select("nom, adresse_chantier, client_id").eq("id", (dv as any).chantier_id).maybeSingle();
            if (!chantier) chantier = ch;
            if (ch?.client_id && !resolvedClientId) resolvedClientId = ch.client_id;
          }
        }
      }
      if (resolvedClientId) {
        const { data: cl } = await db.from("clients").select("nom, adresse, email, telephone").eq("id", resolvedClientId).single();
        client = cl;
      }

      // Facture parente pour référence
      let parentFactureNumero: string | null = null;
      if (avoir.facture_id) {
        const { data: pf } = await db.from("factures").select("numero").eq("id", avoir.facture_id).maybeSingle();
        parentFactureNumero = (pf as any)?.numero ?? null;
      }

      // Fetch lignes_avoir si elles existent, sinon ligne forfaitaire
      const { data: lignesAvoirData } = await (db as any).from("lignes_avoir")
        .select("*").eq("avoir_id", avoir_id).order("ordre");

      const lignes = lignesAvoirData && lignesAvoirData.length > 0
        ? lignesAvoirData.map((l: any) => ({
            description: l.designation ?? "",
            quantite: Number(l.quantite) || 0,
            unite: l.unite ?? "u",
            prix_unitaire: Number(l.prix_unitaire) || 0,
            tva_taux: Number(l.tva) || 20,
          }))
        : avoir.description
          ? [{ description: avoir.description, quantite: 1, unite: "forfait", prix_unitaire: Number(avoir.montant_ht) }]
          : [];

      html = buildHtml({
        type: "avoir",
        numero: avoir.numero || `AV-${avoir_id.slice(-6).toUpperCase()}`,
        date: fmtDate(avoir.created_at),
        parent_numero: parentFactureNumero,
        artisan, lignes, secteur, entete_texte, mentions,
        client: { nom: client?.nom ?? "Client", adresse: client?.adresse, email: client?.email, telephone: client?.telephone },
        chantier: chantier ? { nom: (chantier as any).nom, adresse: (chantier as any).adresse_chantier } : undefined,
        montant_ht: Number(avoir.montant_ht), tva: Number(avoir.tva ?? 20), statut: avoir.statut,
        couleur_primaire, couleur_secondaire, couleur_accent, logo_url,
        custom_css: tpl?.css_template,
      });

    } else {
      return new Response(JSON.stringify({ error: "type (devis|facture|avenant|avoir) + id requis" }), { status: 400, headers: cors });
    }

    return new Response(JSON.stringify({ html }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-pdf-html error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: cors }
    );
  }
});
