import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User, Save, CheckCircle, Mic, MicOff, Smartphone, Monitor, FileDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { streamChat } from "@/hooks/useStreamingChat";
import jsPDF from "jspdf";

interface Message {
  role: "user" | "assistant";
  content: string;
  source?: string;
}

interface AgentChatProps {
  persona: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  suggestions: string[];
  placeholder?: string;
}

export default function AgentChat({
  persona,
  title,
  subtitle,
  icon: Icon,
  iconColor,
  iconBg,
  suggestions,
  placeholder = "Posez votre question…",
}: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`agent-${persona}-realtime`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `artisan_id=eq.${user.id}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.source === "telegram" && newMsg.persona === persona) {
            setMessages((prev) => {
              const isDup = prev.some(
                (m) => m.content === newMsg.content && m.role === newMsg.role && m.source === "telegram"
              );
              if (isDup) return prev;
              return [...prev, { role: newMsg.role, content: newMsg.content, source: "telegram" }];
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, persona]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
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
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: formData,
        }
      );
      if (!resp.ok) throw new Error("Transcription failed");
      const data = await resp.json();
      if (data.text) {
        setInput(data.text);
        toast.success("Transcription terminée — vérifiez et envoyez");
      } else {
        toast.error("Aucun texte détecté");
      }
    } catch {
      toast.error("Erreur de transcription audio");
    } finally {
      setTranscribing(false);
    }
  };

  const toggleRecording = () => {
    recording ? stopRecording() : startRecording();
  };

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim(), source: "app" };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      await streamChat({
        body: { messages: updated, persona },
        onChunk: (accumulated) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: accumulated } : m
              );
            }
            return [...prev, { role: "assistant", content: accumulated, source: "app" }];
          });
        },
      });
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const saveDocument = async (msgIndex: number) => {
    if (!user) return;
    const msg = messages[msgIndex];
    if (!msg || msg.role !== "assistant") return;
    setSavingIdx(msgIndex);
    try {
      const nom = `${title} — ${new Date().toLocaleDateString("fr-FR")}`;
      const contenu = cleanContent(msg.content);
      const type_fichier = persona === "robert_b" ? "courrier" : "note_technique";

      // Upload le contenu texte dans le bucket artisan-documents
      const blob = new Blob([contenu], { type: "text/plain;charset=utf-8" });
      const safeName = nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${user.id}/${Date.now()}-${safeName}.txt`;

      const { error: uploadErr } = await supabase.storage
        .from("artisan-documents")
        .upload(storagePath, blob);
      if (uploadErr) throw uploadErr;

      // Crée l'enregistrement dans la table documents
      const { error: dbErr } = await supabase.from("documents").insert({
        artisan_id: user.id,
        nom,
        description: `Conversation avec ${title}`,
        type_fichier,
        taille_octets: blob.size,
        mime_type: "text/plain",
        storage_path: storagePath,
        tags: [persona, "ia"],
      });
      if (dbErr) throw dbErr;

      toast.success("Conversation sauvegardée dans Mes Documents");
    } catch (e: any) {
      toast.error("Impossible de sauvegarder : " + (e.message || "erreur inconnue"));
    } finally {
      setSavingIdx(null);
    }
  };

  const exportToPdf = (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg || msg.role !== "assistant") return;

    const question = msgIndex > 0 ? messages[msgIndex - 1]?.content : null;
    const raw = cleanContent(msg.content);

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxW = pageW - margin * 2;
    let y = 20;

    const addLine = (text: string, size: number, style: "normal" | "bold" = "normal", color = 40) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", style);
      doc.setTextColor(color);
      const lines = doc.splitTextToSize(text, maxW);
      lines.forEach((line: string) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(line, margin, y);
        y += size * 0.45;
      });
      y += 2;
    };

    // Header
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageW, 14, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255);
    doc.text("Trust Build-IA", margin, 9);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }), pageW - margin, 9, { align: "right" });

    y = 24;
    addLine(title, 16, "bold", 30);
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    if (question) {
      addLine("Question", 9, "bold", 100);
      addLine(question, 10, "normal", 60);
      doc.setDrawColor(220);
      doc.line(margin, y, pageW - margin, y);
      y += 6;
    }

    addLine("Réponse", 9, "bold", 100);

    // Render markdown lines with basic formatting
    const mdLines = raw.split("\n");
    for (const line of mdLines) {
      if (!line.trim()) { y += 3; continue; }
      if (line.startsWith("### ")) {
        y += 2;
        addLine(line.replace(/^### /, ""), 12, "bold", 30);
      } else if (line.startsWith("## ")) {
        y += 3;
        addLine(line.replace(/^## /, ""), 13, "bold", 30);
      } else if (line.startsWith("# ")) {
        y += 3;
        addLine(line.replace(/^# /, ""), 14, "bold", 30);
      } else if (/^[-*•]\s/.test(line)) {
        const text = line.replace(/^[-*•]\s/, "").replace(/\*\*(.*?)\*\*/g, "$1");
        addLine(`  • ${text}`, 10, "normal", 40);
      } else {
        const text = line.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
        addLine(text, 10, "normal", 40);
      }
    }

    // Footer
    const pageCount = (doc.internal as any).getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(160);
      doc.text(`Page ${p} / ${pageCount}`, pageW - margin, 287, { align: "right" });
    }

    const filename = `${title.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  };

  const cleanContent = (content: string) => content.replace(/^\[(Robert B|Auguste P|Jarvis)\]\s*/i, "");

  const SourceBadge = ({ source }: { source?: string }) => {
    if (!source) return null;
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full mt-0.5">
        {source === "telegram" ? (
          <><Smartphone className="w-2.5 h-2.5" /> via Telegram</>
        ) : (
          <><Monitor className="w-2.5 h-2.5" /> via App</>
        )}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-fade-up">
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center", iconBg)}>
              <Icon className={cn("w-9 h-9", iconColor)} />
            </div>
            <div>
              <h2 className="text-h3 font-display">{title}</h2>
              <p className="text-body text-muted-foreground mt-1">{subtitle}</p>
            </div>
            <div className="space-y-2 w-full max-w-sm">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="w-full text-left p-3 rounded-lg border text-sm hover:bg-primary-glow hover:border-primary/20 transition-all touch-target">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "")}>
            {msg.role === "assistant" && (
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", iconBg)}>
                  <Icon className={cn("w-4 h-4", iconColor)} />
                </div>
                <span className="text-[9px] text-muted-foreground font-medium">{title.split("—")[0]?.trim()}</span>
              </div>
            )}
            <div className="flex flex-col gap-1.5 max-w-[80%]">
              <div className={cn("rounded-2xl px-4 py-3 text-sm", msg.role === "user" ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md shadow-forge" : "bg-card border rounded-bl-md shadow-forge")}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{cleanContent(msg.content)}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <SourceBadge source={msg.source} />
                {msg.role === "assistant" && !loading && (
                  <>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => saveDocument(i)} disabled={savingIdx === i}>
                      {savingIdx === i ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <Save className="w-3 h-3" />}
                      Sauvegarder
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => exportToPdf(i)}>
                      <FileDown className="w-3 h-3" />
                      PDF
                    </Button>
                  </>
                )}
              </div>
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {transcribing && (
          <div className="flex gap-3">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", iconBg)}>
              <Mic className={cn("w-4 h-4", iconColor)} />
            </div>
            <div className="border rounded-2xl rounded-bl-md px-4 py-3 text-sm text-muted-foreground">
              🎙 Transcription en cours...
            </div>
          </div>
        )}

        {loading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", iconBg)}>
              <Icon className={cn("w-4 h-4", iconColor)} />
            </div>
            <div className={cn("border rounded-2xl rounded-bl-md px-4 py-3", iconBg.replace("/10", "/5"))}>
              <div className="flex gap-1 items-center">
                <span className={cn("w-2 h-2 rounded-full animate-bounce", iconColor.replace("text-", "bg-"), "opacity-50")} style={{ animationDelay: "0ms" }} />
                <span className={cn("w-2 h-2 rounded-full animate-bounce", iconColor.replace("text-", "bg-"), "opacity-50")} style={{ animationDelay: "150ms" }} />
                <span className={cn("w-2 h-2 rounded-full animate-bounce", iconColor.replace("text-", "bg-"), "opacity-50")} style={{ animationDelay: "300ms" }} />
                <span className={cn("ml-1.5 font-mono text-xs animate-pulse", iconColor)}>|</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-3 shrink-0 bg-card">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 max-w-4xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={transcribing ? "Transcription en cours..." : placeholder}
            className="touch-target"
            disabled={loading || transcribing}
          />
          <Button
            type="button"
            size="icon"
            variant={recording ? "destructive" : "outline"}
            onClick={toggleRecording}
            disabled={loading || transcribing}
            className={cn("touch-target shrink-0 transition-all", recording && "animate-pulse")}
            title={recording ? "Arrêter l'enregistrement" : "Enregistrement vocal"}
          >
            {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          <Button type="submit" size="icon" disabled={!input.trim() || loading || transcribing} className="touch-target shrink-0 bg-gradient-to-r from-primary to-primary/90 shadow-forge">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
