import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { routeIntent, type IntentResult } from "../_shared/intent-router.ts";
import { getSystemPrompt } from "../_shared/system-prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Routing : forcePersona (depuis AgentChat) court-circuite le router
    const lastUserMsg =
      [...messages].reverse().find((m: { role: string }) => m.role === "user")
        ?.content ?? "";

    const validPersonas = ["jarvis", "robert_b", "auguste_p"];
    const routerResult: IntentResult =
      forcePersona && validPersonas.includes(forcePersona as string)
        ? {
            persona: forcePersona as "jarvis" | "robert_b" | "auguste_p",
            intent: "GENERAL",
            entities: {},
            confidence: 1,
          }
        : await routeIntent(lastUserMsg);

    const persona = routerResult.persona;
    let systemContent = getSystemPrompt(persona);

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
          const knowledgeContext = await searchKnowledge(
            lastUserMsg,
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

          const { data: devisList } = await supabase
            .from("devis")
            .select("id, numero, statut, montant_ht, tva, client_id, chantier_id, created_at, date_validite")
            .eq("artisan_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50);

          if (devisList && devisList.length > 0) {
            systemContent += `\n\n---\n## Devis existants de l'artisan (${devisList.length})\nUtilise cette liste pour retrouver le devis_id quand l'artisan demande un avenant, TS ou facture sans avoir de document actif ouvert.\n${JSON.stringify(devisList)}\n---`;

            // Inject lines for all brouillon devis (no activeDocId needed)
            const brouillons = (devisList as { id: string; numero: string; statut: string }[])
              .filter((d) => d.statut === "brouillon")
              .slice(0, 5);
            for (const d of brouillons) {
              const { data: lignesBrouillon } = await supabase
                .from("lignes_devis")
                .select("id, designation, quantite, unite, prix_unitaire, tva, section_nom, ordre")
                .eq("devis_id", d.id)
                .order("ordre");
              if (lignesBrouillon && lignesBrouillon.length > 0) {
                // Group: null-section lines first, then each named section together
                type Ligne = { id: string; designation: string; section_nom: string | null; ordre: number; [k: string]: unknown };
                const noSec = (lignesBrouillon as Ligne[]).filter(l => !l.section_nom);
                const secMap: Record<string, Ligne[]> = {};
                const secOrder: string[] = [];
                for (const l of lignesBrouillon as Ligne[]) {
                  if (!l.section_nom) continue;
                  if (!secMap[l.section_nom]) { secMap[l.section_nom] = []; secOrder.push(l.section_nom); }
                  secMap[l.section_nom].push(l);
                }
                const grouped = [...noSec, ...secOrder.flatMap(s => secMap[s])];
                systemContent += `\n\n---\n## Lignes du devis brouillon ${d.numero} (${grouped.length} lignes)\nUtilise ces IDs dans les "operations" du bloc DEVIS_UPDATE_DATA.\n${JSON.stringify(grouped)}\n---`;
              }
            }
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
              systemContent += `\n\n---\n## Devis actif en cours de travail\nCe devis est le document actif. Utilise son ID dans les blocs AVENANT_DATA, FACTURE_DATA et DEVIS_UPDATE_DATA.\n${JSON.stringify(activeDevis)}\n---`;
              if (activeDevis.statut === "brouillon") {
                const { data: lignesDevis } = await supabase
                  .from("lignes_devis")
                  .select("id, designation, quantite, unite, prix_unitaire, tva, section_nom, ordre")
                  .eq("devis_id", activeDocId)
                  .order("ordre");
                if (lignesDevis && lignesDevis.length > 0) {
                  systemContent += `\n\n---\n## Lignes actuelles du devis brouillon (${lignesDevis.length} lignes)\nUtilise ces IDs dans les "operations" du bloc DEVIS_UPDATE_DATA pour modifier, supprimer ou déplacer des lignes existantes.\n${JSON.stringify(lignesDevis)}\n---`;
                }
              }
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
        console.error("RAG error (non-fatal):", e);
      }
    }

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
        routing: routerResult,
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
