import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const expectedSecret = Deno.env.get("BREVO_WEBHOOK_SECRET");

  if (!expectedSecret || secret !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(supabaseUrl, serviceKey);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const events = Array.isArray(body) ? body : [body];

  for (const event of events) {
    const eventType: string = event?.event;
    const tags: string[] = event?.tags ?? [];

    const docTag = tags.find((t: string) => t.includes(":"));
    if (!docTag) continue;

    const colonIdx = docTag.indexOf(":");
    const docType = docTag.slice(0, colonIdx);
    const docId = docTag.slice(colonIdx + 1);
    if (!docId) continue;

    const table = docType === "factures" ? "factures" : "devis";
    const now = new Date().toISOString();

    if (eventType === "opened") {
      await client.from(table).update({ email_ouvert_at: now }).eq("id", docId).is("email_ouvert_at", null);
    } else if (eventType === "click") {
      await client.from(table).update({ email_clique_at: now }).eq("id", docId).is("email_clique_at", null);
    }
  }

  return new Response("OK", { status: 200 });
});
