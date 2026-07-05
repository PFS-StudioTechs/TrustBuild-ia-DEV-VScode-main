import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const { email } = await req.json();
  if (!email) {
    return new Response(JSON.stringify({ error: "Champ manquant (email)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Erreur lors de la vérification" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const data = await res.json();
  const exists = (data.users ?? []).length > 0;

  return new Response(JSON.stringify({ exists }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
