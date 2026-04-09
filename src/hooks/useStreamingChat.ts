import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/call-claude`;

export interface StreamingChatOptions {
  /** Corps de la requête envoyé à call-claude (messages, persona, context…) */
  body: Record<string, unknown>;
  /** Appelé à chaque chunk de texte reçu, avec le texte accumulé depuis le début */
  onChunk: (accumulated: string) => void;
  /** Appelé une seule fois quand le stream est terminé */
  onDone?: (finalText: string) => void;
}

/**
 * Lance un appel SSE vers l'edge function call-claude et parse le stream.
 * Utilise le JWT de session pour permettre la recherche RAG par utilisateur.
 * @returns Le texte complet de la réponse, ou null en cas d'erreur.
 */
export async function streamChat({
  body,
  onChunk,
  onDone,
}: StreamingChatOptions): Promise<string | null> {
  // Récupère le token de session pour identifier l'utilisateur côté edge function
  const { data: { session } } = await supabase.auth.getSession();
  const authHeader = session?.access_token
    ? `Bearer ${session.access_token}`
    : `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (resp.status === 429) {
    toast.error("Limite atteinte, réessayez dans un instant");
    return null;
  }
  if (resp.status === 402) {
    toast.error("Crédits IA épuisés");
    return null;
  }
  if (!resp.ok || !resp.body) {
    throw new Error("Erreur de connexion");
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let accumulated = "";

  let streamDone = false;
  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;

    textBuffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, idx);
      textBuffer = textBuffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "" || !line.startsWith("data: ")) continue;

      const json = line.slice(6).trim();
      if (json === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          accumulated += content;
          onChunk(accumulated);
        }
      } catch {
        // Chunk JSON incomplet : le remettre en tête pour la prochaine itération
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  onDone?.(accumulated);
  return accumulated;
}
