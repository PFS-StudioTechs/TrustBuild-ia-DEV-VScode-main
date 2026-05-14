import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  // ── GET : récupère le devis par token public ──────────────────────────────
  if (req.method === "GET") {
    if (!token) return json({ error: "Token manquant" }, 400);

    const { data: devis, error } = await db
      .from("devis")
      .select("id, numero, statut, montant_ht, tva, date_validite, created_at, artisan_id, client_id, chantier_id")
      .eq("token_public", token)
      .single();

    if (error || !devis) return json({ error: "Devis introuvable" }, 404);

    const { data: profile } = await db
      .from("profiles")
      .select("nom, prenom, siret, email, adresse, code_postal, ville, telephone")
      .eq("user_id", (devis as any).artisan_id)
      .single();

    let client = null;
    const clientId = (devis as any).client_id;
    if (clientId) {
      const { data: cl } = await db
        .from("clients")
        .select("nom, prenom, adresse, email, telephone")
        .eq("id", clientId)
        .single();
      client = cl;
    }

    let chantier = null;
    if ((devis as any).chantier_id) {
      const { data: ch } = await db
        .from("chantiers")
        .select("nom, adresse_chantier, client_id")
        .eq("id", (devis as any).chantier_id)
        .maybeSingle();
      chantier = ch;
      if (!client && ch?.client_id) {
        const { data: cl } = await db
          .from("clients")
          .select("nom, prenom, adresse, email, telephone")
          .eq("id", ch.client_id)
          .single();
        client = cl;
      }
    }

    const { data: lignes } = await db
      .from("lignes_devis")
      .select("id, designation, quantite, unite, prix_unitaire, tva, section_nom, ordre")
      .eq("devis_id", (devis as any).id)
      .order("ordre");

    const { data: annotations } = await db
      .from("devis_annotations")
      .select("id, type, ligne_id, contenu")
      .eq("devis_id", (devis as any).id);

    return json({
      devis,
      artisan: profile ?? {},
      client,
      chantier,
      lignes: lignes ?? [],
      annotations: annotations ?? [],
    });
  }

  // ── POST : actions client (annotate / refuse / sign) ─────────────────────
  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Corps JSON invalide" }, 400);
    }

    const effectiveToken = (body.token as string | undefined) ?? token;
    if (!effectiveToken) return json({ error: "Token manquant" }, 400);

    const { data: devis } = await db
      .from("devis")
      .select("id, statut")
      .eq("token_public", effectiveToken)
      .single();

    if (!devis) return json({ error: "Devis introuvable" }, 404);

    const devisId = (devis as any).id;
    const action = body.action as string;

    if (action === "annotate") {
      const annotations = (body.annotations as unknown[]) ?? [];
      await db.from("devis_annotations").delete().eq("devis_id", devisId);
      if (annotations.length > 0) {
        await db.from("devis_annotations").insert(
          annotations.map((a: any) => ({ ...a, devis_id: devisId }))
        );
      }
      return json({ ok: true });
    }

    if (action === "refuse") {
      await db.from("devis").update({ statut: "refuse" }).eq("id", devisId);
      const comment = body.comment as string | undefined;
      if (comment?.trim()) {
        await db.from("devis_annotations").insert({
          devis_id: devisId,
          type: "refus_comment",
          contenu: comment.trim(),
        });
      }
      return json({ ok: true });
    }

    if (action === "sign") {
      const signatureData = body.signature_data as string | undefined;
      if (!signatureData) return json({ error: "Signature manquante" }, 400);
      await db.from("devis_signatures").delete().eq("devis_id", devisId);
      await db.from("devis_signatures").insert({
        devis_id: devisId,
        signature_data: signatureData,
        bon_pour_accord: (body.bon_pour_accord as string) || "Bon pour accord",
        ip_address: req.headers.get("x-forwarded-for") ?? null,
      });
      await db.from("devis").update({ statut: "signe" }).eq("id", devisId);
      return json({ ok: true });
    }

    return json({ error: "Action inconnue" }, 400);
  }

  return json({ error: "Méthode non supportée" }, 405);
});
