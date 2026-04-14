import { useState, useRef, useEffect } from "react";
import { X, Send, Bot, User, Scale, Wrench, Mic, MicOff, Smartphone, Monitor, FilePlus, Save } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { streamChat } from "@/hooks/useStreamingChat";
import DevisCreationForm, { parseDevisData, stripDevisData, type DevisData } from "./DevisCreationForm";

interface Message {
  role: "user" | "assistant";
  content: string;
  persona?: string;
  source?: string;
  devisData?: DevisData | null;
}

function detectPersonaFromContent(content: string): string {
  if (content.startsWith("[Robert B]")) return "robert_b";
  if (content.startsWith("[Auguste P]")) return "auguste_p";
  return "jarvis";
}

const personaConfig: Record<string, { label: string; icon: typeof Bot; color: string }> = {
  jarvis: { label: "Jarvis", icon: Bot, color: "text-accent" },
  robert_b: { label: "Robert B", icon: Scale, color: "text-amber-600" },
  auguste_p: { label: "Auguste P", icon: Wrench, color: "text-emerald-600" },
};

export default function JarvisPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lastTranscription, setLastTranscription] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const location = useLocation();

  const ensureConversation = async (): Promise<string | null> => {
    if (conversationId) return conversationId;
    if (!user) return null;
    const { data, error } = await supabase.from("chat_conversations").insert({
      artisan_id: user.id, titre: `Conversation ${new Date().toLocaleString("fr-FR")}`,
    }).select("id").single();
    if (error || !data) return null;
    setConversationId(data.id);
    return data.id;
  };

  const persistMessage = async (role: string, content: string, persona: string, source: string, transcription?: string | null) => {
    const convId = await ensureConversation();
    if (!convId || !user) return;
    await supabase.from("chat_messages").insert({
      conversation_id: convId,
      artisan_id: user.id,
      role,
      content,
      persona,
      source,
      transcription_originale: transcription || null,
    } as any);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Realtime subscription for Telegram messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("jarvis-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `artisan_id=eq.${user.id}` }, (payload) => {
        const newMsg = payload.new as any;
        if (newMsg.source === "telegram") {
          setMessages((prev) => {
            const isDup = prev.some((m) => m.content === newMsg.content && m.role === newMsg.role && m.source === "telegram");
            if (isDup) return prev;
            return [...prev, { role: newMsg.role, content: newMsg.content, persona: newMsg.persona || "jarvis", source: "telegram" }];
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const startNewDocument = () => {
    setActiveDocId(null);
    setConversationId(null);
    setMessages([]);
    setLastTranscription(null);
    toast.success("Nouvelle conversation démarrée");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Detect supported MIME type — iOS Safari doesn't support audio/webm
      const MIME_TYPES = ["audio/webm", "audio/mp4", "audio/ogg"];
      const mimeType = MIME_TYPES.find((t) => {
        try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
      }) ?? "";
      mimeTypeRef.current = mimeType;
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
        await transcribeAudio(blob);
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
    } catch {
      toast.error("Impossible d'accéder au microphone. Vérifiez les autorisations de votre navigateur.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const formData = new FormData();
      const mt = mimeTypeRef.current;
      const ext = mt.includes("mp4") ? "m4a" : mt.includes("ogg") ? "ogg" : "webm";
      formData.append("audio", blob, `recording.${ext}`);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: "POST",
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: formData,
      });
      if (!resp.ok) throw new Error("Transcription failed");
      const data = await resp.json();
      if (data.text) { setInput(data.text); setLastTranscription(data.text); toast.success("Transcription terminée — vérifiez et envoyez"); }
      else toast.error("Aucun texte détecté");
    } catch { toast.error("Erreur de transcription audio"); }
    finally { setTranscribing(false); }
  };

  const toggleRecording = () => { recording ? stopRecording() : startRecording(); };

  // ── Sauvegarder la conversation dans "Mes Fichiers" ───────────────────────
  const saveConversation = async () => {
    if (!user || messages.length === 0) {
      toast.error("Aucun message à sauvegarder");
      return;
    }
    try {
      const now = new Date();
      const dateLabel = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const filename = `Conversation-Jarvis-${now.toISOString().slice(0, 16).replace(/:/g, "-")}.html`;

      // Build HTML
      const messagesHtml = messages.map((m) => {
        const persona = m.persona ?? "jarvis";
        const label = persona === "robert_b" ? "Robert B" : persona === "auguste_p" ? "Auguste P" : "Jarvis";
        const bg = m.role === "user" ? "#2563eb" : "#f9fafb";
        const color = m.role === "user" ? "#fff" : "#111827";
        const align = m.role === "user" ? "right" : "left";
        const content = stripDevisData(m.content).replace(/\n/g, "<br>");
        return `
          <div style="display:flex;justify-content:${align};margin-bottom:12px;">
            <div style="max-width:75%;background:${bg};color:${color};border-radius:12px;padding:10px 14px;font-size:13px;line-height:1.5;">
              <div style="font-size:10px;font-weight:700;margin-bottom:4px;opacity:.7;text-transform:uppercase;">${m.role === "user" ? "Vous" : label}</div>
              ${content}
            </div>
          </div>`;
      }).join("");

      const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Conversation Jarvis — ${dateLabel}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111827;padding:32px 40px;max-width:700px;margin:0 auto}
      @media print{body{padding:16px}@page{margin:12mm 14mm;size:A4}}</style></head>
      <body>
        <div style="background:linear-gradient(135deg,#2563eb,#1e40af);border-radius:12px;padding:20px 24px;margin-bottom:24px;">
          <div style="font-size:22px;font-weight:700;color:#fff;">Conversation avec Maître Jarvis</div>
          <div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:4px;">${dateLabel} · ${messages.length} message(s)</div>
        </div>
        ${messagesHtml}
        <div style="margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px;font-size:10px;color:#9ca3af;">Trust Build-IA — Généré automatiquement</div>
        <div class="no-print" style="margin-top:20px;text-align:center;">
          <button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:600;cursor:pointer;">Imprimer / Enregistrer en PDF</button>
        </div>
      </body></html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const path = `${user.id}/conversations/${filename}`;

      const { error: uploadErr } = await supabase.storage.from("artisan-documents").upload(path, blob, { upsert: true, contentType: "text/html" });
      if (uploadErr) throw uploadErr;

      const { error: dbErr } = await supabase.from("documents").insert({
        artisan_id: user.id,
        nom: filename,
        description: `Conversation Jarvis du ${dateLabel}`,
        type_fichier: "autre",
        taille_octets: blob.size,
        mime_type: "text/html",
        storage_path: path,
        tags: ["conversation", "jarvis"],
      } as any);
      if (dbErr) throw dbErr;

      toast.success("Conversation sauvegardée dans Mes Fichiers ✓");
    } catch (e: any) {
      toast.error("Erreur sauvegarde : " + e.message);
    }
  };

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim(), source: "app" };
    const updated = [...messages, userMsg];
    setMessages(updated);
    const currentTranscription = lastTranscription;
    setInput("");
    setLastTranscription(null);
    setLoading(true);

    persistMessage("user", text.trim(), "jarvis", "app", currentTranscription);

    try {
      const finalText = await streamChat({
        body: {
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
          context: { page: location.pathname, activeDocId },
        },
        onChunk: (accumulated) => {
          const persona = detectPersonaFromContent(accumulated);
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: accumulated, persona, source: "app" } : m
              );
            }
            return [...prev, { role: "assistant", content: accumulated, persona, source: "app" }];
          });
        },
      });

      if (finalText) {
        const assistantPersona = detectPersonaFromContent(finalText);
        persistMessage("assistant", finalText, assistantPersona, "app");

        const devisData = parseDevisData(finalText);
        if (devisData) {
          const cleanContent = stripDevisData(finalText);
          setMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 && m.role === "assistant"
                ? { ...m, content: cleanContent, devisData }
                : m
            )
          );
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const SourceBadge = ({ source }: { source?: string }) => {
    if (!source || source === "app") return null;
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full mt-0.5">
        {source === "telegram" ? <><Smartphone className="w-2.5 h-2.5" /> via Telegram</> : <><Monitor className="w-2.5 h-2.5" /> via App</>}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-secondary/50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm">Maître Jarvis</h3>
            <p className="text-[11px] text-muted-foreground">Assistant IA central</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={saveConversation} className="w-8 h-8" title="Sauvegarder la conversation dans Mes Fichiers" disabled={messages.length === 0}>
            <Save className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={startNewDocument} className="w-8 h-8" title="Nouvelle conversation">
            <FilePlus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-fade-up">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
              <Bot className="w-7 h-7 text-accent" />
            </div>
            <div>
              <p className="font-display font-bold text-sm">Bonjour, je suis Maître Jarvis</p>
              <p className="text-xs text-muted-foreground mt-1">Je peux vous aider avec vos devis, questions techniques ou juridiques.</p>
            </div>
            <div className="space-y-1.5 w-full">
              {["Rédige un devis rapide", "Question juridique décennale", "Calcul DTU isolation"].map((s) => (
                <button key={s} onClick={() => send(s)} className="w-full text-left p-2.5 rounded-lg border text-xs hover:bg-primary-glow hover:border-primary/20 transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const persona = msg.persona ? personaConfig[msg.persona] : personaConfig.jarvis;
          const Icon = persona?.icon || Bot;
          return (
            <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "")}>
              {msg.role === "assistant" && (
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <div className={cn("w-7 h-7 rounded-full bg-secondary flex items-center justify-center", persona?.color)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[9px] text-muted-foreground font-medium">{persona?.label}</span>
                </div>
              )}
              <div className="flex flex-col">
                <div className={cn(
                  "max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                  msg.role === "user"
                    ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-sm"
                    : "bg-card border rounded-bl-sm"
                )}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-xs max-w-none dark:prose-invert [&_p]:my-0.5 [&_ul]:my-0.5 [&_li]:my-0 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs">
                      <ReactMarkdown>{stripDevisData(msg.content)}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
                {msg.devisData && (
                  <DevisCreationForm
                    data={msg.devisData}
                    onCreated={() => {
                      setMessages((prev) => prev.map((m, idx) => (idx === i ? { ...m, devisData: null } : m)));
                    }}
                  />
                )}
                <SourceBadge source={msg.source} />
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          );
        })}

        {transcribing && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0"><Mic className="w-3.5 h-3.5 text-accent" /></div>
            <div className="bg-accent/5 border border-accent/20 rounded-xl rounded-bl-sm px-3 py-2 text-xs text-accent">🎙 Transcription en cours...</div>
          </div>
        )}

        {loading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0"><Bot className="w-3.5 h-3.5 text-accent" /></div>
            <div className="bg-accent/5 border border-accent/20 rounded-xl rounded-bl-sm px-3 py-2">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                <span className="ml-1 text-accent font-mono text-[10px] animate-pulse">|</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-2 shrink-0 bg-card">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={transcribing ? "Transcription en cours..." : "Posez votre question à Jarvis…"}
            className="text-xs h-10"
            disabled={loading || transcribing}
          />
          <Button type="button" size="icon" variant={recording ? "destructive" : "outline"} onClick={toggleRecording} disabled={loading || transcribing}
            className={cn("h-10 w-10 shrink-0 transition-all", recording && "animate-pulse")}
            title={recording ? "Arrêter l'enregistrement" : "Enregistrement vocal"}>
            {recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </Button>
          <Button type="submit" size="icon" disabled={!input.trim() || loading || transcribing} className="h-10 w-10 shrink-0 bg-gradient-to-r from-primary to-accent">
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
