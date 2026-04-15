import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------------------------------------------------------------------------
// System prompts (identiques à call-openai)
// ---------------------------------------------------------------------------

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
Quand l'artisan te demande de créer un devis (par voix ou texte), tu DOIS extraire les informations de LA DEMANDE ACTUELLE UNIQUEMENT.
IMPORTANT : N'utilise JAMAIS les informations (client, chantier, lignes) des échanges précédents de la conversation. Chaque demande de devis est indépendante. Si un champ n'est pas mentionné dans le message actuel, laisse-le vide ("").
N'invente PAS d'email ou de téléphone — laisse ces champs vides ("") s'ils ne sont pas explicitement fournis.

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
    "telephone": "",
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

Si des informations manquent dans la demande actuelle, laisse les champs vides ("") — ne les invente pas.
Accompagne toujours le JSON d'un résumé textuel clair pour l'artisan.

Commence toujours tes réponses par [Jarvis], [Robert B] ou [Auguste P] selon le persona qui répond.
Réponds toujours en français. Sois précis, professionnel et bienveillant.`,

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
5. Quand tu rédiges un courrier (mise en demeure, réclamation, etc.), utilise un format professionnel
6. Indique systématiquement quand il est recommandé de consulter un avocat spécialisé

Commence toujours tes réponses par [Robert B].
Réponds en français. Sois rigoureux, précis et pédagogue.
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
1. Cite TOUJOURS les références normatives exactes
2. Donne des valeurs numériques concrètes (épaisseurs, dosages, portées, résistances)
3. Si une information est insuffisante pour un calcul précis, DEMANDE les compléments
4. Mentionne les certifications pertinentes (Qualibat, RGE, etc.) quand applicables

Commence toujours tes réponses par [Auguste P].
Réponds en français. Sois technique, précis et concret avec des exemples de terrain.
Formate tes réponses avec des titres et sous-titres en markdown.`,
};

// ---------------------------------------------------------------------------
// Détection de persona
// ---------------------------------------------------------------------------

function detectPersona(
  messages: Array<{ role: string; content: string }>,
  forcePersona?: string
): string {
  if (forcePersona && SYSTEM_PROMPTS[forcePersona]) return forcePersona;

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "jarvis";
  const text = lastUser.content.toLowerCase();

  const juridique =
    /\b(juridique|avocat|tribunal|litige|assurance|décennale|contrat|responsabilité|garantie|dommage.ouvrage|code.civil|mise en demeure|pénalités|réserves|prescription|urbanisme|permis de construire)\b/.test(
      text
    );
  const technique =
    /\b(dtu|norme|calcul|structure|isolation|thermique|acoustique|fondation|ferraillage|béton|charpente|étanchéité|ventilation|plomberie|électricité|re2020|rt2012|nf.c)\b/.test(
      text
    );

  if (juridique && !technique) return "robert_b";
  if (technique && !juridique) return "auguste_p";
  return "jarvis";
}

// ---------------------------------------------------------------------------
// Recherche RAG dans la base de connaissances
// ---------------------------------------------------------------------------

async function searchKnowledge(
  question: string,
  artisanId: string,
  openaiKey: string,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  try {
    // Génère l'embedding de la question
    const embResp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: question.slice(0, 8000),
      }),
    });

    if (!embResp.ok) return "";

    const embJson = await embResp.json();
    const embedding: number[] = embJson.data[0].embedding;

    const { data: chunks } = await supabase.rpc("search_knowledge_chunks", {
      p_artisan_id: artisanId,
      p_embedding: JSON.stringify(embedding),
      p_limit: 5,
    });

    if (!chunks || chunks.length === 0) return "";

    // Filtre les chunks avec une similarité > 0.3
    const relevant = chunks.filter(
      (c: { similarity: number }) => c.similarity > 0.3
    );
    if (relevant.length === 0) return "";

    const context = relevant
      .map(
        (c: { contenu: string; metadata: { document_nom?: string } }, i: number) =>
          `[Extrait ${i + 1} — ${c.metadata?.document_nom ?? "document"}]\n${c.contenu}`
      )
      .join("\n\n---\n\n");

    return context;
  } catch (e) {
    console.error("searchKnowledge error:", e);
    return "";
  }
}

