import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Constantes partagées ────────────────────────────────────────────────────
const TELEGRAM_API = "https://api.telegram.org";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { action, chat_id, text, artisan_id } = await req.json();

    // Action : envoyer un message vers un chat Telegram
    if (action === "send") {
      if (!chat_id || !text) return jsonResponse({ error: "chat_id and text are required" }, 400);

      const res = await fetch(`${TELEGRAM_API}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text, parse_mode: "HTML" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Telegram API error [${res.status}]: ${JSON.stringify(data)}`);
      return jsonResponse({ ok: true, message_id: data.result?.message_id });
    }

    // Action : associer un chat_id Telegram à un artisan
    if (action === "link") {
      if (!artisan_id || !chat_id) return jsonResponse({ error: "artisan_id and chat_id are required" }, 400);

      const { error } = await supabase
        .from("artisan_settings")
        .upsert({ user_id: artisan_id, preferences: { telegram_chat_id: chat_id } }, { onConflict: "user_id" });

      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true });
    }

    // Action : vérifier que le token bot fonctionne
    if (action === "verify") {
      const res = await fetch(`${TELEGRAM_API}/bot${TELEGRAM_BOT_TOKEN}/getMe`);
      return jsonResponse(await res.json());
    }

    return jsonResponse({ error: "Unknown action. Use: send, link, verify" }, 400);
  } catch (e) {
    console.error("telegram-bot error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
