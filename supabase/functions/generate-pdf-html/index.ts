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
};

// ─── HTML template builder ────────────────────────────────────────────────────
function buildHtml(params: {
  type: "devis" | "facture" | "avenant";
  numero: string;
  date: string;
  date_validite?: string | null;
  date_echeance?: string | null;
  parent_numero?: string | null;
  artisan: { nom: string; prenom: string; siret?: string | null; adresse?: string | null; telephone?: string | null; email?: string | null; logo_url?: string | null };
  client: { nom: string; adresse?: string | null; email?: string | null; telephone?: string | null };
  chantier?: { nom?: string | null; adresse?: string | null };
  lignes: Array<{ description: string; quantite: number; unite: string; prix_unitaire: number; tva_taux?: number }>;
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
  custom_html?: string | null;
  custom_css?: string | null;
}): string {
  const { couleur_primaire: cp, couleur_secondaire: cs, couleur_accent: ca } = params;
  const sector = SECTOR_DEFAULTS[params.secteur] ?? SECTOR_DEFAULTS.general;
  const montantTTC = params.montant_ht * (1 + params.tva / 100);
  const montantTVA = params.montant_ht * (params.tva / 100);
  const docLabel = params.type === "devis" ? "DEVIS" : params.type === "avenant" ? "AVENANT" : "FACTURE";
  const logoHtml = params.logo_url
    ? `<img src="${params.logo_url}" alt="Logo" style="max-height:70px;max-width:160px;object-fit:contain;" />`
    : `<div style="width:60px;height:60px;border-radius:12px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:28px;">${sector.emoji}</div>`;

  const enteteHtml = params.entete_texte
    ? params.entete_texte.split("\n").map(line => `<div style="font-size:10px;color:rgba(255,255,255,0.7);margin-top:2px;">${line}</div>`).join("")
    : "";

  const lignesHtml = (params.lignes ?? []).map((l, i) => {
    const total = (l.quantite ?? 0) * (l.prix_unitaire ?? 0);
    return `
    <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#ffffff"}">
      <td style="padding:10px 14px;font-size:13px;color:#374151;">${l.description || "—"}</td>
      <td style="padding:10px 10px;text-align:center;font-size:13px;color:#374151;">${l.quantite ?? 0}</td>
      <td style="padding:10px 10px;text-align:center;font-size:13px;color:#6b7280;">${l.unite || "u"}</td>
      <td style="padding:10px 10px;text-align:right;font-size:13px;color:#374151;">${fmt(l.prix_unitaire ?? 0)}</td>
      <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600;color:#111827;">${fmt(total)}</td>
    </tr>`;
  }).join("");

  const statut = params.statut;
  const statutColor: Record<string, string> = {
    brouillon: "#6b7280", envoye: "#2563eb", signe: "#16a34a", accepte: "#16a34a",
    refuse: "#dc2626", facture: "#7c3aed", annule: "#dc2626",
    paye: "#16a34a", payee: "#16a34a", partiel: "#d97706", en_retard: "#dc2626",
    en_cours: "#2563eb", chantier_en_cours: "#d97706", termine: "#16a34a",
  };
  const statutLabels: Record<string, string> = {
    brouillon: "Brouillon", envoye: "Envoyé", signe: "Signé", accepte: "Accepté",
    refuse: "Refusé", facture: "Facturé", annule: "Annulé",
    paye: "Payé", payee: "Payée", partiel: "Partiel", en_retard: "En retard",
    en_cours: "En cours", chantier_en_cours: "Chantier en cours", termine: "Terminé",
    envoyee: "Envoyée", en_attente_paiement: "En attente", a_modifier: "À modifier", impayee: "Impayée",
  };

  const mentionsHtml = (params.mentions ?? [
    "TVA non applicable, article 293 B du CGI (si micro-entreprise).",
    "Règlement à réception de facture. Tout retard entraîne des pénalités de 3× le taux d'intérêt légal.",
    "Garantie décennale — assurance RCP professionnelle souscrite.",
  ]).map(m => `<li>${m}</li>`).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${docLabel} ${params.numero}</title>
<style>
  ${params.custom_css ?? ""}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, 'Helvetica Neue', sans-serif; background: #f3f4f6; color: #111827; font-size: 13px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
    .no-print { display: none !important; }
    @page { margin: 8mm 10mm; size: A4; }
  }
  .page { max-width: 794px; margin: 0 auto; background: #fff; padding: 0; }
  table { border-collapse: collapse; }
</style>
</head>
<body>
<div class="page">

  <!-- ═══ HEADER ═══ -->
  <div style="background:linear-gradient(135deg,${cp} 0%,${cs} 100%);padding:28px 32px 24px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">

      <!-- Artisan info -->
      <div style="display:flex;align-items:flex-start;gap:16px;">
        ${logoHtml}
        <div>
          <div style="font-size:18px;font-weight:700;color:#fff;line-height:1.2;">${params.artisan.prenom} ${params.artisan.nom}</div>
          ${params.artisan.siret ? `<div style="font-size:11px;color:rgba(255,255,255,0.8);margin-top:3px;">SIRET : ${params.artisan.siret}</div>` : ""}
          ${params.artisan.adresse ? `<div style="font-size:11px;color:rgba(255,255,255,0.75);margin-top:1px;">${params.artisan.adresse}</div>` : ""}
          ${params.artisan.telephone ? `<div style="font-size:11px;color:rgba(255,255,255,0.75);margin-top:1px;">Tél. : ${params.artisan.telephone}</div>` : ""}
          ${params.artisan.email ? `<div style="font-size:11px;color:rgba(255,255,255,0.75);margin-top:1px;">${params.artisan.email}</div>` : ""}
          ${enteteHtml}
        </div>
      </div>

      <!-- Doc type + numero -->
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:30px;font-weight:800;color:#fff;letter-spacing:-0.5px;line-height:1;">${docLabel}</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.9);margin-top:6px;font-weight:600;">N° ${params.numero}</div>
        ${params.parent_numero ? `<div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:3px;">Rattaché au devis ${params.parent_numero}</div>` : ""}
        <div style="margin-top:10px;">
          <span style="background:${statutColor[statut] ?? ca};color:#fff;font-size:10px;font-weight:700;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:.5px;">${statutLabels[statut] ?? statut}</span>
        </div>
      </div>

    </div>
  </div>

  <!-- ═══ INFO ROW (dates + client + chantier) ═══ -->
  <div style="display:flex;gap:0;border-bottom:2px solid ${cp};">

    <!-- Dates -->
    <div style="flex:1;padding:16px 20px;border-right:1px solid #e5e7eb;">
      <div style="font-size:10px;font-weight:700;color:${cp};text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">Informations</div>
      <div style="font-size:12px;color:#374151;margin-bottom:3px;">Date d'émission : <strong>${params.date}</strong></div>
      ${params.date_validite ? `<div style="font-size:12px;color:#374151;margin-bottom:3px;">Validité jusqu'au : <strong>${params.date_validite}</strong></div>` : ""}
      ${params.date_echeance ? `<div style="font-size:12px;color:#374151;margin-bottom:3px;">Échéance : <strong>${params.date_echeance}</strong></div>` : ""}
    </div>

    <!-- Client -->
    <div style="flex:1.2;padding:16px 20px;${params.chantier?.nom ? "border-right:1px solid #e5e7eb;" : ""}">
      <div style="font-size:10px;font-weight:700;color:${cp};text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">Client</div>
      <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:3px;">${params.client.nom}</div>
      ${params.client.adresse ? `<div style="font-size:11px;color:#6b7280;margin-bottom:2px;">${params.client.adresse}</div>` : ""}
      ${params.client.telephone ? `<div style="font-size:11px;color:#6b7280;margin-bottom:2px;">Tél. : ${params.client.telephone}</div>` : ""}
      ${params.client.email ? `<div style="font-size:11px;color:#6b7280;">${params.client.email}</div>` : ""}
    </div>

    ${params.chantier?.nom ? `
    <!-- Chantier -->
    <div style="flex:1;padding:16px 20px;">
      <div style="font-size:10px;font-weight:700;color:${cp};text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">Chantier</div>
      <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:3px;">${params.chantier.nom}</div>
      ${params.chantier.adresse ? `<div style="font-size:11px;color:#6b7280;">${params.chantier.adresse}</div>` : ""}
    </div>` : ""}

  </div>

  <!-- ═══ LIGNES ═══ -->
  <div style="padding:0 0 0 0;">
    <table style="width:100%;">
      <thead>
        <tr style="background:${cp};">
          <th style="padding:11px 14px;text-align:left;font-size:11px;color:#fff;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Désignation</th>
          <th style="padding:11px 10px;text-align:center;font-size:11px;color:#fff;font-weight:700;width:60px;">Qté</th>
          <th style="padding:11px 10px;text-align:center;font-size:11px;color:#fff;font-weight:700;width:55px;">Unité</th>
          <th style="padding:11px 10px;text-align:right;font-size:11px;color:#fff;font-weight:700;width:105px;">P.U. HT</th>
          <th style="padding:11px 14px;text-align:right;font-size:11px;color:#fff;font-weight:700;width:115px;">Total HT</th>
        </tr>
      </thead>
      <tbody>
        ${lignesHtml || `<tr><td colspan="5" style="padding:20px;text-align:center;font-size:13px;color:#9ca3af;font-style:italic;">Aucune prestation renseignée</td></tr>`}
      </tbody>
    </table>
  </div>

  <!-- ═══ TOTAUX ═══ -->
  <div style="padding:20px 32px 24px;display:flex;justify-content:flex-end;">
    <table style="min-width:260px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px 16px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">Montant HT</td>
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;text-align:right;border-bottom:1px solid #e5e7eb;">${fmt(params.montant_ht)}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:10px 16px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">TVA (${params.tva} %)</td>
        <td style="padding:10px 16px;font-size:13px;color:#6b7280;text-align:right;border-bottom:1px solid #e5e7eb;">${fmt(montantTVA)}</td>
      </tr>
      <tr style="background:${cp};">
        <td style="padding:13px 16px;font-size:15px;font-weight:700;color:#fff;">NET À PAYER TTC</td>
        <td style="padding:13px 16px;font-size:15px;font-weight:700;color:#fff;text-align:right;">${fmt(montantTTC)}</td>
      </tr>
    </table>
  </div>

  <!-- ═══ MENTIONS LÉGALES ═══ -->
  <div style="padding:16px 32px 28px;border-top:1px solid #e5e7eb;">
    <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;">Mentions légales</div>
    <ul style="list-style:none;padding:0;margin:0;">
      ${mentionsHtml.replace(/<li>/g, '<li style="font-size:10px;color:#9ca3af;margin-bottom:3px;padding-left:10px;position:relative;"><span style="position:absolute;left:0;">·</span>')}
    </ul>
  </div>

  <!-- Print button (hidden when printing) -->
  <div class="no-print" style="padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
    <button onclick="window.print()" style="background:${cp};color:#fff;border:none;border-radius:8px;padding:12px 36px;font-size:14px;font-weight:600;cursor:pointer;letter-spacing:.3px;">
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

    // Identify user
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: cors });

    const db = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const { type, devis_id, facture_id, avenant_id } = body;

    // ── Fetch profile ──────────────────────────────────────────────────────
    const { data: profile } = await db.from("profiles")
      .select("nom, prenom, siret, logo_url")
      .eq("user_id", user.id)
      .single();

    const { data: settings } = await db.from("artisan_settings")
      .select("coordonnees_bancaires, preferences")
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

    // ── Fetch active template ──────────────────────────────────────────────
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

    // Fetch mentions from template_elements
    let mentions: string[] | undefined;
    if (tpl?.id) {
      const { data: elems } = await db.from("template_elements")
        .select("valeur")
        .eq("template_id", tpl.id)
        .eq("type", "mention");
      if (elems?.length) mentions = elems.map(e => e.valeur).filter(Boolean) as string[];
    }

    let html = "";

    if (type === "devis" && devis_id) {
      // ── DEVIS ────────────────────────────────────────────────────────────
      const { data: devis } = await db.from("devis").select("*").eq("id", devis_id).single();
      if (!devis) return new Response(JSON.stringify({ error: "Devis introuvable" }), { status: 404, headers: cors });

      const { data: chantier } = await db.from("chantiers")
        .select("nom, adresse_chantier, client_id")
        .eq("id", devis.chantier_id)
        .single();

      const clientId = chantier?.client_id;
      const { data: client } = clientId
        ? await db.from("clients").select("nom, adresse, email, telephone").eq("id", clientId).single()
        : { data: null };

      // Lignes depuis la table lignes_devis
      const { data: lignesData } = await db
        .from("lignes_devis")
        .select("*")
        .eq("devis_id", devis_id)
        .order("ordre");
      const lignes = (lignesData ?? []).map((l: any) => ({
        description:   l.designation ?? "",
        quantite:      Number(l.quantite) || 0,
        unite:         l.unite ?? "u",
        prix_unitaire: Number(l.prix_unitaire) || 0,
        tva_taux:      Number(l.tva) || 20,
      }));

      html = buildHtml({
        type: "devis",
        numero: devis.numero,
        date: fmtDate(devis.created_at),
        date_validite: fmtDate(devis.date_validite),
        artisan,
        client: { nom: client?.nom ?? "Client", adresse: client?.adresse, email: client?.email, telephone: client?.telephone },
        chantier: chantier ? { nom: chantier.nom, adresse: chantier.adresse_chantier } : undefined,
        lignes,
        montant_ht: Number(devis.montant_ht),
        tva: Number(devis.tva),
        statut: devis.statut,
        couleur_primaire,
        couleur_secondaire,
        couleur_accent,
        logo_url,
        secteur,
        entete_texte,
        mentions,
        custom_html: tpl?.html_template,
        custom_css: tpl?.css_template,
      });
    } else if (type === "facture" && facture_id) {
      // ── FACTURE ──────────────────────────────────────────────────────────
      const { data: facture } = await db.from("factures").select("*").eq("id", facture_id).single();
      if (!facture) return new Response(JSON.stringify({ error: "Facture introuvable" }), { status: 404, headers: cors });

      const devisId = (facture as any).devis_id;
      let chantier = null, client = null;
      if (devisId) {
        const { data: devis } = await db.from("devis").select("chantier_id").eq("id", devisId).single();
        if (devis) {
          const { data: ch } = await db.from("chantiers").select("nom, adresse_chantier, client_id").eq("id", devis.chantier_id).single();
          chantier = ch;
          if (ch?.client_id) {
            const { data: cl } = await db.from("clients").select("nom, adresse, email, telephone").eq("id", ch.client_id).single();
            client = cl;
          }
        }
      }

      // Lignes depuis la table lignes_facture
      const { data: lignesFacture } = await db
        .from("lignes_facture")
        .select("*")
        .eq("facture_id", facture_id)
        .order("ordre");
      const lignesF = (lignesFacture ?? []).map((l: any) => ({
        description:   l.designation ?? "",
        quantite:      Number(l.quantite) || 0,
        unite:         l.unite ?? "u",
        prix_unitaire: Number(l.prix_unitaire) || 0,
        tva_taux:      Number(l.tva) || 20,
      }));

      html = buildHtml({
        type: "facture",
        numero: facture.numero,
        date: fmtDate(facture.created_at),
        date_echeance: fmtDate(facture.date_echeance),
        artisan,
        client: { nom: client?.nom ?? "Client", adresse: client?.adresse, email: client?.email, telephone: client?.telephone },
        chantier: chantier ? { nom: chantier.nom, adresse: chantier.adresse_chantier } : undefined,
        lignes: lignesF,
        montant_ht: Number(facture.montant_ht),
        tva: Number(facture.tva),
        statut: facture.statut,
        couleur_primaire,
        couleur_secondaire,
        couleur_accent,
        logo_url,
        secteur,
        entete_texte,
        mentions,
        custom_html: tpl?.html_template,
        custom_css: tpl?.css_template,
      });
    } else if (type === "avenant" && avenant_id) {
      // ── AVENANT ──────────────────────────────────────────────────────────
      const { data: avenant } = await db.from("avenants").select("*").eq("id", avenant_id).single();
      if (!avenant) return new Response(JSON.stringify({ error: "Avenant introuvable" }), { status: 404, headers: cors });

      // Fetch parent devis → chantier → client
      const { data: parentDevis } = avenant.devis_id
        ? await db.from("devis").select("chantier_id, numero").eq("id", avenant.devis_id).single()
        : { data: null };

      let chantier = null, client = null;
      if (parentDevis) {
        const { data: ch } = await db.from("chantiers").select("nom, adresse_chantier, client_id").eq("id", parentDevis.chantier_id).single();
        chantier = ch;
        if (ch?.client_id) {
          const { data: cl } = await db.from("clients").select("nom, adresse, email, telephone").eq("id", ch.client_id).single();
          client = cl;
        }
      }

      // Build avenant as a single-line document
      const ligneAvenant = avenant.description
        ? [{ description: avenant.description, quantite: 1, unite: "forfait", prix_unitaire: Number(avenant.montant_ht) }]
        : [];

      html = buildHtml({
        type: "avenant",
        numero: (avenant as any).numero || `AV-${avenant_id.slice(-6).toUpperCase()}`,
        date: fmtDate((avenant as any).date ?? (avenant as any).created_at),
        parent_numero: parentDevis?.numero ?? null,
        artisan,
        client: { nom: client?.nom ?? "Client", adresse: client?.adresse, email: client?.email, telephone: client?.telephone },
        chantier: chantier ? { nom: chantier.nom, adresse: chantier.adresse_chantier } : undefined,
        lignes: ligneAvenant,
        montant_ht: Number(avenant.montant_ht),
        tva: Number(avenant.tva),
        statut: avenant.statut,
        couleur_primaire,
        couleur_secondaire,
        couleur_accent,
        logo_url,
        secteur,
        entete_texte,
        mentions,
        custom_html: tpl?.html_template,
        custom_css: tpl?.css_template,
      });
    } else {
      return new Response(JSON.stringify({ error: "type (devis|facture|avenant) + id requis" }), { status: 400, headers: cors });
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
