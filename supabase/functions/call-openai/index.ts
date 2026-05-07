import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSystemPrompt } from "../_shared/system-prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Routing : accept persona from caller (telegram, AgentChat) — no re-routing
    const validPersonas = ["jarvis", "robert_b", "auguste_p"];
    const persona = forcePersona && validPersonas.includes(forcePersona as string)
      ? (forcePersona as string)
      : "jarvis";

    let systemContent = getSystemPrompt(persona);

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
