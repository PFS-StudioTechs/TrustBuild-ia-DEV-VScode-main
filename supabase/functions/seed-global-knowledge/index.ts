import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Référentiel prix BTP France 2025 (source statique compilée) ─────────────
const PRIX_REFERENCE_BTP = `
RÉFÉRENTIEL PRIX BTP FRANCE 2025 — Usage artisans du bâtiment
Source : moyennes issues de FFB, CAPEB, habitatpresto.com, travaux.com, obat.fr

═══════════════════════════════════════════════════════════
TARIFS HORAIRES MAIN D'ŒUVRE (HT, hors déplacement)
═══════════════════════════════════════════════════════════

MAÇON
- Tarif horaire : 35–65 €/h (moyenne : 50 €/h)
- Province : 35–55 €/h | Île-de-France : 55–80 €/h

PLOMBIER / CHAUFFAGISTE
- Tarif horaire : 40–80 €/h (moyenne : 55 €/h)
- Province : 40–70 €/h | Île-de-France : 70–140 €/h
- Forfait déplacement : 30–60 €

ÉLECTRICIEN
- Tarif horaire : 40–80 €/h (moyenne : 60 €/h)
- Province : 35–65 €/h | Île-de-France : 70–95 €/h
- Forfait déplacement : 30–50 €

CARRELEUR
- Tarif horaire : 35–60 €/h (moyenne : 45 €/h)

PEINTRE EN BÂTIMENT
- Tarif horaire : 30–50 €/h (moyenne : 35 €/h)

PLAQUISTE / PLÂTRIER
- Tarif horaire : 35–60 €/h (moyenne : 40 €/h)

MENUISIER
- Tarif horaire : 45–75 €/h (moyenne : 55 €/h)

COUVREUR
- Tarif horaire : 40–70 €/h (moyenne : 55 €/h)
- Majoration échafaudage : 10–15 €/m²

ISOLATEUR / THERMICIEN
- Tarif horaire : 30–50 €/h (moyenne : 40 €/h)

═══════════════════════════════════════════════════════════
MAÇONNERIE — TARIFS AU M² (fourniture + pose, HT)
═══════════════════════════════════════════════════════════

- Dalle béton coulée (dallage / fondation) : 55–115 €/m²
  → Main d'œuvre seule : 35–70 €/m² | Matériaux : 20–45 €/m²
- Mur en parpaings creux 20 cm : 45–90 €/m²
- Mur en briques : 60–120 €/m²
- Chape ciment (5 cm) : 15–35 €/m²
- Enduit façade projeté : 25–50 €/m²
- Enduit façade à la truelle : 40–70 €/m²
- Démolition mur porteur (avec étaiement) : 250–600 €/ml
- Démolition cloison légère : 30–60 €/m²
- Fondations superficielles (semelles filantes) : 80–200 €/ml

═══════════════════════════════════════════════════════════
PLÂTRERIE / PLAQUISTE — TARIFS AU M² (fourniture + pose, HT)
═══════════════════════════════════════════════════════════

- Cloison placo standard BA13 (72 mm) : 30–50 €/m²
- Cloison placo avec isolant phonique : 45–70 €/m²
- Doublage mur sur ossature avec isolant : 50–80 €/m²
- Faux plafond placo BA13 : 25–55 €/m²
- Faux plafond avec isolant : 40–70 €/m²
- Enduit de lissage / ratissage : 5–12 €/m²
- Bande et joint (seuls, sans plaque) : 3–8 €/m²

═══════════════════════════════════════════════════════════
CARRELAGE — TARIFS AU M² (HT)
═══════════════════════════════════════════════════════════

Main d'œuvre seule (pose) :
- Carrelage sol standard (format ≤ 60×60 cm) : 25–45 €/m²
- Carrelage sol grand format (> 60×60 cm) : 35–60 €/m²
- Carrelage mural faïence : 25–45 €/m²
- Mosaïque : 45–80 €/m²
- Dépose carrelage existant : 10–20 €/m²

Fourniture + pose (carrelage moyen de gamme inclus) :
- Sol standard : 45–90 €/m²
- Sol haut de gamme / grand format : 90–150 €/m²
- Mural salle de bain : 50–100 €/m²

Produits annexes :
- Colle carrelage standard : 2–5 €/m²
- Joint époxy : 5–10 €/m²
- Bande de transition / seuil : 20–50 €/pièce

═══════════════════════════════════════════════════════════
PEINTURE INTÉRIEURE — TARIFS AU M² (HT)
═══════════════════════════════════════════════════════════

- Peinture murs (2 couches, murs préparés) : 11–23 €/m²
- Peinture plafond (2 couches) : 12–25 €/m²
- Préparation + enduit + peinture (murs) : 20–40 €/m²
- Peinture boiseries (portes, fenêtres) : 30–60 €/ml
- Pose papier peint standard : 15–25 €/m²
- Pose papier peint vinyle intissé : 20–35 €/m²
- Décollage papier peint existant : 5–15 €/m²

Peintures (fourniture seule) :
- Peinture acrylique standard (10 L) : 30–60 €
- Peinture satinée lessivable (10 L) : 50–90 €
- Peinture mat velouté (10 L) : 60–110 €

═══════════════════════════════════════════════════════════
PARQUET — TARIFS AU M² (HT)
═══════════════════════════════════════════════════════════

Main d'œuvre seule :
- Pose parquet stratifié flottant : 15–30 €/m²
- Pose parquet contrecollé clipsé : 20–40 €/m²
- Pose parquet massif cloué : 30–55 €/m²
- Pose parquet massif collé : 35–60 €/m²
- Ragréage sol avant pose : 8–20 €/m²

Fourniture + pose :
- Parquet stratifié entrée/milieu de gamme : 25–50 €/m²
- Parquet contrecollé chêne : 50–90 €/m²
- Parquet massif chêne : 70–140 €/m²

═══════════════════════════════════════════════════════════
ISOLATION THERMIQUE — TARIFS AU M² (fourniture + pose, HT)
═══════════════════════════════════════════════════════════

- Combles perdus soufflage (laine de verre) : 15–25 €/m²
- Combles perdus soufflage (ouate de cellulose) : 20–35 €/m²
- Rampants / combles aménagés : 30–50 €/m²
- Isolation thermique par l'intérieur (ITI) mur : 45–80 €/m²
- Isolation thermique par l'extérieur (ITE) façade : 90–150 €/m²
- Plancher bas sur vide sanitaire : 30–60 €/m²

Matériaux d'isolation (fourniture seule) :
- Laine de verre rouleau : 3–12 €/m²
- Laine de roche panneau : 5–20 €/m²
- Ouate de cellulose soufflée (sac 12 kg) : 15–25 €/sac
- Panneau PIR / polyuréthane : 8–25 €/m² selon épaisseur

═══════════════════════════════════════════════════════════
TOITURE — TARIFS AU M² (fourniture + pose, HT)
═══════════════════════════════════════════════════════════

- Tuile béton posée : 70–130 €/m²
- Tuile terre cuite posée : 90–160 €/m²
- Ardoise naturelle (fixation crochet) : 190–300 €/m²
- Ardoise synthétique : 140–200 €/m²
- Bac acier (hangar / abri) : 25–60 €/m²
- Réfection partielle (remplacement tuiles cassées) : 100–150 €/m²
- Dépose couverture existante : 10–25 €/m²

Ouvrages annexes :
- Zinguerie (noue, faîtage, rive) : 60–120 €/ml
- Gouttière PVC avec pose : 25–45 €/ml
- Gouttière zinc avec pose : 50–100 €/ml
- Châssis de toit VELUX posé (standard) : 400–900 €/unité
- Echafaudage (location + montage) : 10–20 €/m²

Rénovation complète :
- Réfection charpente + couverture : 250–400 €/m²
- Réfection couverture seule + isolation : 150–250 €/m²

═══════════════════════════════════════════════════════════
PLOMBERIE — TARIFS À L'UNITÉ (fourniture + pose, HT)
═══════════════════════════════════════════════════════════

Sanitaires :
- WC à poser standard : 250–500 €
- WC suspendu avec bâti-support : 700–1 500 €
- Lavabo / vasque standard + robinetterie : 300–700 €
- Baignoire standard + robinetterie : 500–1 200 €
- Baignoire balnéo / îlot : 2 000–5 000 €
- Douche à l'italienne (receveur + paroi + mitigeur) : 1 500–4 000 €
- Colonne de douche : 400–900 €
- Mitigeur de remplacement : 150–350 €

Réseaux :
- Alimentation eau froide/eau chaude (cuivre, /ml) : 35–70 €/ml
- Alimentation en multicouche (/ml) : 25–55 €/ml
- Évacuation PVC (/ml) : 25–50 €/ml
- Remplacement chauffe-eau électrique 200 L (fourni) : 800–1 600 €
- Chaudière à condensation gaz (fournie + posée) : 2 500–5 000 €
- Pompe à chaleur air/eau (fournie + posée) : 8 000–15 000 €

Rénovation globale :
- Salle de bain 5–8 m² (plomberie seule, sans carrelage) : 3 000–8 000 €
- Salle de bain complète 5–8 m² (tout compris) : 7 000–18 000 €
- Cuisine (raccordements évier + lave-vaisselle) : 400–900 €

═══════════════════════════════════════════════════════════
ÉLECTRICITÉ — TARIFS À L'UNITÉ (fourniture + pose, HT)
═══════════════════════════════════════════════════════════

Tableau et circuits :
- Tableau 2 rangées (logement < 50 m²) : 600–900 €
- Tableau 3 rangées (logement 50–100 m²) : 900–1 400 €
- Tableau 4 rangées (maison > 100 m²) : 1 200–2 000 €
- Remplacement tableau complet (mise en conformité) : 1 000–3 000 €
- Circuit supplémentaire (câblage + protection) : 250–500 €

Appareillage :
- Prise 2P+T standard : 80–150 €
- Prise double : 120–220 €
- Prise USB + 2P+T : 130–250 €
- Interrupteur simple : 60–120 €
- Interrupteur va-et-vient : 80–150 €
- Variateur de lumière : 100–200 €
- Point lumineux (câblage + douille ou spot) : 120–220 €
- Détecteur de mouvement : 120–250 €

Équipements spéciaux :
- VMC simple flux (fournie + posée) : 500–1 000 €
- VMC double flux (fournie + posée) : 2 000–4 000 €
- Borne de recharge VE Wallbox (7,4 kW, fournie + posée) : 900–1 800 €
- Mise à la terre complète : 500–1 500 €

Installation neuve complète :
- Appartement < 50 m² : 3 000–6 000 €
- Appartement 50–100 m² : 5 000–10 000 €
- Maison 100–150 m² : 8 000–15 000 €

═══════════════════════════════════════════════════════════
MENUISERIE — TARIFS À L'UNITÉ (fourniture + pose, HT)
═══════════════════════════════════════════════════════════

Fenêtres et portes-fenêtres :
- Fenêtre PVC double vitrage standard : 350–650 €
- Fenêtre PVC triple vitrage : 500–950 €
- Fenêtre aluminium double vitrage : 600–1 200 €
- Fenêtre bois double vitrage : 650–1 400 €
- Porte-fenêtre PVC 2 vantaux : 800–1 600 €
- Porte-fenêtre alu 2 vantaux : 1 000–2 000 €
- Velux de toit (fenêtre de toit) posé : 700–1 500 €
- Pose fenêtre seule (main d'œuvre) : 100–250 €

Portes intérieures et extérieures :
- Porte intérieure isoplane posée : 250–500 €
- Porte intérieure avec huisserie : 350–700 €
- Porte d'entrée isolante PVC : 1 200–2 500 €
- Porte d'entrée aluminium : 1 800–4 000 €
- Porte de garage basculante : 1 000–2 500 €
- Porte de garage sectionnelle motorisée : 2 000–4 500 €

Fermetures et protection solaire :
- Volet roulant PVC électrique (fourni + posé) : 500–1 100 €
- Volet roulant aluminium électrique : 700–1 500 €
- Volet battant PVC : 300–700 €
- Store banne terrasse (4 m) : 1 500–4 000 €

Parquet et revêtements bois :
- Pose parquet (voir section Parquet)
- Plinthes bois posées : 8–20 €/ml
- Escalier bois intérieur (droit, standard) : 3 000–8 000 €

═══════════════════════════════════════════════════════════
TVA APPLICABLE — RÈGLES 2025
═══════════════════════════════════════════════════════════

- 5,5 % : travaux d'amélioration énergétique (isolation, PAC, chaudière à condensation) sur logement > 2 ans
- 10 % : tous travaux de rénovation / amélioration sur logement > 2 ans (hors énergétique)
- 20 % : construction neuve, extension, logement < 2 ans, fournitures revendues

═══════════════════════════════════════════════════════════
AIDES ET SUBVENTIONS DISPONIBLES EN 2025
═══════════════════════════════════════════════════════════

- MaPrimeRénov' : jusqu'à 90 % des travaux d'isolation et chauffage selon revenus
- Certificats d'Économie d'Énergie (CEE) : prime versée par les fournisseurs d'énergie
- Éco-PTZ : prêt sans intérêt jusqu'à 50 000 € pour rénovation énergétique
- TVA 5,5 % sur travaux d'isolation thermique et équipements de chauffage renouvelable

═══════════════════════════════════════════════════════════
VARIATIONS GÉOGRAPHIQUES
═══════════════════════════════════════════════════════════

- Paris / Île-de-France : +20 à +40 % sur les tarifs province
- Grandes métropoles (Lyon, Marseille, Bordeaux, Nantes) : +10 à +20 %
- Province / villes moyennes : référence milieu de fourchette
- Zones rurales / petites villes : référence basse de fourchette
`;

