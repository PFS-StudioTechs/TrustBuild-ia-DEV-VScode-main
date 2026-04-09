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
  type: "devis" | "facture";
  numero: string;
  date: string;
  date_validite?: string | null;
  date_echeance?: string | null;
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
  mentions?: string[];
  custom_html?: string | null;
  custom_css?: string | null;
}): string {
  const { couleur_primaire: cp, couleur_secondaire: cs, couleur_accent: ca } = params;
  const sector = SECTOR_DEFAULTS[params.secteur] ?? SECTOR_DEFAULTS.general;
  const montantTTC = params.montant_ht * (1 + params.tva / 100);
  const montantTVA = params.montant_ht * (params.tva / 100);
  const docLabel = params.type === "devis" ? "DEVIS" : "FACTURE";
  const logoHtml = params.logo_url
    ? `<img src="${params.logo_url}" alt="Logo" style="max-height:70px;max-width:160px;object-fit:contain;" />`
    : `<div style="width:60px;height:60px;border-radius:12px;background:${cp};display:flex;align-items:center;justify-content:center;font-size:28px;">${sector.emoji}</div>`;

  const lignesHtml = (params.lignes ?? []).map((l, i) => {
    const total = (l.quantite ?? 0) * (l.prix_unitaire ?? 0);
    return `
    <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#ffffff"}">
      <td style="padding:10px 12px;font-size:13px;color:#374151;">${l.description || "—"}</td>
      <td style="padding:10px 12px;text-align:center;font-size:13px;color:#374151;">${l.quantite ?? 0}</td>
      <td style="padding:10px 12px;text-align:center;font-size:13px;color:#6b7280;">${l.unite || "u"}</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;color:#374151;">${fmt(l.prix_unitaire ?? 0)}</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;color:#111827;">${fmt(total)}</td>
    </tr>`;
  }).join("");

  const statut = params.statut;
  const statutColor: Record<string, string> = {
    brouillon: "#6b7280", envoye: "#2563eb", accepte: "#16a34a",
    refuse: "#dc2626", facture: "#7c3aed", annule: "#dc2626",
    paye: "#16a34a", partiel: "#d97706", en_retard: "#dc2626",
  };

  const mentionsHtml = (params.mentions ?? [
    "TVA non applicable, article 293 B du CGI (si micro-entreprise)",
    "Règlement à réception de facture. Tout retard entraîne des pénalités de 3× le taux d'intérêt légal.",
    "Garantie décennale — assurance RCP professionnelle souscrite.",
  ]).map(m => `<li style="font-size:10px;color:#9ca3af;margin-bottom:2px;">${m}</li>`).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${docLabel} ${params.numero}</title>
<style>
  ${params.custom_css ?? ""}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111827; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    @page { margin: 10mm 14mm; size: A4; }
  }
  .page { max-width: 794px; margin: 0 auto; padding: 32px 40px; }
