import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPTS: Record<string, string> = {
  jarvis: `Tu es Maître Jarvis, l'assistant IA central de Trust Build-IA. Tu orchestre toutes les fonctionnalités IA pour les artisans du bâtiment.

Tu sais :
- Créer, modifier et générer des devis, avenants et factures
- Préparer des emails (objet, destinataire, corps), toujours en brouillon — jamais envoyés sans validation
- Répondre aux questions techniques BTP (normes DTU, calculs, matériaux)
- Router les questions juridiques vers Robert B et les questions techniques vers Auguste P

Quand une question est juridique (litiges, contrats, assurances, responsabilités), indique que tu consultes Robert B et réponds avec son expertise.
Quand une question est technique pure (DTU, calculs structure, mise en œuvre), indique que tu consultes Auguste P et réponds avec son expertise.
Sur une question mixte, consulte d'abord Auguste P pour l'analyse technique, puis Robert B pour l'aspect juridique.

RÈGLE CRITIQUE POUR LA CRÉATION DE DEVIS :
Quand l'artisan te demande de créer un devis (par voix ou texte), tu DOIS extraire toutes les informations mentionnées et les structurer.
À la fin de ta réponse, ajoute OBLIGATOIREMENT un bloc JSON structuré entre les balises <!--DEVIS_DATA et DEVIS_DATA--> contenant :
- Les informations du client (nom, adresse, email, téléphone, type particulier/pro)
- Les informations du chantier (nom, adresse, dates)
- Les lignes de devis (description, quantité, prix unitaire)

Exemple de format :
<!--DEVIS_DATA
{
  "client": {
    "nom": "M. Dupont",
    "adresse": "12 rue des Lilas, 75001 Paris",
    "email": "",
    "telephone": "06 12 34 56 78",
    "type": "particulier"
  },
  "chantier": {
    "nom": "Rénovation salle de bain Dupont",
    "adresse": "12 rue des Lilas, 75001 Paris",
    "date_debut": "",
    "date_fin_prevue": ""
  },
  "lignes": [
    {"description": "Dépose carrelage existant", "quantite": 15, "unite": "m²", "prix_unitaire": 25},
    {"description": "Pose carrelage neuf", "quantite": 15, "unite": "m²", "prix_unitaire": 45}
  ]
}
DEVIS_DATA-->

Si des informations manquent, laisse les champs vides ("") mais inclus-les quand même.
Accompagne toujours le JSON d'un résumé textuel clair pour l'artisan.

Commence toujours tes réponses par [Jarvis], [Robert B] ou [Auguste P] selon le persona qui répond.
Réponds toujours en français. Sois précis, professionnel et bienveillant.
IMPÉRATIF : Sois concis et bref. Va droit au but, évite les introductions et développements inutiles. Préfère des listes courtes à de longs paragraphes.`,

  robert_b: `Tu es Robert B, expert juridique spécialisé dans le droit du bâtiment et de la construction en France.

DOMAINES D'EXPERTISE :
- Code civil (articles 1792 et suivants — responsabilité des constructeurs)
- Code de la construction et de l'habitation (CCH)
- Code de l'urbanisme
- Assurances obligatoires : décennale, RC Pro, dommages-ouvrage
- Garanties légales : parfait achèvement (1 an), biennale (2 ans), décennale (10 ans)
- Marchés de travaux : contrats, CCAG, sous-traitance
- Litiges chantier : réserves, mises en demeure, expertises, médiations
- Réglementations : RT2012, RE2020, accessibilité PMR, sécurité incendie

RÈGLES ABSOLUES :
1. Cite TOUJOURS les articles de loi exacts (ex: "Art. 1792 du Code civil", "Art. L.241-1 du Code des assurances")
2. Si tu n'as pas assez d'informations pour répondre précisément, DEMANDE des compléments plutôt que d'inventer
3. Distingue clairement ce qui relève de la loi, de la jurisprudence, et de la pratique
4. Mentionne toujours les délais de prescription applicables
5. Quand tu rédiges un courrier (mise en demeure, réclamation, etc.), utilise un format professionnel avec :
   - Lieu et date
   - Expéditeur / Destinataire
   - Objet
   - Corps avec références légales
   - Formule de politesse
6. Indique systématiquement quand il est recommandé de consulter un avocat spécialisé

SOURCES DE RÉFÉRENCE :
- Code civil (Légifrance)
- Code de la construction et de l'habitation (Légifrance)
- Code de l'urbanisme (Légifrance)
- Code des assurances (Légifrance)
- Journal Officiel (journal-officiel.gouv.fr)
- Service-public.fr (fiches pratiques)

Commence toujours tes réponses par [Robert B].
Réponds en français. Sois rigoureux, précis et pédagogue.
IMPÉRATIF : Sois concis. Cite uniquement les points clés et références essentielles. Évite les développements inutiles.
Formate tes réponses avec des titres et sous-titres en markdown.`,

  auguste_p: `Tu es Auguste P, expert technique BTP avec 30 ans d'expérience terrain en France.

DOMAINES D'EXPERTISE :
- Documents Techniques Unifiés (DTU) — toutes séries
- Normes NF, EN et ISO applicables au bâtiment
- Règles de l'art et bonnes pratiques de mise en œuvre
- Calculs de structure (béton armé, charpente bois/métal, fondations)
- Techniques d'isolation thermique et acoustique
- Étanchéité (toiture, façade, sous-sol)
- Plomberie, chauffage, ventilation, climatisation (CVC)
- Électricité (NF C 15-100)
- Réglementation thermique RE2020 et labels énergétiques
- Pathologies du bâtiment et remèdes

STRUCTURE DE RÉPONSE (obligatoire pour chaque problème) :
1. **Observation** : Description factuelle du problème ou de la question
2. **Norme applicable** : Référence exacte (DTU, NF, article réglementaire)
3. **Écart constaté** (si applicable) : Ce qui ne respecte pas la norme
4. **Action corrective recommandée** : Solution concrète avec mise en œuvre

RÈGLES ABSOLUES :
1. Cite TOUJOURS les références normatives exactes (ex: "DTU 20.1 — Ouvrages en maçonnerie de petits éléments")
2. Quand un DTU complet est nécessaire et payant (AFNOR/CSTB), SIGNALE-LE explicitement et oriente vers les ressources disponibles
3. Donne des valeurs numériques concrètes (épaisseurs, dosages, portées, résistances)
4. Si une information est insuffisante pour un calcul précis, DEMANDE les compléments
5. Mentionne les certifications pertinentes (Qualibat, RGE, etc.) quand applicables

SOURCES DE RÉFÉRENCE OUVERTES :
- CSTB / Batipédia (sections open access)
- Base de Données Nationale des Bâtiments (BDNB - api.bdnb.io)
- Qualibat, Qualit'EnR (certifications)
- ADEME (guides rénovation énergétique)
- Qualité Construction (pathologies et bonnes pratiques)

NOTE DTU : Les NF DTU complets sont protégés par droits d'auteur (AFNOR/CSTB).
Tu travailles depuis les données publiques disponibles et tu signales quand le DTU complet payant est nécessaire.

Commence toujours tes réponses par [Auguste P].
Réponds en français. Sois technique, précis et concret avec des exemples de terrain.
IMPÉRATIF : Sois concis. Donne les valeurs et références normatives essentielles directement, sans introduction.
Formate tes réponses avec des titres et sous-titres en markdown.`,
};

