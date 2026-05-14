import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Constantes partagées ────────────────────────────────────────────────────
const TELEGRAM_API = "https://api.telegram.org";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sendTelegram(token: string, chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  const url = new URL(req.url);

  // Enregistrement du webhook (appelé une fois en setup)
  if (url.searchParams.get("action") === "set_webhook" || req.method === "GET") {
    try {
      const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
      if (!TELEGRAM_BOT_TOKEN) return jsonResponse({ error: "TELEGRAM_BOT_TOKEN not set" }, 500);

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook`;
      const res = await fetch(`${TELEGRAM_API}/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      return jsonResponse({ webhook_url: webhookUrl, telegram_response: await res.json() });
    } catch (e) {
      return jsonResponse({ error: String(e) }, 500);
    }
  }

  if (req.method !== "POST") return new Response("OK", { status: 200 });

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!TELEGRAM_BOT_TOKEN || !OPENAI_API_KEY) {
      console.error("Missing required secrets: TELEGRAM_BOT_TOKEN or OPENAI_API_KEY");
      return new Response("OK", { status: 200 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const update = await req.json();
    const message = update.message;
    if (!message) return new Response("OK", { status: 200 });

    const chatId = message.chat.id;
    const isVoice = !!(message.voice || message.audio);
    let userText = message.text || "";

    // Trouver l'artisan lié à ce chat Telegram
    const { data: settings } = await supabase
      .from("artisan_settings")
      .select("user_id, preferences")
      .filter("preferences->>telegram_chat_id", "eq", String(chatId))
      .limit(1);

    const artisanId: string | null = settings?.[0]?.user_id ?? null;

    if (!artisanId) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, chatId,
        "⚠️ Ce compte Telegram n'est pas encore lié à un compte TrustBuild-IA.\n\nRendez-vous dans Paramètres > Intégrations pour associer votre chat_id : " + chatId
      );
      return new Response("OK", { status: 200 });
    }

    // Transcription vocale avec OpenAI Whisper
    let transcription: string | null = null;
    if (isVoice) {
      const fileId = message.voice?.file_id || message.audio?.file_id;
      if (!fileId) {
        await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "❌ Impossible de traiter le message vocal.");
        return new Response("OK", { status: 200 });
      }

      const fileRes = await fetch(`${TELEGRAM_API}/bot${TELEGRAM_BOT_TOKEN}/getFile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId }),
      });
      const fileData = await fileRes.json();
      if (!fileData.ok) {
        await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "❌ Erreur lors du téléchargement du fichier audio.");
        return new Response("OK", { status: 200 });
      }

      const audioRes = await fetch(`${TELEGRAM_API}/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`);
      const formData = new FormData();
      formData.append("file", await audioRes.blob(), "audio.ogg");
      formData.append("model", "whisper-1");
      formData.append("language", "fr");

      const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: formData,
      });

      if (!whisperRes.ok) {
        console.error("Whisper error:", await whisperRes.text());
        await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "❌ Erreur de transcription audio.");
        return new Response("OK", { status: 200 });
      }

      transcription = (await whisperRes.json()).text || "";
      userText = transcription;
      await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, `🎙 Compris : "${transcription}"`);
    }

    if (!userText.trim()) return new Response("OK", { status: 200 });

    // Récupérer ou créer la conversation Telegram de cet artisan
    const { data: existingConv } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("artisan_id", artisanId)
      .eq("titre", "Telegram")
      .order("created_at", { ascending: false })
      .limit(1);

    let conversationId: string;
    if (existingConv && existingConv.length > 0) {
      conversationId = existingConv[0].id;
    } else {
      const { data: newConv, error: convErr } = await supabase
        .from("chat_conversations")
        .insert({ artisan_id: artisanId, titre: "Telegram" })
        .select("id")
        .single();
      if (convErr || !newConv) { console.error("Conv creation error:", convErr); return new Response("OK", { status: 200 }); }
      conversationId = newConv.id;
    }

    // Sauvegarder le message utilisateur
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      artisan_id: artisanId,
      role: "user",
      content: userText,
      persona: "jarvis",
      source: "telegram",
      transcription_originale: transcription,
    });

    // Appel IA via la propre edge function call-openai (plus de dépendance Lovable)
    const aiResponse = await fetch(`${supabaseUrl}/functions/v1/call-openai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: userText }],
        stream: false,
        persona: "jarvis",
        context: { source: "telegram" },
      }),
    });

    let assistantText = "Désolé, je n'ai pas pu traiter votre demande.";
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      assistantText = aiData.choices?.[0]?.message?.content || assistantText;
    } else {
      console.error("AI error:", aiResponse.status, await aiResponse.text());
    }

    // Sauvegarder la réponse assistant
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      artisan_id: artisanId,
      role: "assistant",
      content: assistantText,
      persona: "jarvis",
      source: "telegram",
    });

    // Envoyer la réponse (Telegram limite à 4096 caractères)
    const truncated = assistantText.length > 4000 ? assistantText.slice(0, 4000) + "…" : assistantText;
    await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, truncated);

    // Notifier si une action a été détectée
    const actionKeywords = ["devis", "facture", "courrier", "mise en demeure"];
    if (actionKeywords.some(k => assistantText.toLowerCase().includes(k))) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, chatId,
        "📋 Une action a été identifiée. Consultez l'application pour la valider :\n👉 Ouvrir TrustBuild-IA"
      );
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("telegram-webhook error:", e);
    return new Response("OK", { status: 200 });
  }
});