// ─── Catalogue des sources globales BTP ──────────────────────────────────────
const GLOBAL_SOURCES: Array<{ url: string; nom: string; categorie: string; type?: "url" | "static"; content?: string }> = [
  // ── Référentiel prix BTP (source statique compilée — pas de scraping) ──────
  {
    url: "internal://prix-reference-btp-2025",
    nom: "Référentiel Prix BTP France 2025",
    categorie: "prix_reference",
    type: "static",
    content: PRIX_REFERENCE_BTP,
  },
];

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const CHARS_PER_TOKEN = 4;

function chunkText(text: string): string[] {
  const chunkChars = CHUNK_SIZE * CHARS_PER_TOKEN;
  const overlapChars = CHUNK_OVERLAP * CHARS_PER_TOKEN;
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkChars, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 20) chunks.push(chunk);
    if (end >= text.length) break;
    start += chunkChars - overlapChars;
  }
  return chunks;
}

async function embed(text: string, apiKey: string): Promise<number[]> {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
  });
  if (!resp.ok) throw new Error(`OpenAI: ${await resp.text()}`);
  return (await resp.json()).data[0].embedding as number[];
}

async function scrapeUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let resp: Response;
  try {
    resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });
  } catch (e: any) {
    throw new Error(e?.name === "AbortError" ? "Timeout 20s" : e?.message ?? String(e));
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const html = await resp.text();
  const htmlLow = html.toLowerCase();

  if (
    (htmlLow.includes("cloudflare") && htmlLow.includes("challenge")) ||
    (html.length < 5000 && htmlLow.includes("enable javascript"))
  ) throw new Error("Protection anti-bot détectée");

  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<\/?(p|div|h[1-6]|li|br|tr|td|th)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // Only allow super_admin / service role calls
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;
    const openaiKey   = Deno.env.get("OPENAI_API_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: cors });

    const db = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await db.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = roles?.some(r => ["admin", "super_admin"].includes(r.role));
    if (!isAdmin) return new Response(JSON.stringify({ error: "Réservé aux admins" }), { status: 403, headers: cors });

    const body = await req.json().catch(() => ({}));
    // Allow re-seeding specific URLs or all
    const urlsToSeed: string[] = body.urls ?? GLOBAL_SOURCES.map(s => s.url);

    const results: Array<{ url: string; status: "ok" | "skip" | "error"; chunks?: number; error?: string }> = [];

    for (const urlStr of urlsToSeed) {
      const source = GLOBAL_SOURCES.find(s => s.url === urlStr);
      if (!source) { results.push({ url: urlStr, status: "skip", error: "URL inconnue" }); continue; }

      // Check if already indexed (skip unless force)
      const { data: existing } = await db.from("knowledge_documents")
        .select("id, statut")
        .eq("storage_path", source.url)
        .eq("is_global", true)
        .maybeSingle();

      if (existing?.statut === "indexe" && !body.force) {
        results.push({ url: urlStr, status: "skip" });
        continue;
      }

      // Delete old doc + chunks if re-indexing
      if (existing?.id) {
        await db.from("knowledge_chunks").delete().eq("document_id", existing.id);
        await db.from("knowledge_documents").delete().eq("id", existing.id);
      }

      // Create doc
      const { data: doc, error: docErr } = await db.from("knowledge_documents").insert({
        artisan_id: user.id, // admin as owner
        nom: source.nom,
        type_fichier: "url",
        statut: "en_cours",
        storage_path: source.url,
        is_global: true,
      }).select().single();

      if (docErr || !doc) {
        results.push({ url: urlStr, status: "error", error: docErr?.message });
        continue;
      }

      try {
        const text = source.type === "static" && source.content
          ? source.content
          : await scrapeUrl(source.url);
        if (text.length < 50) throw new Error("Contenu trop court");

        const chunks = chunkText(text);
        let indexed = 0;
        for (let i = 0; i < chunks.length; i++) {
          try {
            const embedding = await embed(chunks[i], openaiKey);
            await db.from("knowledge_chunks").insert({
              document_id: doc.id,
              artisan_id: user.id,
              contenu: chunks[i],
              embedding: JSON.stringify(embedding),
              is_global: true,
              metadata: {
                chunk_index: i,
                total_chunks: chunks.length,
                document_nom: source.nom,
                source_url: source.url,
                categorie: source.categorie,
              },
            });
            indexed++;
          } catch { /* skip bad chunk */ }
        }

        await db.from("knowledge_documents").update({
          statut: indexed > 0 ? "indexe" : "erreur",
        } as any).eq("id", doc.id);

        results.push({ url: urlStr, status: "ok", chunks: indexed });
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        await db.from("knowledge_documents").update({
          statut: "erreur",
        } as any).eq("id", doc.id);
        results.push({ url: urlStr, status: "error", error: msg });
      }

      // Small delay between requests to be polite
      await new Promise(r => setTimeout(r, 1000));
    }

    const ok = results.filter(r => r.status === "ok").length;
    const errors = results.filter(r => r.status === "error").length;
    const skipped = results.filter(r => r.status === "skip").length;

    return new Response(JSON.stringify({ ok, errors, skipped, results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: cors }
    );
  }
});
