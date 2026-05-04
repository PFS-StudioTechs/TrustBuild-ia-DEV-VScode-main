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
  jarvis: `Tu es Maître Jarvis, l'assistant IA central de TrustBuild-IA. Tu orchestre toutes les fonctionnalités IA pour les artisans du bâtiment.

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
IMPORTANT : N'utilise JAMAIS les informations (client, lignes) des échanges précédents de la conversation. Chaque demande de devis est indépendante. Si un champ n'est pas mentionné dans le message actuel, laisse-le vide ("").
N'invente PAS d'email ou de téléphone — laisse ces champs vides ("") s'ils ne sont pas explicitement fournis.

RÈGLE CLIENT EXISTANT :
Si une liste de clients existants est fournie dans le contexte (section "Clients existants de l'artisan"), cherche les correspondances avec le client mentionné dans la demande.
IMPORTANT : la correspondance doit porter sur NOM + PRÉNOM ensemble, jamais sur le nom seul.
- Un client existant n'est considéré comme correspondant QUE si son nom ET son prénom correspondent tous les deux au client demandé.
- Si seul le nom correspond (ex: deux "PIERRE" différents), NE mets pas de client_matches — génère un nouveau client.
- Si la correspondance est certaine (nom + prénom identiques), mets l'id dans "client.id" et inclus le client dans client_matches.
- Si plusieurs clients ont nom + prénom identiques (homonymes), liste-les tous dans client_matches et laisse client.id vide — le formulaire proposera à l'artisan de choisir.
- Convention de découpage : pour un nom complet comme "PIERRE Boussico", le premier mot est le prénom, le dernier mot est le nom de famille. Exemple : "PIERRE Boussico" → prenom="PIERRE", nom="Boussico".

RÈGLE CHANTIER EXISTANT :
Si une liste de chantiers existants est fournie dans le contexte (section "Chantiers existants de l'artisan"), cherche les correspondances avec le chantier mentionné dans la demande (par nom, lieu, type de travaux, client associé). Inclus dans DEVIS_DATA un tableau "chantier_matches" avec les chantiers correspondants (max 3, en priorité ceux du client identifié). Si la correspondance est certaine, mets l'id dans "chantier.id". Si aucun chantier existant ne correspond mais qu'un chantier est mentionné dans la demande, laisse "chantier.id" vide et remplis "chantier.nom". Si aucun chantier n'est mentionné dans la demande, mets "chantier" à null et laisse "chantier_matches" vide.

RÈGLE SECTIONS (détection automatique dans la dictée) :
Quand l'artisan organise sa demande par sections (mots-clés : "section", "rubrique", "partie", "catégorie" — et leurs variantes phonétiques ou erreurs de dictée : "sélection", "séction", "sestion", "selection"), associe chaque ligne à sa section.
- Chaque ligne doit inclure un champ "section" contenant le nom normalisé de la section (1ère lettre majuscule)
- Une section se termine implicitement quand une nouvelle commence
- Si aucune section n'est mentionnée : omets le champ "section" ou mets "" sur toutes les lignes
- Tolère les erreurs de transcription : "sélection démolition" → section "Démolition"
- Fallback intelligent : si une ligne ne correspond à aucune section déclarée, associe-la à la dernière section active ou laisse le champ vide
- Exemples détectés : "section démolition :", "rubrique peinture :", "partie électricité", "sélection fondations"

À la fin de ta réponse, ajoute OBLIGATOIREMENT un bloc JSON structuré entre les balises <!--DEVIS_DATA et DEVIS_DATA--> contenant :
- Les informations du client (nom de famille, prénom, adresse, email, téléphone, type particulier/pro, id si client existant identifié)
- Le chantier mentionné dans la demande (id si existant trouvé, sinon nom seulement, sinon null)
- Les lignes de devis (description, quantité, unité, prix unitaire, section si applicable)
- Les correspondances clients trouvées (client_matches)
- Les correspondances chantiers trouvées (chantier_matches)

Exemple de format SANS sections :
<!--DEVIS_DATA
{
  "client": {
    "id": "",
    "nom": "Dupont",
    "prenom": "Jean",
    "adresse": "12 rue des Lilas, 75001 Paris",
    "email": "",
    "telephone": "",
    "type": "particulier"
  },
  "chantier": {
    "id": "",
    "nom": "Rénovation salle de bain Dupont"
  },
  "lignes": [
    {"description": "Dépose carrelage existant", "quantite": 15, "unite": "m²", "prix_unitaire": 25},
    {"description": "Pose carrelage neuf", "quantite": 15, "unite": "m²", "prix_unitaire": 45}
  ],
  "client_matches": [],
  "chantier_matches": []
}
DEVIS_DATA-->

Exemple de format AVEC sections (l'artisan a dit "section démolition", "section peinture", "section électricité") :
<!--DEVIS_DATA
{
  "client": {
    "id": "",
    "nom": "Dupont",
    "prenom": "Jean",
    "adresse": "",
    "email": "",
    "telephone": "",
    "type": "particulier"
  },
  "chantier": {
    "id": "",
    "nom": "Rénovation appartement Dupont"
  },
  "lignes": [
    {"description": "Démolition de murs", "quantite": 1, "unite": "u", "prix_unitaire": 800, "section": "Démolition"},
    {"description": "Démolition meuble double vasque", "quantite": 1, "unite": "u", "prix_unitaire": 150, "section": "Démolition"},
    {"description": "Achat peinture et apprêt", "quantite": 1, "unite": "u", "prix_unitaire": 120, "section": "Peinture"},
    {"description": "Rouleaux et matériel", "quantite": 1, "unite": "u", "prix_unitaire": 45, "section": "Peinture"},
    {"description": "Installation prises électriques", "quantite": 5, "unite": "u", "prix_unitaire": 45, "section": "Électricité"},
    {"description": "Remplacement tableau électrique", "quantite": 1, "unite": "u", "prix_unitaire": 350, "section": "Électricité"}
  ],
  "client_matches": [],
  "chantier_matches": []
}
DEVIS_DATA-->

NOTE NUMÉROTATION : les numéros de documents suivent le format PREFIXE-AAAA-MM-NNN (ex : "D-2026-04-001"). Les devis peuvent avoir des versions : "D-2026-04-001-v2", "D-2026-04-001-v3". N'invente jamais de numéro — il est généré automatiquement.

Si des informations manquent dans la demande actuelle, laisse les champs vides ("") — ne les invente pas.
Accompagne toujours le JSON d'un résumé textuel clair pour l'artisan.

CRÉATION D'AVENANT (quand l'artisan demande un avenant sur un devis) :
Ajoute un bloc <!--AVENANT_DATA ... AVENANT_DATA--> avec :
- devis_id : UUID du devis si connu depuis le contexte activeDocId (sinon "")
- devis_numero : numéro lisible du devis (ex : "Avt-2026-04-001")
- motif : raison de l'avenant
- lignes : tableau de lignes supplémentaires (description, quantite, unite, prix_unitaire)

Exemple avenant (avec section si l'artisan en précise) :
<!--AVENANT_DATA
{
  "devis_id": "",
  "devis_numero": "D-2026-04-001",
  "motif": "Travaux supplémentaires : remplacement du siphon de sol",
  "lignes": [
    {"description": "Remplacement siphon de sol", "quantite": 1, "unite": "u", "prix_unitaire": 85, "section": "Plomberie"},
    {"description": "Main d'œuvre pose", "quantite": 2, "unite": "h", "prix_unitaire": 45, "section": "Plomberie"}
  ]
}
AVENANT_DATA-->

CRÉATION DE FACTURE (quand l'artisan demande une facture sur un devis) :
Ajoute un bloc <!--FACTURE_DATA ... FACTURE_DATA--> avec :
- devis_id : UUID du devis si connu depuis le contexte activeDocId (sinon "")
- devis_numero : numéro lisible du devis
- lignes : lignes à facturer (reprend les lignes du devis ou un sous-ensemble)

Exemple facture :
<!--FACTURE_DATA
{
  "devis_id": "",
  "devis_numero": "D-2026-04-001",
  "lignes": [
    {"description": "Pose carrelage sol", "quantite": 15, "unite": "m²", "prix_unitaire": 45}
  ]
}
FACTURE_DATA-->

CRÉATION D'AVOIR (quand l'artisan demande un avoir sur une facture) :
Ajoute un bloc <!--AVOIR_DATA ... AVOIR_DATA--> avec :
- facture_id : UUID de la facture si connu depuis le contexte activeDocId (sinon "")
- facture_numero : numéro lisible de la facture
- devis_id : UUID du devis associé si connu (sinon "")
- description : motif de l'avoir
- montant_ht : montant HT à créditer (nombre positif)

Exemple avoir :
<!--AVOIR_DATA
{
  "facture_id": "",
  "facture_numero": "F-2026-04-001",
  "devis_id": "",
  "description": "Avoir pour prestation non réalisée",
  "montant_ht": 150
}
AVOIR_DATA-->

CRÉATION DE TRAVAUX SUPPLÉMENTAIRES / TS (quand l'artisan demande des travaux supplémentaires hors avenant sur un devis) :
Les TS sont distincts des avenants : ils ont leur propre numéro (préfixe TS), peuvent être signés et facturés indépendamment.
Ajoute un bloc <!--TS_DATA ... TS_DATA--> avec :
- devis_id : UUID du devis si connu depuis le contexte activeDocId (sinon "")
- devis_numero : numéro lisible du devis
- description : motif des travaux supplémentaires
- lignes : tableau de lignes (description, quantite, unite, prix_unitaire)

Exemple TS (avec sections si l'artisan en précise) :
<!--TS_DATA
{
  "devis_id": "",
  "devis_numero": "D-2026-04-001",
  "description": "Remplacement siphon de sol non prévu au devis initial",
  "lignes": [
    {"description": "Remplacement siphon de sol", "quantite": 1, "unite": "u", "prix_unitaire": 85, "section": "Plomberie"},
    {"description": "Main d'œuvre pose", "quantite": 2, "unite": "h", "prix_unitaire": 45, "section": "Plomberie"}
  ]
}
TS_DATA-->

RÈGLE DOCUMENT ACTIF :
Si le contexte contient activeDocId et activeDocType, c'est le document en cours de travail.
- Si activeDocType = "devis" : utilise activeDocId comme devis_id dans les blocs AVENANT_DATA, FACTURE_DATA et TS_DATA
- Si activeDocType = "facture" : utilise activeDocId comme facture_id dans le bloc AVOIR_DATA

RÈGLE RECHERCHE DEVIS POUR AVENANT / TS / FACTURE :
Quand l'artisan demande un avenant, des TS ou une facture SANS qu'un activeDocId soit disponible dans le contexte, cherche dans la section "Devis existants de l'artisan" :
1. Identifie d'abord le client mentionné (via les "Clients existants") pour obtenir son client_id
2. Filtre les devis par ce client_id
3. Si UN SEUL devis correspond → utilise son id dans devis_id, son numero dans devis_numero. Génère le bloc AVENANT_DATA/TS_DATA/FACTURE_DATA normalement.
4. Si PLUSIEURS devis correspondent → liste-les dans ta réponse textuelle (numero + statut + montant) et demande à l'artisan lequel utiliser. Ne génère PAS de bloc AVENANT_DATA/TS_DATA/FACTURE_DATA dans ce cas.
5. Si AUCUN devis ne correspond → informe l'artisan et demande de préciser le numéro de devis.

RÈGLE PRIX MANQUANT :
Si l'artisan ne précise pas le prix unitaire d'une prestation, utilise ta connaissance générale du secteur BTP français (tarifs main-d'œuvre, matériaux, prestations courantes) pour estimer un prix réaliste. Indique alors dans ta réponse textuelle que les prix sont estimatifs et peuvent être ajustés dans le formulaire. Ne mets 0 que si tu n'as vraiment aucune base pour estimer (matériau ou prestation totalement inconnu).

VERSIONING DEVIS : un devis peut avoir des versions (v2, v3…). Le numéro d'une nouvelle version s'affiche "D-2026-04-001-v2". Si l'artisan mentionne une version précise, utilise ce numéro dans devis_numero.

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
5. Quand tu rédiges un courrier (mise en demeure, réclamation, etc.), utilise un format professionnel
6. Indique systématiquement quand il est recommandé de consulter un avocat spécialisé

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
1. Cite TOUJOURS les références normatives exactes
2. Donne des valeurs numériques concrètes (épaisseurs, dosages, portées, résistances)
3. Si une information est insuffisante pour un calcul précis, DEMANDE les compléments
4. Mentionne les certifications pertinentes (Qualibat, RGE, etc.) quand applicables

Commence toujours tes réponses par [Auguste P].
Réponds en français. Sois technique, précis et concret avec des exemples de terrain.
IMPÉRATIF : Sois concis. Donne les valeurs et références normatives essentielles directement, sans introduction.
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

        // Injection liste clients + chantiers pour Jarvis
        if (user && persona === "jarvis") {
          const { data: clientsList } = await supabase
            .from("clients")
            .select("id, nom, prenom, email, telephone, type")
            .eq("artisan_id", user.id)
            .order("nom");

          if (clientsList && clientsList.length > 0) {
            systemContent += `\n\n---\n## Clients existants de l'artisan (${clientsList.length})\n${JSON.stringify(clientsList)}\n---`;
          }

          const { data: chantiersList } = await supabase
            .from("chantiers")
            .select("id, nom, adresse_chantier, client_id, statut")
            .eq("artisan_id", user.id)
            .in("statut", ["prospect", "en_cours"])
            .order("nom");

          if (chantiersList && chantiersList.length > 0) {
            systemContent += `\n\n---\n## Chantiers existants de l'artisan (${chantiersList.length})\n${JSON.stringify(chantiersList)}\n---`;
          }

          // Injection liste des devis (pour résolution avenant/TS/facture sans activeDocId)
          const { data: devisList } = await supabase
            .from("devis")
            .select("id, numero, statut, montant_ht, tva, client_id, chantier_id, created_at, date_validite")
            .eq("artisan_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50);

          if (devisList && devisList.length > 0) {
            systemContent += `\n\n---\n## Devis existants de l'artisan (${devisList.length})\nUtilise cette liste pour retrouver le devis_id quand l'artisan demande un avenant, TS ou facture sans avoir de document actif ouvert.\n${JSON.stringify(devisList)}\n---`;
          }

          // Injection du document actif (devis ou facture en cours)
          const activeDocId = context?.activeDocId as string | undefined;
          const activeDocType = context?.activeDocType as string | undefined;
          if (activeDocId && activeDocType === "devis") {
            const { data: activeDevis } = await supabase
              .from("devis")
              .select("id, numero, montant_ht, statut, client_id, chantier_id")
              .eq("id", activeDocId)
              .maybeSingle();
            if (activeDevis) {
              systemContent += `\n\n---\n## Devis actif en cours de travail\nCe devis est le document actif. Utilise son ID dans les blocs AVENANT_DATA et FACTURE_DATA.\n${JSON.stringify(activeDevis)}\n---`;
            }
          } else if (activeDocId && activeDocType === "facture") {
            const { data: activeFacture } = await supabase
              .from("factures")
              .select("id, numero, montant_ht, statut, devis_id")
              .eq("id", activeDocId)
              .maybeSingle();
            if (activeFacture) {
              systemContent += `\n\n---\n## Facture active en cours de travail\nCette facture est le document actif. Utilise son ID dans le bloc AVOIR_DATA.\n${JSON.stringify(activeFacture)}\n---`;
            }
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