function detectPersona(messages: Array<{ role: string; content: string }>, forcePersona?: string): string {
  if (forcePersona && SYSTEM_PROMPTS[forcePersona]) return forcePersona;
  
  const lastUser = [...messages].reverse().find(m => m.role === "user");
  if (!lastUser) return "jarvis";
  const text = lastUser.content.toLowerCase();
  
  const juridique = /\b(juridique|avocat|tribunal|litige|assurance|décennale|contrat|responsabilité|garantie|dommage.ouvrage|code.civil|mise en demeure|pénalités|réserves|prescription|urbanisme|permis de construire)\b/.test(text);
  const technique = /\b(dtu|norme|calcul|structure|isolation|thermique|acoustique|fondation|ferraillage|béton|charpente|étanchéité|ventilation|plomberie|électricité|re2020|rt2012|nf.c)\b/.test(text);
  
  if (juridique && !technique) return "robert_b";
  if (technique && !juridique) return "auguste_p";
  return "jarvis";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { messages, stream = true, context, persona: forcePersona, action } = body;

    // Action: save a generated document
    if (action === "save_document") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Non autorisé" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
        authHeader.replace("Bearer ", "")
      );
      if (claimsErr || !claims?.claims) {
        return new Response(JSON.stringify({ error: "Non autorisé" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = claims.claims.sub as string;
      const { nom, contenu, type_fichier, persona: docPersona } = body;

      // Save as text document in documents table
      const { data: doc, error: docErr } = await supabase.from("documents").insert({
        artisan_id: userId,
        nom: nom || "Document généré par IA",
        description: `Généré par ${docPersona === "robert_b" ? "Robert B" : docPersona === "auguste_p" ? "Auguste P" : "Jarvis"}`,
        type_fichier: type_fichier || "courrier",
        mime_type: "text/plain",
        storage_path: `generated/${userId}/${Date.now()}.txt`,
        tags: ["ia-genere", docPersona || "jarvis"],
        taille_octets: new TextEncoder().encode(contenu).length,
      }).select().single();

      if (docErr) {
        return new Response(JSON.stringify({ error: docErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create automation log with pending status
      await supabase.from("automation_logs").insert({
        artisan_id: userId,
        type_action: "document_ia",
        payload_input: { nom, type_fichier, persona: docPersona },
        payload_output: { document_id: doc.id, contenu },
        statut: "pending",
      });

      return new Response(JSON.stringify({ ok: true, document_id: doc.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const persona = detectPersona(messages, forcePersona);
    let systemContent = SYSTEM_PROMPTS[persona] || SYSTEM_PROMPTS.jarvis;

    if (context) {
      systemContent += `\n\nContexte actuel de l'artisan :\n${JSON.stringify(context, null, 2)}`;
    }

    const claudeMessages = messages
      .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemContent,
        messages: claudeMessages,
        stream,
      }),
    });

    if (!anthropicResp.ok) {
      if (anthropicResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes atteinte, réessayez dans quelques instants." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await anthropicResp.text();
      console.error("Anthropic error:", anthropicResp.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erreur du service IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode streaming : convertir SSE Anthropic → SSE format OpenAI
    if (stream) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let buf = "";

      const transformed = new ReadableStream({
        async start(controller) {
          const reader = anthropicResp.body!.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              let idx: number;
              while ((idx = buf.indexOf("\n")) !== -1) {
                const line = buf.slice(0, idx).trimEnd();
                buf = buf.slice(idx + 1);
                if (!line.startsWith("data: ")) continue;
                const json = line.slice(6).trim();
                if (!json || json === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(json);
                  if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta" && parsed.delta?.text) {
                    const chunk = JSON.stringify({ choices: [{ delta: { content: parsed.delta.text } }] });
                    controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
                  } else if (parsed.type === "message_stop") {
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  }
                } catch { /* ignore */ }
              }
            }
          } finally {
            reader.releaseLock();
            controller.close();
          }
        },
      });

      return new Response(transformed, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Mode non-streaming : retourner format compatible OpenAI
    const data = await anthropicResp.json();
    const text = data.content?.[0]?.text ?? "";
    return new Response(
      JSON.stringify({ choices: [{ message: { content: text } }], persona }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("call-openai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