// ---------------------------------------------------------------------------
// Transform Anthropic SSE → OpenAI SSE (pour compatibilité frontend)
// ---------------------------------------------------------------------------

function anthropicToOpenAiSse(anthropicStream: ReadableStream): ReadableStream {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let buffer = "";

  return new ReadableStream({
    async start(controller) {
      const reader = anthropicStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).trimEnd();
            buffer = buffer.slice(idx + 1);

            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]" || json === "") continue;

            try {
              const parsed = JSON.parse(json);
              if (
                parsed.type === "content_block_delta" &&
                parsed.delta?.type === "text_delta" &&
                parsed.delta?.text
              ) {
                const oaiChunk = JSON.stringify({
                  choices: [{ delta: { content: parsed.delta.text } }],
                });
                controller.enqueue(encoder.encode(`data: ${oaiChunk}\n\n`));
              } else if (parsed.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              // Ligne non-JSON, on ignore
            }
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      messages,
      stream = true,
      context,
      persona: forcePersona,
      action,
    } = body;

    // -----------------------------------------------------------------------
    // Action : sauvegarde d'un document généré par l'IA
    // -----------------------------------------------------------------------
    if (action === "save_document") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Non autorisé" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        return new Response(JSON.stringify({ error: "Non autorisé" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { nom, contenu, type_fichier, persona: docPersona } = body;

      const { data: doc, error: docErr } = await supabase
        .from("documents")
        .insert({
          artisan_id: user.id,
          nom: nom || "Document généré par IA",
          description: `Généré par ${
            docPersona === "robert_b"
              ? "Robert B"
              : docPersona === "auguste_p"
              ? "Auguste P"
              : "Jarvis"
          }`,
          type_fichier: type_fichier || "courrier",
          mime_type: "text/plain",
          storage_path: `generated/${user.id}/${Date.now()}.txt`,
          tags: ["ia-genere", docPersona || "jarvis"],
          taille_octets: new TextEncoder().encode(contenu).length,
        })
        .select()
        .single();

      if (docErr) {
        return new Response(JSON.stringify({ error: docErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("automation_logs").insert({
        artisan_id: user.id,
        type_action: "document_ia",
        payload_input: { nom, type_fichier, persona: docPersona },
        payload_output: { document_id: doc.id, contenu },
        statut: "pending",
      });

      return new Response(JSON.stringify({ ok: true, document_id: doc.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -----------------------------------------------------------------------
    // Chat : génération de réponse via Claude
    // -----------------------------------------------------------------------
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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

    // Recherche RAG — injecte le contexte si des chunks pertinents existent
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const openaiKey = Deno.env.get("OPENAI_API_KEY");
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();

        if (user && openaiKey) {
          const lastQuestion =
            [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

          const knowledgeContext = await searchKnowledge(
            lastQuestion,
            user.id,
            openaiKey,
            supabase
          );

          if (knowledgeContext) {
            systemContent += `\n\n---\n## Informations de ta base de connaissances personnelle\nUtilise en priorité les extraits suivants pour répondre à la question de l'artisan :\n\n${knowledgeContext}\n---`;
          }
        }
      } catch (e) {
        // Le RAG échoue silencieusement — on répond quand même
        console.error("RAG error (non-fatal):", e);
      }
    }

    // Filtre les messages pour ne garder que user/assistant (Claude n'accepte pas system dans messages)
    const claudeMessages = messages
      .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
      .map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const anthropicResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
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
      }
    );

    if (!anthropicResponse.ok) {
      if (anthropicResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Limite de requêtes atteinte, réessayez dans quelques instants.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await anthropicResponse.text();
      console.error("Anthropic error:", anthropicResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (stream) {
      const transformedStream = anthropicToOpenAiSse(anthropicResponse.body!);
      return new Response(transformedStream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Mode non-streaming
    const data = await anthropicResponse.json();
    const text = data.content?.[0]?.text ?? "";
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: text } }],
        persona,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("call-claude error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Erreur inconnue",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
