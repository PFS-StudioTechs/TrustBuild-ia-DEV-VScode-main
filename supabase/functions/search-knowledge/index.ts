  import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
  import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  async function embed(text: string, apiKey: string): Promise<number[]> {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`OpenAI embedding error: ${err}`);
    }
    const json = await resp.json();
    return json.data[0].embedding as number[];
  }

  serve(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Non autorisé" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

      // Récupère le user depuis le JWT
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userErr } = await userClient.auth.getUser();
      if (userErr || !user) {
        return new Response(JSON.stringify({ error: "Non autorisé" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { question, limit = 5 } = await req.json();
      if (!question?.trim()) {
        return new Response(JSON.stringify({ error: "question requise" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Génère l'embedding de la question
      const queryEmbedding = await embed(question, openaiKey);

      // Recherche cosine similarity via la fonction RPC
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data: chunks, error: searchErr } = await supabase.rpc(
        "search_knowledge_chunks",
        {
          p_artisan_id: user.id,
          p_embedding: JSON.stringify(queryEmbedding),
          p_limit: limit,
        }
      );

      if (searchErr) {
        console.error("search_knowledge_chunks error:", searchErr);
        return new Response(JSON.stringify({ error: searchErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ chunks: chunks ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error("search-knowledge error:", e);
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  });