</style>
</head>
<body>
<div class="page">

  <!-- Header band -->
  <div style="background:linear-gradient(135deg,${cp},${cs});border-radius:12px;padding:24px 28px;display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;">
    <div style="display:flex;align-items:center;gap:16px;">
      ${logoHtml}
      <div>
        <div style="font-size:20px;font-weight:700;color:#fff;">${params.artisan.prenom} ${params.artisan.nom}</div>
        ${params.artisan.siret ? `<div style="font-size:11px;color:rgba(255,255,255,0.75);margin-top:2px;">SIRET : ${params.artisan.siret}</div>` : ""}
        ${params.artisan.adresse ? `<div style="font-size:11px;color:rgba(255,255,255,0.75);">${params.artisan.adresse}</div>` : ""}
        ${params.artisan.telephone ? `<div style="font-size:11px;color:rgba(255,255,255,0.75);">${params.artisan.telephone}</div>` : ""}
        ${params.artisan.email ? `<div style="font-size:11px;color:rgba(255,255,255,0.75);">${params.artisan.email}</div>` : ""}
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:32px;font-weight:800;color:#fff;letter-spacing:-1px;">${docLabel}</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.9);margin-top:4px;">N° ${params.numero}</div>
      <div style="display:inline-block;margin-top:8px;background:${statutColor[statut] ?? ca};color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.5px;">${statut}</div>
    </div>
  </div>

  <!-- Dates + client -->
  <div style="display:flex;gap:20px;margin-bottom:24px;">
    <!-- Dates -->
    <div style="flex:1;background:#f9fafb;border-radius:8px;padding:14px 16px;">
      <div style="font-size:11px;font-weight:600;color:${cp};text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Dates</div>
      <div style="font-size:12px;color:#374151;">Date d'émission : <strong>${params.date}</strong></div>
      ${params.date_validite ? `<div style="font-size:12px;color:#374151;margin-top:4px;">Validité : <strong>${params.date_validite}</strong></div>` : ""}
      ${params.date_echeance ? `<div style="font-size:12px;color:#374151;margin-top:4px;">Échéance : <strong>${params.date_echeance}</strong></div>` : ""}
    </div>
    <!-- Client -->
    <div style="flex:1;background:#f9fafb;border-radius:8px;padding:14px 16px;">
      <div style="font-size:11px;font-weight:600;color:${cp};text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Client</div>
      <div style="font-size:13px;font-weight:700;color:#111827;">${params.client.nom}</div>
      ${params.client.adresse ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${params.client.adresse}</div>` : ""}
      ${params.client.telephone ? `<div style="font-size:11px;color:#6b7280;">${params.client.telephone}</div>` : ""}
      ${params.client.email ? `<div style="font-size:11px;color:#6b7280;">${params.client.email}</div>` : ""}
    </div>
    ${params.chantier?.nom ? `
    <!-- Chantier -->
    <div style="flex:1;background:#f9fafb;border-radius:8px;padding:14px 16px;">
      <div style="font-size:11px;font-weight:600;color:${cp};text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Chantier</div>
      <div style="font-size:13px;font-weight:700;color:#111827;">${params.chantier.nom}</div>
      ${params.chantier.adresse ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${params.chantier.adresse}</div>` : ""}
    </div>` : ""}
  </div>

  <!-- Lignes -->
  <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;margin-bottom:20px;">
    <thead>
      <tr style="background:${cp};">
        <th style="padding:11px 12px;text-align:left;font-size:12px;color:#fff;font-weight:600;">Description</th>
        <th style="padding:11px 12px;text-align:center;font-size:12px;color:#fff;font-weight:600;width:70px;">Qté</th>
        <th style="padding:11px 12px;text-align:center;font-size:12px;color:#fff;font-weight:600;width:60px;">Unité</th>
        <th style="padding:11px 12px;text-align:right;font-size:12px;color:#fff;font-weight:600;width:100px;">P.U. HT</th>
        <th style="padding:11px 12px;text-align:right;font-size:12px;color:#fff;font-weight:600;width:110px;">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${lignesHtml || `<tr><td colspan="5" style="padding:16px;text-align:center;font-size:13px;color:#9ca3af;">Aucune prestation renseignée</td></tr>`}
    </tbody>
  </table>

  <!-- Totaux -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:28px;">
    <div style="min-width:240px;background:#f9fafb;border-radius:8px;overflow:hidden;">
      <div style="display:flex;justify-content:space-between;padding:10px 16px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">
        <span>Total HT</span><span style="font-weight:600;">${fmt(params.montant_ht)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 16px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">
        <span>TVA (${params.tva}%)</span><span>${fmt(montantTVA)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px 16px;background:${cp};">
        <span style="font-size:15px;font-weight:700;color:#fff;">Total TTC</span>
        <span style="font-size:15px;font-weight:700;color:#fff;">${fmt(montantTTC)}</span>
      </div>
    </div>
  </div>

  <!-- Mentions légales -->
  <div style="border-top:1px solid #e5e7eb;padding-top:16px;">
    <div style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Mentions légales</div>
    <ul style="list-style:none;padding:0;">
      ${mentionsHtml}
    </ul>
  </div>

  <!-- Print button (hidden when printing) -->
  <div class="no-print" style="margin-top:28px;text-align:center;">
    <button onclick="window.print()" style="background:${cp};color:#fff;border:none;border-radius:8px;padding:12px 32px;font-size:15px;font-weight:600;cursor:pointer;">
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
    const { type, devis_id, facture_id } = body;

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

      // Lignes from knowledge chunks (metadata) or fallback empty
      const lignes: Array<{ description: string; quantite: number; unite: string; prix_unitaire: number }> =
        (devis as any).lignes ?? [];

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

      html = buildHtml({
        type: "facture",
        numero: facture.numero,
        date: fmtDate(facture.created_at),
        date_echeance: fmtDate(facture.date_echeance),
        artisan,
        client: { nom: client?.nom ?? "Client", adresse: client?.adresse, email: client?.email, telephone: client?.telephone },
        chantier: chantier ? { nom: chantier.nom, adresse: chantier.adresse_chantier } : undefined,
        lignes: (facture as any).lignes ?? [],
        montant_ht: Number(facture.montant_ht),
        tva: Number(facture.tva),
        statut: facture.statut,
        couleur_primaire,
        couleur_secondaire,
        couleur_accent,
        logo_url,
        secteur,
        mentions,
        custom_html: tpl?.html_template,
        custom_css: tpl?.css_template,
      });
    } else {
      return new Response(JSON.stringify({ error: "type (devis|facture) + id requis" }), { status: 400, headers: cors });
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
