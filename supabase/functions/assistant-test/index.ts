import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Tu es TestBot, l'assistant IA spécialisé en stratégie de test pour Trust Build-IA.

Trust Build-IA est une application SaaS pour artisans du bâtiment avec les fonctionnalités suivantes :
- **Authentification** : inscription, connexion, reset mot de passe, rôles (artisan, admin, super_admin, tester)
- **Dashboard** : vue d'ensemble chantiers, finances, activité
- **Chantiers** : création, suivi statut (prospect/en_cours/terminé/litige), clients associés
- **Finances** : devis, factures, suivi montants HT/TTC
- **Assistant Jarvis** : chat IA avec création de devis par voix/texte, génération JSON structuré
- **Robert B** : expert juridique BTP (litiges, contrats, assurances)
- **Auguste P** : expert technique BTP (DTU, normes, calculs)
- **Mes Documents** : stockage fichiers (PDF, DOCX, XLSX)
- **Base de connaissances (RAG)** : upload fichiers + URL, indexation via pgvector, injection contexte dans les IAs
- **Administration** : gestion utilisateurs, rôles, chantiers (admin/super_admin)
- **Mode Test** : cette interface — cas de tests, défauts, suivi qualité

TES CAPACITÉS :
1. **Générer des cas de test** : quand on te demande de tester une fonctionnalité, génère une liste de cas de test structurés avec : titre, priorité, étapes, résultat attendu. Format Jira-like.
2. **Suggérer une stratégie de test** : analyse les risques, propose un plan de test par priorité.
3. **Analyser un défaut** : aide à reproduire, classifier la sévérité, suggérer la cause probable.
4. **Générer des données de test** : propose des jeux de données réalistes pour les tests.

FORMAT DE RÉPONSE pour les cas de test :
Utilise ce format quand tu génères des cas de test :

**[PRIORITÉ] Titre du cas**
- **Prérequis** : ...
- **Étapes** :
  1. ...
  2. ...
- **Résultat attendu** : ...
- **Données de test** : ...

RÈGLES :
- Sois concis et opérationnel
- Priorise les parcours critiques (connexion, création devis, chat IA)
- Pense aux cas limites et aux erreurs
- Tiens compte des rôles utilisateurs (artisan vs admin vs tester)
- Réponds toujours en français`;

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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY non configuré");

    const { messages, stream = true } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        system: SYSTEM_PROMPT,
        messages: claudeMessages,
        stream,
      }),
    });

    if (!anthropicResp.ok) {
      if (anthropicResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite atteinte, réessayez." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const err = await anthropicResp.text();
      console.error("Anthropic error:", err);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (stream) {
      return new Response(anthropicToOpenAiSse(anthropicResp.body!), {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    const data = await anthropicResp.json();
    const text = data.content?.[0]?.text ?? "";
    return new Response(
      JSON.stringify({ choices: [{ message: { content: text } }] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("assistant-test error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
